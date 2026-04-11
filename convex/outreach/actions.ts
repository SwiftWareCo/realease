"use node";

import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { isValidPhoneNumber, normalizePhoneNumber } from "./phone";
import {
    buildDefaultCampaignName,
    getOutreachCampaignTemplate,
    outreachCampaignTemplateKeyValidator,
} from "./templates";

type CallStatus =
    | "queued"
    | "ringing"
    | "in_progress"
    | "completed"
    | "failed"
    | "canceled";

function mapRetellStatus(status?: string): CallStatus {
    switch (status) {
        case "registered":
        case "not_connected":
            return "queued";
        case "ongoing":
            return "in_progress";
        case "ended":
            return "completed";
        case "error":
            return "failed";
        default:
            return "queued";
    }
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "Unexpected provider error";
}



type FollowUpSmsDispatchContext = {
    call: {
        _id: Id<"outreachCalls">;
        lead_id: Id<"leads">;
        campaign_id: Id<"outreachCampaigns"> | null;
        outcome:
            | "connected_interested"
            | "connected_not_interested"
            | "callback_requested"
            | "voicemail_left"
            | "no_answer"
            | "wrong_number"
            | "do_not_call"
            | "failed"
            | null;
        summary: string | null;
        follow_up_sms_status:
            | "not_needed"
            | "pending"
            | "sent"
            | "failed"
            | "opted_out"
            | null;
    };
    follow_up_attempts_in_campaign: number;
    lead: {
        _id: Id<"leads">;
        name: string;
        phone: string;
        do_not_call: boolean;
        sms_opt_out: boolean;
    } | null;
    campaign: {
        _id: Id<"outreachCampaigns">;
        name: string;
        twilio_messaging_service_sid: string | null;
        follow_up_sms: {
            enabled: boolean;
            delay_minutes: number;
            default_template?: string;
            send_only_on_outcomes?: Array<
                | "connected_interested"
                | "connected_not_interested"
                | "callback_requested"
                | "voicemail_left"
                | "no_answer"
                | "wrong_number"
                | "do_not_call"
                | "failed"
            >;
        } | null;
        outcome_routing: Array<{
            outcome:
                | "connected_interested"
                | "connected_not_interested"
                | "callback_requested"
                | "voicemail_left"
                | "no_answer"
                | "wrong_number"
                | "do_not_call"
                | "failed";
            next_lead_status?: "new" | "contacted" | "qualified";
            next_buyer_pipeline_stage?:
                | "searching"
                | "showings"
                | "offer_out"
                | "under_contract"
                | "closed";
            next_seller_pipeline_stage?:
                | "pre_listing"
                | "on_market"
                | "offer_in"
                | "under_contract"
                | "sold";
            send_follow_up_sms?: boolean;
            custom_sms_template?: string;
            campaign_lead_action?:
                | "continue"
                | "stop_calling"
                | "pause_for_realtor";
        }> | null;
    } | null;
};

const FOLLOW_UP_SMS_TRIGGER_OUTCOMES: ReadonlySet<
    NonNullable<FollowUpSmsDispatchContext["call"]["outcome"]>
> = new Set(["no_answer", "voicemail_left"]);

function normalizeOptionalString(value?: string | null): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function normalizeTwilioMessageStatus(
    value?: string | null,
):
    | "queued"
    | "accepted"
    | "sending"
    | "sent"
    | "delivered"
    | "undelivered"
    | "failed"
    | "receiving"
    | "received"
    | "read"
    | "canceled"
    | "unknown" {
    const normalized = value?.trim().toLowerCase();
    switch (normalized) {
        case "queued":
        case "accepted":
        case "sending":
        case "sent":
        case "delivered":
        case "undelivered":
        case "failed":
        case "receiving":
        case "received":
        case "read":
        case "canceled":
            return normalized;
        default:
            return "unknown";
    }
}

function resolveShouldSendFollowUpSms(args: {
    campaign: NonNullable<FollowUpSmsDispatchContext["campaign"]>;
    outcome: NonNullable<FollowUpSmsDispatchContext["call"]["outcome"]>;
}): { shouldSend: boolean; customTemplate?: string } {
    const routeRule = args.campaign.outcome_routing?.find(
        (rule) => rule.outcome === args.outcome,
    );
    if (routeRule?.send_follow_up_sms !== undefined) {
        return {
            shouldSend: routeRule.send_follow_up_sms,
            customTemplate: normalizeOptionalString(
                routeRule.custom_sms_template,
            ),
        };
    }

    const allowedOutcomes = args.campaign.follow_up_sms?.send_only_on_outcomes;
    const expandedAllowedOutcomes = new Set(allowedOutcomes ?? []);
    if (expandedAllowedOutcomes.has("no_answer")) {
        expandedAllowedOutcomes.add("voicemail_left");
    }
    if (allowedOutcomes && allowedOutcomes.length > 0) {
        return {
            shouldSend: expandedAllowedOutcomes.has(args.outcome),
            customTemplate: normalizeOptionalString(
                routeRule?.custom_sms_template,
            ),
        };
    }

    return {
        shouldSend: true,
        customTemplate: normalizeOptionalString(routeRule?.custom_sms_template),
    };
}

function renderSmsTemplate(
    template: string,
    context: {
        leadName: string;
        campaignName: string;
        outcome: NonNullable<FollowUpSmsDispatchContext["call"]["outcome"]>;
        callSummary: string;
    },
): string {
    return template
        .replace(/\{\{\s*lead_name\s*\}\}/gi, context.leadName)
        .replace(/\{\{\s*campaign_name\s*\}\}/gi, context.campaignName)
        .replace(/\{\{\s*outcome\s*\}\}/gi, context.outcome)
        .replace(/\{\{\s*call_summary\s*\}\}/gi, context.callSummary);
}

type EnrollBatchResult = {
    enrolled: Array<{ lead_id: Id<"leads">; stateId: string }>;
    skipped: Array<{
        lead_id: Id<"leads">;
        reasons: string[];
        conflict_campaign_id?: Id<"outreachCampaigns"> | null;
        conflict_campaign_name?: string | null;
    }>;
};

type LeadEnrollmentReview = {
    target: {
        campaignId: Id<"outreachCampaigns"> | null;
        dispatchMode: string;
        nextCallableAt: number | null;
    };
    summary: {
        eligibleCount: number;
    };
    eligibleLeads: Array<{
        leadId: Id<"leads">;
    }>;
    conflictLeads: Array<{
        leadId: Id<"leads">;
        reasons: string[];
        conflictCampaignId: Id<"outreachCampaigns"> | null;
        conflictCampaignName: string | null;
    }>;
    ineligibleLeads: Array<{
        leadId: Id<"leads">;
        reasons: string[];
        conflictCampaignId: Id<"outreachCampaigns"> | null;
        conflictCampaignName: string | null;
    }>;
};

export const startCampaignOutreach = action({
    args: {
        templateKey: v.optional(outreachCampaignTemplateKeyValidator),
        campaignId: v.optional(v.id("outreachCampaigns")),
        campaignName: v.optional(v.string()),
        leadIds: v.array(v.id("leads")),
    },
    handler: async (ctx, args): Promise<{
        campaignId: Id<"outreachCampaigns"> | null;
        enrolledCount: number;
        skippedCount: number;
        requestedCount: number;
        review: LeadEnrollmentReview;
        enrolled: EnrollBatchResult["enrolled"];
        skipped: EnrollBatchResult["skipped"];
    }> => {
        if (args.campaignId) {
            await ctx.runQuery(
                internal.outreach.auth.validateCampaignOwnership,
                { campaignId: args.campaignId },
            );
        }

        const initialReview: LeadEnrollmentReview = await ctx.runQuery(
            internal.outreach.queries.getLeadEnrollmentReviewInternal,
            {
                templateKey: args.templateKey,
                campaignId: args.campaignId,
                leadIds: args.leadIds,
            },
        );

        let resolvedCampaignId = args.campaignId ?? null;
        if (!resolvedCampaignId && initialReview.summary.eligibleCount > 0) {
            if (!args.templateKey) {
                throw new Error("Choose a campaign template before creating a new campaign.");
            }
            const template = getOutreachCampaignTemplate(args.templateKey);
            resolvedCampaignId = await ctx.runMutation(
                api.outreach.mutations.createCampaign,
                {
                    name:
                        args.campaignName?.trim() ||
                        buildDefaultCampaignName(args.templateKey),
                    template_key: args.templateKey,
                    template_version: template.version,
                },
            );
        }

        const enrollResult: EnrollBatchResult = resolvedCampaignId
            ? ((await ctx.runMutation(
                  internal.outreach.campaignLeadState.enrollLeadsInCampaignBatch,
                  {
                      campaign_id: resolvedCampaignId,
                      lead_ids: initialReview.eligibleLeads.map(
                          (lead) => lead.leadId,
                      ),
                      template_key: args.templateKey,
                  },
              )) as EnrollBatchResult)
            : { enrolled: [], skipped: [] };

        const skipped = [
            ...initialReview.conflictLeads.map((lead) => ({
                lead_id: lead.leadId,
                reasons: lead.reasons,
                conflict_campaign_id: lead.conflictCampaignId,
                conflict_campaign_name: lead.conflictCampaignName,
            })),
            ...initialReview.ineligibleLeads.map((lead) => ({
                lead_id: lead.leadId,
                reasons: lead.reasons,
                conflict_campaign_id: lead.conflictCampaignId,
                conflict_campaign_name: lead.conflictCampaignName,
            })),
            ...enrollResult.skipped,
        ];

        return {
            campaignId: resolvedCampaignId,
            enrolledCount: enrollResult.enrolled.length,
            skippedCount: skipped.length,
            requestedCount: args.leadIds.length,
            review: initialReview,
            enrolled: enrollResult.enrolled,
            skipped,
        };
    },
});

export const dispatchQueuedCampaignCall = internalAction({
    args: {
        stateId: v.id("outreachCampaignLeadStates"),
        callId: v.id("outreachCalls"),
        campaignId: v.id("outreachCampaigns"),
        leadId: v.id("leads"),
        dialToNumber: v.string(),
    },
    handler: async (ctx, args) => {
        // Pre-flight ownership check: bail if reconciliation already moved on.
        const stillValid = await ctx.runQuery(
            internal.outreach.campaignLeadState.isDispatchStillValid,
            { stateId: args.stateId, callId: args.callId },
        );
        if (!stillValid) return;

        const dispatchConfig = await ctx.runQuery(
            internal.outreach.queries.getCampaignDispatchConfig,
            { campaignId: args.campaignId },
        );
        const retellApiKey = process.env.RETELL_API_KEY?.trim();
        const configuredFromNumber =
            dispatchConfig.retellOutboundNumber?.trim() ||
            process.env.RETELL_DEFAULT_FROM_NUMBER?.trim() ||
            process.env.RETELL_DEFAULT_PHONE_NUMBER?.trim() ||
            process.env.RETELL_DEFAULT_PHONE_NUMBER_ID?.trim();
        const normalizedFromNumber = configuredFromNumber
            ? normalizePhoneNumber(configuredFromNumber)
            : null;

        if (!retellApiKey || !normalizedFromNumber) {
            await ctx.runMutation(
                internal.outreach.mutations.recordCallDispatchResult,
                {
                    callId: args.callId,
                    error_message:
                        "Missing Retell config for dispatch. Set RETELL_API_KEY and campaign/default outbound number.",
                },
            );
            await ctx.runMutation(
                internal.outreach.campaignLeadState.handleDispatchError,
                {
                    stateId: args.stateId,
                    callId: args.callId,
                    transient: false,
                    error_message:
                        "Missing Retell config for dispatch. Set RETELL_API_KEY and campaign/default outbound number.",
                },
            );
            return;
        }

        if (!isValidPhoneNumber(args.dialToNumber)) {
            await ctx.runMutation(
                internal.outreach.mutations.recordCallDispatchResult,
                {
                    callId: args.callId,
                    error_message: "Destination number is invalid.",
                },
            );
            await ctx.runMutation(
                internal.outreach.campaignLeadState.handleDispatchError,
                {
                    stateId: args.stateId,
                    callId: args.callId,
                    transient: false,
                    error_message: "Destination number is invalid.",
                },
            );
            return;
        }

        try {
            const response = await fetch(
                "https://api.retellai.com/v2/create-phone-call",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${retellApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        from_number: normalizedFromNumber,
                        to_number: args.dialToNumber,
                        override_agent_id: dispatchConfig.retellAgentId,
                        metadata: {
                            campaign_id: String(args.campaignId),
                            lead_id: String(args.leadId),
                            outreach_call_id: String(args.callId),
                        },
                    }),
                },
            );

            if (!response.ok) {
                const errorBody = await response.text();
                const statusCode = response.status;
                const isTransient =
                    statusCode === 429 || statusCode >= 500;
                const errorMessage = `Retell create-phone-call failed (${statusCode}): ${errorBody}`;

                await ctx.runMutation(
                    internal.outreach.mutations.recordCallDispatchResult,
                    {
                        callId: args.callId,
                        error_message: errorMessage,
                    },
                );
                await ctx.runMutation(
                    internal.outreach.campaignLeadState.handleDispatchError,
                    {
                        stateId: args.stateId,
                        callId: args.callId,
                        transient: isTransient,
                        error_message: errorMessage,
                    },
                );
                return;
            }

            const data = (await response.json()) as {
                call_id?: string;
                call_status?: string;
            };
            if (!data.call_id) {
                const errorMessage = "Retell response missing call_id";
                await ctx.runMutation(
                    internal.outreach.mutations.recordCallDispatchResult,
                    {
                        callId: args.callId,
                        error_message: errorMessage,
                    },
                );
                await ctx.runMutation(
                    internal.outreach.campaignLeadState.handleDispatchError,
                    {
                        stateId: args.stateId,
                        callId: args.callId,
                        transient: false,
                        error_message: errorMessage,
                    },
                );
                return;
            }

            await ctx.runMutation(
                internal.outreach.mutations.recordCallDispatchResult,
                {
                    callId: args.callId,
                    retell_call_id: data.call_id,
                    call_status: mapRetellStatus(data.call_status),
                    error_message: null,
                },
            );
        } catch (error) {
            const errorMessage = toErrorMessage(error);
            // Treat network errors as transient.
            await ctx.runMutation(
                internal.outreach.mutations.recordCallDispatchResult,
                {
                    callId: args.callId,
                    error_message: errorMessage,
                },
            );
            await ctx.runMutation(
                internal.outreach.campaignLeadState.handleDispatchError,
                {
                    stateId: args.stateId,
                    callId: args.callId,
                    transient: true,
                    error_message: errorMessage,
                },
            );
        }
    },
});

export const dispatchFollowUpSms = internalAction({
    args: {
        callId: v.id("outreachCalls"),
    },
    handler: async (ctx, args) => {
        const context = (await ctx.runQuery(
            internal.outreach.queries.getFollowUpSmsDispatchContext,
            { callId: args.callId },
        )) as FollowUpSmsDispatchContext | null;
        if (!context) {
            return { callId: args.callId, status: "missing_call" as const };
        }
        if (context.call.follow_up_sms_status !== "pending") {
            return {
                callId: args.callId,
                status: "skipped" as const,
                reason: `SMS dispatch skipped because call status is ${context.call.follow_up_sms_status ?? "unset"}.`,
            };
        }

        const campaign = context.campaign;
        if (!campaign || !campaign.follow_up_sms?.enabled) {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "not_needed",
                },
            );
            return {
                callId: args.callId,
                status: "not_needed" as const,
                reason: "Follow-up SMS is disabled for this campaign.",
            };
        }

        const lead = context.lead;
        if (!lead) {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "failed",
                    follow_up_sms_error: "Lead record is missing.",
                },
            );
            return {
                callId: args.callId,
                status: "failed" as const,
                reason: "Lead record is missing.",
            };
        }

        if (lead.sms_opt_out || lead.do_not_call) {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "opted_out",
                    follow_up_sms_error:
                        "Lead is opted out from outreach SMS sending.",
                },
            );
            return {
                callId: args.callId,
                status: "opted_out" as const,
                reason: "Lead has SMS/DNC compliance block.",
            };
        }

        const outcome = context.call.outcome;
        if (!outcome || outcome === "do_not_call") {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "not_needed",
                    follow_up_sms_error:
                        outcome === "do_not_call"
                            ? "Lead marked do-not-call on call outcome."
                            : "No final call outcome available for SMS routing.",
                },
            );
            return {
                callId: args.callId,
                status: "not_needed" as const,
                reason:
                    outcome === "do_not_call"
                        ? "Outcome is do_not_call."
                        : "Missing final outcome.",
            };
        }
        if (!FOLLOW_UP_SMS_TRIGGER_OUTCOMES.has(outcome)) {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "not_needed",
                    follow_up_sms_error:
                        "Follow-up SMS policy requires no_answer or voicemail_left outcome.",
                },
            );
            return {
                callId: args.callId,
                status: "not_needed" as const,
                reason: "Outcome is not a follow-up SMS trigger outcome.",
            };
        }
        if (context.follow_up_attempts_in_campaign < 3) {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "not_needed",
                    follow_up_sms_error: `Follow-up SMS policy requires at least 3 no_answer/voicemail_left attempts in campaign (current: ${context.follow_up_attempts_in_campaign}).`,
                },
            );
            return {
                callId: args.callId,
                status: "not_needed" as const,
                reason: "Follow-up attempt threshold not met.",
            };
        }

        const routingDecision = resolveShouldSendFollowUpSms({
            campaign,
            outcome,
        });
        if (!routingDecision.shouldSend) {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "not_needed",
                    follow_up_sms_error:
                        "Outcome routing rules do not allow follow-up SMS for this outcome.",
                },
            );
            return {
                callId: args.callId,
                status: "not_needed" as const,
                reason: "Outcome routing excludes SMS for this outcome.",
            };
        }

        const toNumber = normalizePhoneNumber(lead.phone);
        if (!toNumber) {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "failed",
                    follow_up_sms_error:
                        "Lead phone number is invalid for SMS sending.",
                },
            );
            return {
                callId: args.callId,
                status: "failed" as const,
                reason: "Invalid lead phone number.",
            };
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
        const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
        const messagingServiceSid =
            normalizeOptionalString(campaign.twilio_messaging_service_sid) ??
            normalizeOptionalString(
                process.env.TWILIO_DEFAULT_MESSAGING_SERVICE_SID,
            );
        const configuredFromNumber = normalizeOptionalString(
            process.env.TWILIO_PHONE_NUMBER,
        );
        const fromNumber = configuredFromNumber
            ? normalizePhoneNumber(configuredFromNumber)
            : null;

        if (!accountSid || !authToken) {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "failed",
                    follow_up_sms_error:
                        "Twilio credentials are not configured.",
                },
            );
            return {
                callId: args.callId,
                status: "failed" as const,
                reason: "Missing Twilio credentials.",
            };
        }
        if (!messagingServiceSid && !fromNumber) {
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "failed",
                    follow_up_sms_error:
                        "Missing Twilio sender configuration (messaging service SID or from number).",
                },
            );
            return {
                callId: args.callId,
                status: "failed" as const,
                reason: "Missing Twilio sender configuration.",
            };
        }

        const baseTemplate =
            routingDecision.customTemplate ??
            normalizeOptionalString(campaign.follow_up_sms.default_template) ??
            "Hi {{lead_name}}, thanks for connecting with {{campaign_name}}. We'll follow up shortly. Reply STOP to opt out.";
        const body = renderSmsTemplate(baseTemplate, {
            leadName: lead.name,
            campaignName: campaign.name,
            outcome,
            callSummary: context.call.summary ?? "",
        });

        const params = new URLSearchParams({
            To: toNumber,
            Body: body,
        });
        if (messagingServiceSid) {
            params.set("MessagingServiceSid", messagingServiceSid);
        } else if (fromNumber) {
            params.set("From", fromNumber);
        }

        try {
            const authHeader = Buffer.from(
                `${accountSid}:${authToken}`,
                "utf8",
            ).toString("base64");
            const response = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Authorization: `Basic ${authHeader}`,
                    },
                    body: params,
                },
            );

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(
                    `Twilio send failed (${response.status}): ${errorBody}`,
                );
            }

            const data = (await response.json()) as { sid?: string };
            const recordedFromNumber =
                normalizeOptionalString(
                    (data as { from?: string }).from ?? undefined,
                ) ??
                fromNumber ??
                (messagingServiceSid
                    ? `messaging_service:${messagingServiceSid}`
                    : "unknown");

            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "sent",
                    follow_up_sms_sent_at: Date.now(),
                    follow_up_sms_sid: data.sid ?? null,
                },
            );
            await ctx.runMutation(
                internal.outreach.mutations.upsertOutreachSmsMessage,
                {
                    call_id: args.callId,
                    campaign_id: campaign._id,
                    lead_id: lead._id,
                    provider: "twilio",
                    provider_message_sid: data.sid ?? null,
                    provider_messaging_service_sid: messagingServiceSid ?? null,
                    direction: "outbound",
                    body,
                    from_number: recordedFromNumber,
                    to_number: toNumber,
                    status: "sent",
                    sent_at: Date.now(),
                },
            );

            return {
                callId: args.callId,
                status: "sent" as const,
                sid: data.sid ?? null,
            };
        } catch (error) {
            const errorMessage = toErrorMessage(error);
            await ctx.runMutation(
                internal.outreach.mutations.recordFollowUpSmsDispatchResult,
                {
                    callId: args.callId,
                    follow_up_sms_status: "failed",
                    follow_up_sms_error: errorMessage,
                },
            );
            await ctx.runMutation(
                internal.outreach.mutations.upsertOutreachSmsMessage,
                {
                    call_id: args.callId,
                    campaign_id: campaign._id,
                    lead_id: lead._id,
                    provider: "twilio",
                    provider_messaging_service_sid: messagingServiceSid ?? null,
                    direction: "outbound",
                    body,
                    from_number:
                        fromNumber ??
                        (messagingServiceSid
                            ? `messaging_service:${messagingServiceSid}`
                            : "unknown"),
                    to_number: toNumber,
                    status: "failed",
                    error_message: errorMessage,
                    sent_at: Date.now(),
                },
            );
            return {
                callId: args.callId,
                status: "failed" as const,
                reason: errorMessage,
            };
        }
    },
});

export const sendCampaignConversationSms = action({
    args: {
        campaignId: v.id("outreachCampaigns"),
        leadId: v.id("leads"),
        callId: v.optional(v.id("outreachCalls")),
        body: v.string(),
    },
    handler: async (ctx, args) => {
        const normalizedBody = args.body.trim();
        if (!normalizedBody) {
            throw new Error("Message body is required.");
        }
        if (normalizedBody.length > 1200) {
            throw new Error("Message body exceeds 1200 character limit.");
        }

        // Public query enforces campaign ownership for the authenticated user.
        const conversation = await ctx.runQuery(
            api.outreach.queries.getCampaignLeadConversation,
            {
                campaignId: args.campaignId,
                leadId: args.leadId,
            },
        );
        if (!conversation) {
            throw new Error("Unable to resolve SMS conversation context.");
        }
        const selectedCallId =
            args.callId ?? conversation.latestCallId ?? undefined;

        const context = selectedCallId
            ? ((await ctx.runQuery(
                  internal.outreach.queries.getFollowUpSmsDispatchContext,
                  { callId: selectedCallId },
              )) as FollowUpSmsDispatchContext | null)
            : null;
        const isContextMismatch =
            context &&
            (context.call.lead_id !== args.leadId ||
                context.call.campaign_id !== args.campaignId);
        if (isContextMismatch) {
            throw new Error(
                "Call context does not belong to selected lead/campaign.",
            );
        }

        const campaignFromCallContext = context?.campaign ?? null;
        const leadFromCallContext = context?.lead ?? null;
        const campaign = campaignFromCallContext ?? {
            _id: conversation.campaign._id,
            name: conversation.campaign.name,
            twilio_messaging_service_sid:
                conversation.campaign.twilioMessagingServiceSid,
            follow_up_sms: null,
            outcome_routing: null,
        };
        const lead = leadFromCallContext ?? {
            _id: conversation.lead._id,
            name: conversation.lead.name,
            phone: conversation.lead.phone,
            do_not_call: conversation.lead.doNotCall,
            sms_opt_out: conversation.lead.smsOptOut,
        };
        if (lead.do_not_call || lead.sms_opt_out) {
            throw new Error(
                "Lead has a compliance block and cannot receive SMS.",
            );
        }

        const toNumber = normalizePhoneNumber(lead.phone);
        if (!toNumber) {
            throw new Error("Lead phone number is invalid for SMS sending.");
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
        const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
        const messagingServiceSid =
            normalizeOptionalString(campaign.twilio_messaging_service_sid) ??
            normalizeOptionalString(
                process.env.TWILIO_DEFAULT_MESSAGING_SERVICE_SID,
            );
        const configuredFromNumber = normalizeOptionalString(
            process.env.TWILIO_PHONE_NUMBER,
        );
        const fromNumber = configuredFromNumber
            ? normalizePhoneNumber(configuredFromNumber)
            : null;

        if (!accountSid || !authToken) {
            throw new Error("Twilio credentials are not configured.");
        }
        if (!messagingServiceSid && !fromNumber) {
            throw new Error(
                "Missing Twilio sender configuration (messaging service SID or from number).",
            );
        }

        const params = new URLSearchParams({
            To: toNumber,
            Body: normalizedBody,
        });
        if (messagingServiceSid) {
            params.set("MessagingServiceSid", messagingServiceSid);
        } else if (fromNumber) {
            params.set("From", fromNumber);
        }

        const sentAt = Date.now();
        try {
            const authHeader = Buffer.from(
                `${accountSid}:${authToken}`,
                "utf8",
            ).toString("base64");
            const response = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Authorization: `Basic ${authHeader}`,
                    },
                    body: params,
                },
            );

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(
                    `Twilio send failed (${response.status}): ${errorBody}`,
                );
            }

            const data = (await response.json()) as {
                sid?: string;
                from?: string;
                to?: string;
                status?: string;
            };
            await ctx.runMutation(
                internal.outreach.mutations.upsertOutreachSmsMessage,
                {
                    call_id: selectedCallId ?? null,
                    campaign_id: campaign._id,
                    lead_id: lead._id,
                    provider: "twilio",
                    provider_message_sid: data.sid ?? null,
                    provider_messaging_service_sid: messagingServiceSid ?? null,
                    direction: "outbound",
                    body: normalizedBody,
                    from_number:
                        normalizeOptionalString(data.from) ??
                        fromNumber ??
                        (messagingServiceSid
                            ? `messaging_service:${messagingServiceSid}`
                            : "unknown"),
                    to_number: normalizeOptionalString(data.to) ?? toNumber,
                    status: normalizeTwilioMessageStatus(data.status),
                    sent_at: sentAt,
                },
            );

            return {
                status: "sent" as const,
                sid: data.sid ?? null,
            };
        } catch (error) {
            const errorMessage = toErrorMessage(error);
            await ctx.runMutation(
                internal.outreach.mutations.upsertOutreachSmsMessage,
                {
                    call_id: selectedCallId ?? null,
                    campaign_id: campaign._id,
                    lead_id: lead._id,
                    provider: "twilio",
                    provider_messaging_service_sid: messagingServiceSid ?? null,
                    direction: "outbound",
                    body: normalizedBody,
                    from_number:
                        fromNumber ??
                        (messagingServiceSid
                            ? `messaging_service:${messagingServiceSid}`
                            : "unknown"),
                    to_number: toNumber,
                    status: "failed",
                    error_message: errorMessage,
                    sent_at: sentAt,
                },
            );
            throw new Error(errorMessage);
        }
    },
});
