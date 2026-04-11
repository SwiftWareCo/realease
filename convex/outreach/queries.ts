import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
    buildLeadEnrollmentReviewRecord,
    summarizeLeadEnrollmentReview,
} from "./eligibility";
import { getCurrentUserIdOrThrow, requireCampaignOwner } from "./auth";
import {
    buildDefaultCampaignName,
    getOutreachCampaignTemplate,
    OUTREACH_CAMPAIGN_TEMPLATE_KEYS,
    outreachCampaignTemplateKeyValidator,
    resolveCampaignTemplateKey,
} from "./templates";
import { getNextWindowOpenMs, isInsideCallingWindow } from "./callingWindow";
import {
    getLatestCampaignCallSnapshotsByLeadId,
    type LatestCampaignCallSnapshot,
} from "./latestCalls";
import {
    buildCampaignRuntimeSummary,
    buildCampaignRuntimeSummaryForTemplate,
} from "./runtimeSummary";

function resolveEffectiveTemplateKey(args: {
    campaign?: Doc<"outreachCampaigns"> | null;
    templateKey?: (typeof OUTREACH_CAMPAIGN_TEMPLATE_KEYS)[number] | null;
}): (typeof OUTREACH_CAMPAIGN_TEMPLATE_KEYS)[number] {
    const campaignTemplateKey = resolveCampaignTemplateKey(args.campaign);
    if (campaignTemplateKey) {
        return campaignTemplateKey;
    }
    if (args.templateKey) {
        return args.templateKey;
    }
    throw new Error(
        "Campaign template is not configured. Choose a template or update the campaign metadata.",
    );
}

function getCampaignTemplateMeta(templateKey: string | undefined) {
    if (!templateKey) {
        return null;
    }
    return getOutreachCampaignTemplate(
        templateKey as (typeof OUTREACH_CAMPAIGN_TEMPLATE_KEYS)[number],
    );
}

function buildLeadStateExplainability(args: {
    row: Doc<"outreachCampaignLeadStates">;
    campaign: Doc<"outreachCampaigns">;
    latestCall: LatestCampaignCallSnapshot | null;
    now: number;
}) {
    const { row, campaign, latestCall, now } = args;
    const maxAttempts = campaign.retry_policy.max_attempts;
    const nextAttemptNumber = Math.min(
        row.attempts_in_campaign + 1,
        maxAttempts,
    );
    const latestOutcome = latestCall?.outcome ?? row.last_outcome ?? null;
    const nextActionAt = row.next_action_at_ms ?? null;
    const nextActionTiming =
        nextActionAt !== null && nextActionAt > now ? " when due" : "";

    switch (row.state) {
        case "eligible":
            return {
                campaignState: row.state,
                stateReason:
                    nextActionAt !== null && nextActionAt > now
                        ? "Ready for outreach and waiting for the next valid calling window."
                        : "Ready for outreach and eligible for the next scheduler pass.",
                nextActionAt,
                nextActionLabel: `Queue call attempt ${nextAttemptNumber} of ${maxAttempts}${nextActionTiming}`,
                stopReason: null,
            };
        case "queued":
            return {
                campaignState: row.state,
                stateReason: "A call has been queued for this lead.",
                nextActionAt,
                nextActionLabel: "Wait for the call to start",
                stopReason: null,
            };
        case "in_progress":
            return {
                campaignState: row.state,
                stateReason: "A call is currently in progress for this lead.",
                nextActionAt,
                nextActionLabel: "Wait for the call outcome",
                stopReason: null,
            };
        case "cooldown":
            return {
                campaignState: row.state,
                stateReason: `Cooling down before retry attempt ${nextAttemptNumber} of ${maxAttempts}.`,
                nextActionAt,
                nextActionLabel: `Retry attempt ${nextAttemptNumber} of ${maxAttempts}`,
                stopReason: null,
            };
        case "sms_pending":
            return {
                campaignState: row.state,
                stateReason:
                    "Waiting to send follow-up SMS after the no-answer or voicemail sequence.",
                nextActionAt,
                nextActionLabel: "Send follow-up SMS",
                stopReason: null,
            };
        case "paused_for_realtor":
            return {
                campaignState: row.state,
                stateReason: latestOutcome
                    ? `Paused for realtor review because latest outcome was ${latestOutcome}.`
                    : "Paused for realtor review by a campaign outcome rule.",
                nextActionAt,
                nextActionLabel: "Realtor review required before more outreach",
                stopReason: "paused_for_realtor",
            };
        case "error":
            return {
                campaignState: row.state,
                stateReason:
                    row.last_error ??
                    "The scheduler hit an error while processing this lead.",
                nextActionAt,
                nextActionLabel:
                    nextActionAt !== null ? "Retry after error" : "Needs review",
                stopReason: null,
            };
        case "terminal_blocked":
            return {
                campaignState: row.state,
                stateReason: latestOutcome
                    ? `Blocked because latest outcome was ${latestOutcome}.`
                    : "Blocked by a terminal campaign rule.",
                nextActionAt,
                nextActionLabel: "No further outreach",
                stopReason: latestOutcome ?? "terminal_outcome",
            };
        case "done":
            return {
                campaignState: row.state,
                stateReason:
                    row.attempts_in_campaign >= maxAttempts
                        ? "Done because maximum attempts were reached."
                        : latestOutcome
                          ? `Done because latest outcome was ${latestOutcome}.`
                          : "Done because campaign outreach is complete for this lead.",
                nextActionAt,
                nextActionLabel: "No further outreach",
                stopReason:
                    row.attempts_in_campaign >= maxAttempts
                        ? "max_attempts_reached"
                        : latestOutcome,
            };
    }
}

function getTargetCampaignConfig(args: {
    campaign?: Doc<"outreachCampaigns"> | null;
    templateKey: (typeof OUTREACH_CAMPAIGN_TEMPLATE_KEYS)[number];
}) {
    const template = getOutreachCampaignTemplate(args.templateKey);
    const timezone =
        args.campaign?.timezone ??
        process.env.OUTREACH_DEFAULT_TIMEZONE?.trim() ??
        "America/Los_Angeles";

    return {
        template,
        timezone,
        callingWindow: args.campaign?.calling_window ?? template.callingWindow,
        maxAttempts:
            args.campaign?.retry_policy.max_attempts ??
            template.retryPolicy.max_attempts,
        campaignId: args.campaign?._id ?? null,
        campaignName:
            args.campaign?.name ?? buildDefaultCampaignName(args.templateKey),
        targetKind: args.campaign ? "existing" : "new",
        templateVersion:
            args.campaign?.template_version ?? template.version,
        runtimeSummary: buildCampaignRuntimeSummary({
            campaign: args.campaign ?? null,
            template,
        }),
    };
}

async function resolveOwnedCampaign(
    ctx: QueryCtx,
    campaignId: Id<"outreachCampaigns">,
) {
    const { campaign } = await requireCampaignOwner(ctx, campaignId);
    return campaign;
}

async function buildLeadEnrollmentReviewPayload(
    ctx: QueryCtx,
    args: {
        templateKey: (typeof OUTREACH_CAMPAIGN_TEMPLATE_KEYS)[number];
        campaign?: Doc<"outreachCampaigns"> | null;
        leadIds?: Id<"leads">[];
        limit?: number;
    },
) {
    const targetConfig = getTargetCampaignConfig({
        campaign: args.campaign,
        templateKey: args.templateKey,
    });
    const leads = args.leadIds
        ? (
              await Promise.all(
                  args.leadIds.map((leadId) => ctx.db.get(leadId)),
              )
          ).filter((lead): lead is Doc<"leads"> => Boolean(lead))
        : await ctx.db
              .query("leads")
              .order("desc")
              .take(args.limit ?? 500);

    const reviewLeads = await Promise.all(
        leads.map((lead) =>
            buildLeadEnrollmentReviewRecord(
                ctx,
                {
                    campaignId: targetConfig.campaignId,
                    maxAttempts: targetConfig.maxAttempts,
                    templateKey: args.templateKey,
                },
                lead,
            ),
        ),
    );

    const summary = summarizeLeadEnrollmentReview(reviewLeads);
    const now = Date.now();
    const canCallNow = isInsideCallingWindow(
        now,
        targetConfig.timezone,
        targetConfig.callingWindow,
    );
    const nextCallableAt = canCallNow
        ? null
        : getNextWindowOpenMs(
              now,
              targetConfig.timezone,
              targetConfig.callingWindow,
          );

    return {
        target: {
            kind: targetConfig.targetKind,
            campaignId: targetConfig.campaignId,
            campaignName: targetConfig.campaignName,
            templateKey: args.templateKey,
            templateVersion: targetConfig.templateVersion,
            timezone: targetConfig.timezone,
            callingWindow: targetConfig.callingWindow,
            dispatchMode: canCallNow ? "immediate" : "next_window",
            nextCallableAt,
            runtimeSummary: targetConfig.runtimeSummary,
        },
        summary: {
            selectedCount: reviewLeads.length,
            eligibleCount: summary.eligibleCount,
            conflictCount: summary.conflictCount,
            ineligibleCount: summary.ineligibleCount,
        },
        eligibleLeads: reviewLeads.filter(
            (lead) => lead.classification === "eligible",
        ),
        conflictLeads: reviewLeads.filter(
            (lead) => lead.classification === "conflict",
        ),
        ineligibleLeads: reviewLeads.filter(
            (lead) => lead.classification === "ineligible",
        ),
        allLeads: reviewLeads,
    };
}

export const getCampaignTemplates = query({
    args: {},
    handler: async (ctx) => {
        await getCurrentUserIdOrThrow(ctx);

        return OUTREACH_CAMPAIGN_TEMPLATE_KEYS.map((templateKey) => {
            const template = getOutreachCampaignTemplate(templateKey);
            return {
                key: template.key,
                version: template.version,
                label: template.label,
                shortLabel: template.shortLabel,
                description: template.description,
                recommendedLeadType: template.recommendedLeadType,
                defaultName: buildDefaultCampaignName(template.key),
                runtimeSummary: buildCampaignRuntimeSummaryForTemplate(
                    template.key,
                ),
            };
        });
    },
});

export const getOutreachLeadPicker = query({
    args: {
        templateKey: v.optional(outreachCampaignTemplateKeyValidator),
        campaignId: v.optional(v.id("outreachCampaigns")),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await getCurrentUserIdOrThrow(ctx);
        const campaign = args.campaignId
            ? await resolveOwnedCampaign(ctx, args.campaignId)
            : null;
        const templateKey = resolveEffectiveTemplateKey({
            campaign,
            templateKey: args.templateKey ?? null,
        });
        const limit =
            args.limit !== undefined
                ? Math.max(1, Math.floor(args.limit))
                : 500;
        const review = await buildLeadEnrollmentReviewPayload(ctx, {
            templateKey,
            campaign,
            limit,
        });

        return {
            campaignId: review.target.campaignId,
            campaignName: review.target.campaignName,
            templateKey: review.target.templateKey,
            templateVersion: review.target.templateVersion,
            maxAttempts:
                campaign?.retry_policy.max_attempts ??
                getOutreachCampaignTemplate(templateKey).retryPolicy.max_attempts,
            runtimeSummary: review.target.runtimeSummary,
            totalLeads: review.allLeads.length,
            selectableCount: review.summary.eligibleCount,
            leads: review.allLeads,
        };
    },
});

export const getLeadEnrollmentReviewInternal = internalQuery({
    args: {
        templateKey: v.optional(outreachCampaignTemplateKeyValidator),
        campaignId: v.optional(v.id("outreachCampaigns")),
        leadIds: v.array(v.id("leads")),
    },
    handler: async (ctx, args) => {
        const campaign = args.campaignId
            ? await ctx.db.get(args.campaignId)
            : null;
        const templateKey = resolveEffectiveTemplateKey({
            campaign,
            templateKey: args.templateKey ?? null,
        });
        return await buildLeadEnrollmentReviewPayload(ctx, {
            templateKey,
            campaign,
            leadIds: args.leadIds,
        });
    },
});

export const getLeadEnrollmentReview = query({
    args: {
        templateKey: v.optional(outreachCampaignTemplateKeyValidator),
        campaignId: v.optional(v.id("outreachCampaigns")),
        leadIds: v.array(v.id("leads")),
    },
    handler: async (ctx, args) => {
        await getCurrentUserIdOrThrow(ctx);
        const campaign = args.campaignId
            ? await resolveOwnedCampaign(ctx, args.campaignId)
            : null;
        const templateKey = resolveEffectiveTemplateKey({
            campaign,
            templateKey: args.templateKey ?? null,
        });

        return await buildLeadEnrollmentReviewPayload(ctx, {
            templateKey,
            campaign,
            leadIds: args.leadIds,
        });
    },
});

export const getCampaignsForPicker = query({
    args: {
        includeInactive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const campaigns = await ctx.db
            .query("outreachCampaigns")
            .withIndex("by_created_by_user_id", (q) =>
                q.eq("created_by_user_id", userId),
            )
            .collect();
        const hasCallHistoryByCampaignId = new Map<string, boolean>();
        for (const campaign of campaigns) {
            const existingCall = await ctx.db
                .query("outreachCalls")
                .withIndex("by_campaign_id", (q) =>
                    q.eq("campaign_id", campaign._id),
                )
                .first();
            hasCallHistoryByCampaignId.set(
                String(campaign._id),
                Boolean(existingCall),
            );
        }
        const includeInactive = args.includeInactive ?? false;

        return campaigns
            .filter((campaign) => {
                if (includeInactive) {
                    return true;
                }
                return (
                    campaign.status !== "archived" &&
                    campaign.status !== "completed"
                );
            })
            .sort((a, b) => b.updated_at - a.updated_at)
            .map((campaign) => {
                const resolvedTemplateKey = resolveCampaignTemplateKey(campaign);
                const templateMeta = getCampaignTemplateMeta(
                    resolvedTemplateKey ?? undefined,
                );
                const runtimeSummary = resolvedTemplateKey
                    ? buildCampaignRuntimeSummary({
                          campaign,
                          template: getOutreachCampaignTemplate(
                              resolvedTemplateKey,
                          ),
                      })
                    : null;

                return {
                    _id: campaign._id,
                    name: campaign.name,
                    description: campaign.description ?? null,
                    status: campaign.status,
                    templateKey: resolvedTemplateKey,
                    templateVersion:
                        campaign.template_version ?? templateMeta?.version ?? null,
                    templateLabel: templateMeta?.label ?? null,
                    timezone: campaign.timezone,
                    retellAgentId: campaign.retell_agent_id,
                    retellPhoneNumberId: campaign.retell_phone_number_id ?? null,
                    twilioMessagingServiceSid:
                        campaign.twilio_messaging_service_sid ?? null,
                    followUpSms: {
                        enabled: campaign.follow_up_sms?.enabled ?? false,
                        delay_minutes: campaign.follow_up_sms?.delay_minutes ?? 3,
                        default_template:
                            campaign.follow_up_sms?.default_template ?? null,
                        send_only_on_outcomes:
                            campaign.follow_up_sms?.send_only_on_outcomes ?? [],
                    },
                    retryPolicy: campaign.retry_policy,
                    callingWindow: campaign.calling_window,
                    runtimeSummary,
                    updatedAt: campaign.updated_at,
                    hasCallHistory:
                        hasCallHistoryByCampaignId.get(String(campaign._id)) ??
                        false,
                };
            });
    },
});

export const getCampaignCallAttempts = query({
    args: {
        campaignId: v.id("outreachCampaigns"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }
        if (campaign.created_by_user_id !== userId) {
            throw new Error("Campaign not found");
        }

        const take =
            args.limit !== undefined
                ? Math.max(1, Math.floor(args.limit))
                : 200;

        // Use state table for lead stats instead of unbounded call scan.
        const stateRows = await ctx.db
            .query("outreachCampaignLeadStates")
            .withIndex("by_campaign_id", (q) =>
                q.eq("campaign_id", args.campaignId),
            )
            .collect();

        // Bounded recent calls for the call list display.
        const recentCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_campaign_id_and_initiated_at", (q) =>
                q.eq("campaign_id", args.campaignId),
            )
            .order("desc")
            .take(take);

        const campaignTemplateKey = resolveCampaignTemplateKey(campaign);
        const campaignTemplate = campaignTemplateKey
            ? getOutreachCampaignTemplate(campaignTemplateKey)
            : null;

        // Build lead cache from state rows + recent calls.
        const leadsById = new Map<string, Doc<"leads"> | null>();
        for (const row of stateRows) {
            const key = String(row.lead_id);
            if (!leadsById.has(key)) {
                leadsById.set(key, await ctx.db.get(row.lead_id));
            }
        }
        for (const call of recentCalls) {
            const key = String(call.lead_id);
            if (!leadsById.has(key)) {
                leadsById.set(key, await ctx.db.get(call.lead_id));
            }
        }
        const latestCallByLeadId = await getLatestCampaignCallSnapshotsByLeadId(
            ctx,
            {
                campaignId: args.campaignId,
                leadIds: stateRows.map((row) => row.lead_id),
            },
        );

        // Build summary from state rows (approximate — counts enrolled leads).
        const summary = {
            total: stateRows.reduce(
                (sum, row) => sum + row.attempts_in_campaign,
                0,
            ),
            queued: stateRows.filter((r) => r.state === "queued").length,
            ringing: 0,
            in_progress: stateRows.filter((r) => r.state === "in_progress")
                .length,
            completed: stateRows.filter(
                (r) => r.state === "done" || r.state === "terminal_blocked",
            ).length,
            failed: stateRows.filter((r) => r.state === "error").length,
            canceled: 0,
        };

        // Build campaignLeads from state rows.
        const campaignLeads = stateRows
            .map((row) => {
                const lead = leadsById.get(String(row.lead_id)) ?? null;
                const latestCall =
                    latestCallByLeadId.get(String(row.lead_id)) ?? null;
                const explainability = buildLeadStateExplainability({
                    row,
                    campaign,
                    latestCall,
                    now: Date.now(),
                });
                const stateToCallStatus: Record<
                    string,
                    Doc<"outreachCalls">["call_status"]
                > = {
                    eligible: "queued",
                    queued: "queued",
                    in_progress: "in_progress",
                    cooldown: "completed",
                    sms_pending: "completed",
                    paused_for_realtor: "completed",
                    error: "failed",
                    terminal_blocked: "completed",
                    done: "completed",
                };
                return {
                    leadId: row.lead_id,
                    leadName: lead?.name ?? "Deleted lead",
                    leadPhone: lead?.phone ?? "Unknown",
                    leadStatus: lead?.status ?? null,
                    leadDoNotCall: lead?.do_not_call ?? false,
                    leadSmsOptOut: lead?.sms_opt_out ?? false,
                    campaignState: explainability.campaignState,
                    stateReason: explainability.stateReason,
                    nextActionAt: explainability.nextActionAt,
                    nextActionLabel: explainability.nextActionLabel,
                    stopReason: explainability.stopReason,
                    attempts: row.attempts_in_campaign,
                    activeCalls:
                        row.state === "queued" || row.state === "in_progress"
                            ? 1
                            : 0,
                    latestCallId:
                        latestCall?._id ??
                        row.active_call_id ??
                        (null as Id<"outreachCalls"> | null),
                    latestInitiatedAt:
                        latestCall?.initiated_at ??
                        row.last_attempt_at ??
                        row._creationTime,
                    latestCallStatus:
                        latestCall?.call_status ??
                        stateToCallStatus[row.state] ??
                        ("completed" as Doc<"outreachCalls">["call_status"]),
                    latestOutcome:
                        latestCall?.outcome ?? null,
                };
            })
            .sort((a, b) => b.latestInitiatedAt - a.latestInitiatedAt);

        return {
            campaign: {
                _id: campaign._id,
                name: campaign.name,
                status: campaign.status,
                timezone: campaign.timezone,
                templateKey: campaignTemplateKey,
                templateLabel: campaignTemplate?.label ?? null,
                templateVersion:
                    campaign.template_version ?? campaignTemplate?.version ?? null,
                runtimeSummary: campaignTemplate
                    ? buildCampaignRuntimeSummary({
                          campaign,
                          template: campaignTemplate,
                      })
                    : null,
            },
            summary,
            campaignLeads,
            calls: recentCalls.map((call) => {
                const lead = leadsById.get(String(call.lead_id)) ?? null;
                return {
                    callId: call._id,
                    leadId: call.lead_id,
                    leadName: lead?.name ?? "Deleted lead",
                    leadPhone: lead?.phone ?? "Unknown",
                    callStatus: call.call_status,
                    retellCallId: call.retell_call_id ?? null,
                    initiatedAt: call.initiated_at,
                    startedAt: call.started_at ?? null,
                    endedAt: call.ended_at ?? null,
                    outcome: call.outcome ?? null,
                    errorMessage: call.error_message ?? null,
                };
            }),
        };
    },
});

export const getCampaignLeadConversation = query({
    args: {
        campaignId: v.id("outreachCampaigns"),
        leadId: v.id("leads"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }
        if (campaign.created_by_user_id !== userId) {
            throw new Error("Campaign not found");
        }

        const lead = await ctx.db.get(args.leadId);
        if (!lead) {
            throw new Error("Lead not found");
        }

        const leadCallsRaw = await ctx.db
            .query("outreachCalls")
            .withIndex("by_lead_id", (q) => q.eq("lead_id", args.leadId))
            .order("desc")
            .take(50);
        const leadCalls = leadCallsRaw.filter(
            (call) => call.campaign_id === args.campaignId,
        );

        const smsMessagesRaw = await ctx.db
            .query("outreachSmsMessages")
            .withIndex("by_campaign_id_and_lead_id_and_created_at", (q) =>
                q.eq("campaign_id", args.campaignId).eq("lead_id", args.leadId),
            )
            .order("desc")
            .take(200);
        const smsConversation = [...smsMessagesRaw]
            .reverse()
            .map((message) => ({
                messageId: message._id,
                direction: message.direction,
                status: message.status,
                body: message.body,
                fromNumber: message.from_number,
                toNumber: message.to_number,
                provider: message.provider,
                providerMessageSid: message.provider_message_sid ?? null,
                sentAt: message.sent_at ?? null,
                receivedAt: message.received_at ?? null,
                errorCode: message.error_code ?? null,
                errorMessage: message.error_message ?? null,
                callId: message.call_id ?? null,
                createdAt: message.created_at,
                updatedAt: message.updated_at,
            }));

        return {
            campaign: {
                _id: campaign._id,
                name: campaign.name,
                status: campaign.status,
                twilioMessagingServiceSid:
                    campaign.twilio_messaging_service_sid ?? null,
            },
            lead: {
                _id: lead._id,
                name: lead.name,
                phone: lead.phone,
                status: lead.status,
                doNotCall: lead.do_not_call ?? false,
                smsOptOut: lead.sms_opt_out ?? false,
            },
            latestCallId: leadCalls[0]?._id ?? null,
            communicationAttempts: leadCalls.map((call) => ({
                callId: call._id,
                callStatus: call.call_status,
                outcome: call.outcome ?? null,
                initiatedAt: call.initiated_at,
                retellCallId: call.retell_call_id ?? null,
                errorMessage: call.error_message ?? null,
            })),
            smsConversation,
        };
    },
});

export const getCampaignCallAttemptDetails = query({
    args: {
        campaignId: v.id("outreachCampaigns"),
        callId: v.id("outreachCalls"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }
        if (campaign.created_by_user_id !== userId) {
            throw new Error("Campaign not found");
        }

        const call = await ctx.db.get(args.callId);
        if (!call || call.campaign_id !== args.campaignId) {
            throw new Error("Call attempt not found");
        }

        const lead = await ctx.db.get(call.lead_id);

        const byCallIdEvents = await ctx.db
            .query("outreachWebhookEvents")
            .withIndex("by_call_id", (q) => q.eq("call_id", call._id))
            .take(100);
        const byRetellCallIdEvents = call.retell_call_id
            ? await ctx.db
                  .query("outreachWebhookEvents")
                  .withIndex("by_retell_call_id", (q) =>
                      q.eq("retell_call_id", call.retell_call_id!),
                  )
                  .take(100)
            : [];

        const eventsById = new Map<string, Doc<"outreachWebhookEvents">>();
        for (const event of byCallIdEvents) {
            eventsById.set(String(event._id), event);
        }
        for (const event of byRetellCallIdEvents) {
            eventsById.set(String(event._id), event);
        }
        const webhookEvents = Array.from(eventsById.values())
            .sort((a, b) => {
                const aTime = a.event_timestamp ?? a.received_at;
                const bTime = b.event_timestamp ?? b.received_at;
                return aTime - bTime;
            })
            .map((event) => ({
                eventId: event._id,
                retellEventId: event.retell_event_id ?? null,
                retellCallId: event.retell_call_id ?? null,
                eventType: event.event_type,
                eventTimestamp: event.event_timestamp ?? null,
                processingStatus: event.processing_status,
                processingError: event.processing_error ?? null,
                receivedAt: event.received_at,
                processedAt: event.processed_at ?? null,
                payload: event.payload,
            }));

        const leadCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_lead_id", (q) => q.eq("lead_id", call.lead_id))
            .take(50);
        const historyCampaignDocs = new Map<
            Id<"outreachCampaigns">,
            Doc<"outreachCampaigns"> | null
        >();
        const historyCampaignIds = new Set(
            leadCalls
                .map((historyCall) => historyCall.campaign_id)
                .filter((campaignId): campaignId is Id<"outreachCampaigns"> =>
                    Boolean(campaignId),
                ),
        );
        for (const campaignId of historyCampaignIds) {
            historyCampaignDocs.set(campaignId, await ctx.db.get(campaignId));
        }

        const leadHistoryCalls = leadCalls
            .filter((historyCall) => {
                if (!historyCall.campaign_id) {
                    return false;
                }
                const historyCampaign = historyCampaignDocs.get(
                    historyCall.campaign_id,
                );
                return historyCampaign?.created_by_user_id === userId;
            })
            .sort((a, b) => b.initiated_at - a.initiated_at)
            .slice(0, 12);

        return {
            campaign: {
                _id: campaign._id,
                name: campaign.name,
                status: campaign.status,
                timezone: campaign.timezone,
            },
            call: {
                callId: call._id,
                leadId: call.lead_id,
                leadName: lead?.name ?? "Deleted lead",
                leadPhone: lead?.phone ?? "Unknown",
                leadStatus: lead?.status ?? null,
                leadDoNotCall: lead?.do_not_call ?? false,
                leadSmsOptOut: lead?.sms_opt_out ?? false,
                callStatus: call.call_status,
                callDirection: call.call_direction,
                initiatedAt: call.initiated_at,
                startedAt: call.started_at ?? null,
                endedAt: call.ended_at ?? null,
                durationSeconds: call.duration_seconds ?? null,
                retellCallId: call.retell_call_id ?? null,
                retellConversationId: call.retell_conversation_id ?? null,
                recordingUrl: call.recording_url ?? null,
                transcript: call.transcript ?? null,
                summary: call.summary ?? null,
                extractedData: call.extracted_data ?? null,
                outcome: call.outcome ?? null,
                outcomeReason: call.outcome_reason ?? null,
                followUpSmsStatus: call.follow_up_sms_status ?? null,
                followUpSmsSentAt: call.follow_up_sms_sent_at ?? null,
                followUpSmsSid: call.follow_up_sms_sid ?? null,
                followUpSmsError: call.follow_up_sms_error ?? null,
                errorMessage: call.error_message ?? null,
                createdAt: call.created_at,
                updatedAt: call.updated_at,
            },
            webhookEvents,
            leadHistory: leadHistoryCalls.map((historyCall) => ({
                callId: historyCall._id,
                campaignId: historyCall.campaign_id ?? null,
                campaignName: historyCall.campaign_id
                    ? (historyCampaignDocs.get(historyCall.campaign_id)?.name ??
                      "Campaign")
                    : null,
                callStatus: historyCall.call_status,
                outcome: historyCall.outcome ?? null,
                initiatedAt: historyCall.initiated_at,
                retellCallId: historyCall.retell_call_id ?? null,
                errorMessage: historyCall.error_message ?? null,
            })),
        };
    },
});

export const getActiveOutreachCallCount = internalQuery({
    args: {},
    handler: async (ctx) => {
        // Use bounded .take() instead of unbounded .collect().
        const maxConcurrency = 21; // MAX_RETELL_CONCURRENT_CALLS + 1
        const queuedCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_call_status", (q) => q.eq("call_status", "queued"))
            .take(maxConcurrency);
        const ringingCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_call_status", (q) => q.eq("call_status", "ringing"))
            .take(maxConcurrency);
        const inProgressCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_call_status", (q) =>
                q.eq("call_status", "in_progress"),
            )
            .take(maxConcurrency);

        return {
            queued: queuedCalls.length,
            ringing: ringingCalls.length,
            in_progress: inProgressCalls.length,
            totalActive:
                queuedCalls.length +
                ringingCalls.length +
                inProgressCalls.length,
        };
    },
});

export const getPendingFollowUpSmsCallIdsForAutomation = internalQuery({
    args: {
        now_ms: v.optional(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = args.now_ms ?? Date.now();
        const limit =
            args.limit !== undefined ? Math.max(1, Math.floor(args.limit)) : 50;

        const pendingCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_follow_up_sms_status", (q) =>
                q.eq("follow_up_sms_status", "pending"),
            )
            .take(200);
        const campaignDocs = new Map<
            Id<"outreachCampaigns">,
            Doc<"outreachCampaigns"> | null
        >();
        const dueCalls: Array<{
            callId: Id<"outreachCalls">;
            dueAt: number;
        }> = [];

        for (const call of pendingCalls) {
            let campaign: Doc<"outreachCampaigns"> | null = null;
            if (call.campaign_id) {
                campaign = campaignDocs.get(call.campaign_id) ?? null;
                if (!campaignDocs.has(call.campaign_id)) {
                    campaign = await ctx.db.get(call.campaign_id);
                    campaignDocs.set(call.campaign_id, campaign);
                }
            }

            const delayMinutes = campaign?.follow_up_sms?.delay_minutes ?? 3;
            const referenceTimestamp =
                call.ended_at ?? call.updated_at ?? call.initiated_at;
            const dueAt = referenceTimestamp + delayMinutes * 60 * 1000;

            if (dueAt <= now) {
                dueCalls.push({
                    callId: call._id,
                    dueAt,
                });
            }
        }

        return dueCalls
            .sort((a, b) => a.dueAt - b.dueAt)
            .slice(0, limit)
            .map((item) => item.callId);
    },
});

export const getCampaignDispatchConfig = internalQuery({
    args: {
        campaignId: v.id("outreachCampaigns"),
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }

        return {
            campaignId: campaign._id,
            campaignName: campaign.name,
            retellAgentId: campaign.retell_agent_id,
            // Legacy field name kept in schema; value is used as outbound caller number.
            retellOutboundNumber: campaign.retell_phone_number_id ?? null,
        };
    },
});

export const getFollowUpSmsDispatchContext = internalQuery({
    args: {
        callId: v.id("outreachCalls"),
    },
    handler: async (ctx, args) => {
        const call = await ctx.db.get(args.callId);
        if (!call) {
            return null;
        }

        const lead = await ctx.db.get(call.lead_id);
        const campaign = call.campaign_id
            ? await ctx.db.get(call.campaign_id)
            : null;
        // Use state table for attempt count instead of unbounded call scan.
        let followUpAttemptsInCampaign = 0;
        if (lead && campaign) {
            const stateRow = await ctx.db
                .query("outreachCampaignLeadStates")
                .withIndex("by_campaign_id_and_lead_id", (q) =>
                    q.eq("campaign_id", campaign._id).eq("lead_id", lead._id),
                )
                .first();
            followUpAttemptsInCampaign =
                stateRow?.no_answer_or_voicemail_count ?? 0;
        }

        return {
            call: {
                _id: call._id,
                lead_id: call.lead_id,
                campaign_id: call.campaign_id ?? null,
                outcome: call.outcome ?? null,
                summary: call.summary ?? null,
                follow_up_sms_status: call.follow_up_sms_status ?? null,
            },
            follow_up_attempts_in_campaign: followUpAttemptsInCampaign,
            lead: lead
                ? {
                      _id: lead._id,
                      name: lead.name,
                      phone: lead.phone,
                      do_not_call: lead.do_not_call ?? false,
                      sms_opt_out: lead.sms_opt_out ?? false,
                  }
                : null,
            campaign: campaign
                ? {
                      _id: campaign._id,
                      name: campaign.name,
                      twilio_messaging_service_sid:
                          campaign.twilio_messaging_service_sid ?? null,
                      follow_up_sms: campaign.follow_up_sms ?? null,
                      outcome_routing: campaign.outcome_routing ?? null,
                  }
                : null,
        };
    },
});
