import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { isValidPhoneNumber } from "./phone";

type EligibilityReason =
    | "invalid_phone"
    | "do_not_call"
    | "status_not_eligible"
    | "active_call_in_progress"
    | "max_attempts_reached"
    | "blocked_by_terminal_outcome";

type CampaignLeadCallStats = {
    attemptsInCampaign: number;
    hasActiveCall: boolean;
    latestOutcome?: Doc<"outreachCalls">["outcome"];
    latestInitiatedAt?: number;
};

const ACTIVE_CALL_STATUSES: ReadonlySet<Doc<"outreachCalls">["call_status"]> =
    new Set(["queued", "ringing", "in_progress"]);

async function getCurrentUserIdOrThrow(ctx: QueryCtx): Promise<Id<"users">> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new Error("Unauthorized");
    }

    const user = await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) =>
            q.eq("externalId", identity.subject),
        )
        .unique();
    if (!user) {
        throw new Error("User not found");
    }

    return user._id;
}

function getSelectableReasons(
    lead: Doc<"leads">,
    stats: CampaignLeadCallStats | undefined,
    maxAttempts: number,
): EligibilityReason[] {
    const reasons: EligibilityReason[] = [];

    if (!isValidPhoneNumber(lead.phone)) {
        reasons.push("invalid_phone");
    }

    if (lead.do_not_call === true) {
        reasons.push("do_not_call");
    }

    if (lead.status !== "new" && lead.status !== "contacted") {
        reasons.push("status_not_eligible");
    }

    if (stats?.hasActiveCall) {
        reasons.push("active_call_in_progress");
    }

    if ((stats?.attemptsInCampaign ?? 0) >= maxAttempts) {
        reasons.push("max_attempts_reached");
    }

    if (
        stats?.latestOutcome === "do_not_call" ||
        stats?.latestOutcome === "wrong_number"
    ) {
        reasons.push("blocked_by_terminal_outcome");
    }

    return reasons;
}

export const getCampaignLeadPicker = query({
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

        const maxAttempts = campaign.retry_policy.max_attempts;
        const calls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_campaign_id", (q) =>
                q.eq("campaign_id", args.campaignId),
            )
            .collect();

        const statsByLead = new Map<string, CampaignLeadCallStats>();
        for (const call of calls) {
            const leadKey = String(call.lead_id);
            const current = statsByLead.get(leadKey) ?? {
                attemptsInCampaign: 0,
                hasActiveCall: false,
            };

            current.attemptsInCampaign += 1;
            if (ACTIVE_CALL_STATUSES.has(call.call_status)) {
                current.hasActiveCall = true;
            }
            if (
                current.latestInitiatedAt === undefined ||
                call.initiated_at > current.latestInitiatedAt
            ) {
                current.latestInitiatedAt = call.initiated_at;
                current.latestOutcome = call.outcome;
            }

            statsByLead.set(leadKey, current);
        }

        const allLeads = await ctx.db.query("leads").order("desc").collect();
        const limit =
            args.limit !== undefined
                ? Math.max(1, Math.floor(args.limit))
                : undefined;
        const leads = limit !== undefined ? allLeads.slice(0, limit) : allLeads;

        const leadCandidates = leads.map((lead) => {
            const stats = statsByLead.get(String(lead._id));
            const reasons = getSelectableReasons(lead, stats, maxAttempts);
            const selectable = reasons.length === 0;

            return {
                leadId: lead._id,
                name: lead.name,
                phone: lead.phone,
                status: lead.status,
                doNotCall: lead.do_not_call ?? false,
                selectable,
                reasons,
                attemptsInCampaign: stats?.attemptsInCampaign ?? 0,
                latestCampaignOutcome: stats?.latestOutcome ?? null,
            };
        });

        return {
            campaignId: campaign._id,
            campaignName: campaign.name,
            maxAttempts,
            totalLeads: leadCandidates.length,
            selectableCount: leadCandidates.filter((lead) => lead.selectable)
                .length,
            leads: leadCandidates,
        };
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
            .map((campaign) => ({
                _id: campaign._id,
                name: campaign.name,
                description: campaign.description ?? null,
                status: campaign.status,
                timezone: campaign.timezone,
                retellAgentId: campaign.retell_agent_id,
                retellPhoneNumberId: campaign.retell_phone_number_id ?? null,
                twilioMessagingServiceSid:
                    campaign.twilio_messaging_service_sid ?? null,
                retryPolicy: campaign.retry_policy,
                callingWindow: campaign.calling_window,
                updatedAt: campaign.updated_at,
                hasCallHistory:
                    hasCallHistoryByCampaignId.get(String(campaign._id)) ??
                    false,
            }));
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

        const calls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_campaign_id_and_initiated_at", (q) =>
                q.eq("campaign_id", args.campaignId),
            )
            .order("desc")
            .take(take);

        const leadsById = new Map<string, Doc<"leads"> | null>();
        for (const call of calls) {
            const key = String(call.lead_id);
            if (!leadsById.has(key)) {
                leadsById.set(key, await ctx.db.get(call.lead_id));
            }
        }

        const summary = {
            total: calls.length,
            queued: 0,
            ringing: 0,
            in_progress: 0,
            completed: 0,
            failed: 0,
            canceled: 0,
        };

        for (const call of calls) {
            summary[call.call_status] += 1;
        }

        return {
            campaign: {
                _id: campaign._id,
                name: campaign.name,
                status: campaign.status,
                timezone: campaign.timezone,
            },
            summary,
            calls: calls.map((call) => {
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
            .collect();
        const byRetellCallIdEvents = call.retell_call_id
            ? await ctx.db
                  .query("outreachWebhookEvents")
                  .withIndex("by_retell_call_id", (q) =>
                      q.eq("retell_call_id", call.retell_call_id!),
                  )
                  .collect()
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
            .collect();
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
