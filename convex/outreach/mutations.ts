import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { type MutationCtx } from "../_generated/server";
import {
    internalMutationWithCounters as internalMutation,
    mutationWithCounters as mutation,
} from "./counterTriggers";
import { v } from "convex/values";
import { normalizePhoneNumber } from "./phone";
import { getCurrentUserIdOrThrow } from "./auth";
import {
    buildTemplateDefinitionFromCustomTemplate,
    getOutreachCampaignTemplate,
    normalizeAgentInstructions,
    outreachAgentInstructionsValidator,
    outreachCampaignTemplateKeyValidator,
} from "./templates";

const STALE_QUEUED_OR_RINGING_TIMEOUT_MS = 20 * 60 * 1000;
const STALE_IN_PROGRESS_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const FIXED_FOLLOW_UP_SMS_DELAY_MINUTES = 3;


const WEEKDAY_VALIDATOR = v.union(
    v.literal(0),
    v.literal(1),
    v.literal(2),
    v.literal(3),
    v.literal(4),
    v.literal(5),
    v.literal(6),
);

const LEAD_STATUS_VALIDATOR = v.union(
    v.literal("new"),
    v.literal("contacted"),
    v.literal("qualified"),
);

const BUYER_PIPELINE_STAGE_VALIDATOR = v.union(
    v.literal("searching"),
    v.literal("showings"),
    v.literal("offer_out"),
    v.literal("under_contract"),
    v.literal("closed"),
);

const SELLER_PIPELINE_STAGE_VALIDATOR = v.union(
    v.literal("pre_listing"),
    v.literal("on_market"),
    v.literal("offer_in"),
    v.literal("under_contract"),
    v.literal("sold"),
);

const CAMPAIGN_LEAD_OUTCOME_ACTION_VALIDATOR = v.union(
    v.literal("continue"),
    v.literal("stop_calling"),
    v.literal("pause_for_realtor"),
);

const OUTCOME_VALIDATOR = v.union(
    v.literal("connected_interested"),
    v.literal("connected_not_interested"),
    v.literal("callback_requested"),
    v.literal("voicemail_left"),
    v.literal("no_answer"),
    v.literal("wrong_number"),
    v.literal("do_not_call"),
    v.literal("failed"),
);

const OUTCOME_ROUTING_VALIDATOR = v.array(
    v.object({
        outcome: OUTCOME_VALIDATOR,
        next_lead_status: v.optional(LEAD_STATUS_VALIDATOR),
        next_buyer_pipeline_stage: v.optional(BUYER_PIPELINE_STAGE_VALIDATOR),
        next_seller_pipeline_stage: v.optional(SELLER_PIPELINE_STAGE_VALIDATOR),
        send_follow_up_sms: v.optional(v.boolean()),
        custom_sms_template: v.optional(v.string()),
        campaign_lead_action: v.optional(
            CAMPAIGN_LEAD_OUTCOME_ACTION_VALIDATOR,
        ),
    }),
);

const FOLLOW_UP_SMS_VALIDATOR = v.object({
    enabled: v.boolean(),
    delay_minutes: v.number(),
    default_template: v.optional(v.string()),
    send_only_on_outcomes: v.optional(v.array(OUTCOME_VALIDATOR)),
});

const CALLING_WINDOW_VALIDATOR = v.object({
    start_hour_local: v.number(),
    start_minute_local: v.optional(v.number()),
    end_hour_local: v.number(),
    end_minute_local: v.optional(v.number()),
    allowed_weekdays: v.array(WEEKDAY_VALIDATOR),
});

type OutcomeRoutingRule = NonNullable<
    Doc<"outreachCampaigns">["outcome_routing"]
>[number];

const TERMINAL_OUTCOMES: ReadonlySet<Doc<"outreachCalls">["outcome"]> =
    new Set(["do_not_call", "wrong_number"]);
const SMS_TRIGGER_OUTCOMES: ReadonlySet<Doc<"outreachCalls">["outcome"]> =
    new Set(["no_answer", "voicemail_left"]);

function getDefaultCampaignLeadAction(
    outcome: Doc<"outreachCalls">["outcome"],
): OutcomeRoutingRule["campaign_lead_action"] {
    switch (outcome) {
        case "connected_interested":
        case "connected_not_interested":
            return "stop_calling";
        case "callback_requested":
            return "pause_for_realtor";
        default:
            return "continue";
    }
}

function validateCallingWindow(
    window: {
        start_hour_local: number;
        start_minute_local?: number;
        end_hour_local: number;
        end_minute_local?: number;
        allowed_weekdays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
    } | undefined,
): void {
    if (!window) {
        return;
    }

    const values = [
        window.start_hour_local,
        window.end_hour_local,
        window.start_minute_local ?? 0,
        window.end_minute_local ?? 0,
    ];
    if (values.some((value) => !Number.isFinite(value))) {
        throw new Error("Calling window is invalid.");
    }
    if (
        window.start_hour_local < 0 ||
        window.start_hour_local > 23 ||
        window.end_hour_local < 0 ||
        window.end_hour_local > 23
    ) {
        throw new Error("Calling window hours must be between 0 and 23.");
    }
    if (
        (window.start_minute_local ?? 0) < 0 ||
        (window.start_minute_local ?? 0) > 59 ||
        (window.end_minute_local ?? 0) < 0 ||
        (window.end_minute_local ?? 0) > 59
    ) {
        throw new Error("Calling window minutes must be between 0 and 59.");
    }
    if (window.allowed_weekdays.length === 0) {
        throw new Error("Choose at least one calling day.");
    }
}

function sanitizeOutcomeRouting(
    rules: OutcomeRoutingRule[],
): OutcomeRoutingRule[] {
    return rules.map((rule) => {
        if (TERMINAL_OUTCOMES.has(rule.outcome)) {
            return {
                outcome: rule.outcome,
                send_follow_up_sms: false,
            };
        }

        const customSmsTemplate = normalizeOptionalString(
            rule.custom_sms_template,
        );
        const sanitized: OutcomeRoutingRule = {
            outcome: rule.outcome,
        };
        if (rule.next_lead_status !== undefined) {
            sanitized.next_lead_status = rule.next_lead_status;
        }
        if (rule.next_buyer_pipeline_stage !== undefined) {
            sanitized.next_buyer_pipeline_stage =
                rule.next_buyer_pipeline_stage;
        }
        if (rule.next_seller_pipeline_stage !== undefined) {
            sanitized.next_seller_pipeline_stage =
                rule.next_seller_pipeline_stage;
        }
        sanitized.campaign_lead_action =
            rule.campaign_lead_action ?? getDefaultCampaignLeadAction(rule.outcome);
        if (SMS_TRIGGER_OUTCOMES.has(rule.outcome)) {
            if (rule.send_follow_up_sms !== undefined) {
                sanitized.send_follow_up_sms = rule.send_follow_up_sms;
            }
            if (rule.send_follow_up_sms !== false && customSmsTemplate) {
                sanitized.custom_sms_template = customSmsTemplate;
            }
        } else {
            sanitized.send_follow_up_sms = false;
        }
        return sanitized;
    });
}

const OUTREACH_SMS_DIRECTION_VALIDATOR = v.union(
    v.literal("inbound"),
    v.literal("outbound"),
);

const OUTREACH_SMS_STATUS_VALIDATOR = v.union(
    v.literal("queued"),
    v.literal("accepted"),
    v.literal("sending"),
    v.literal("sent"),
    v.literal("delivered"),
    v.literal("undelivered"),
    v.literal("failed"),
    v.literal("receiving"),
    v.literal("received"),
    v.literal("read"),
    v.literal("canceled"),
    v.literal("unknown"),
);


function normalizeOptionalString(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function normalizeSmsStatus(
    value?: string,
): Doc<"outreachSmsMessages">["status"] {
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

const OUTBOUND_SMS_SUCCESS_TERMINAL_STATUSES = new Set<
    Doc<"outreachSmsMessages">["status"]
>(["delivered", "read"]);
const OUTBOUND_SMS_FAILURE_TERMINAL_STATUSES = new Set<
    Doc<"outreachSmsMessages">["status"]
>(["undelivered", "failed", "canceled"]);
const OUTBOUND_SMS_PROGRESS_ORDER: Partial<
    Record<Doc<"outreachSmsMessages">["status"], number>
> = {
    unknown: 0,
    queued: 1,
    accepted: 1,
    sending: 2,
    sent: 3,
};

function resolveSmsStatusTransition(args: {
    currentStatus: Doc<"outreachSmsMessages">["status"];
    incomingStatus: Doc<"outreachSmsMessages">["status"];
    direction: Doc<"outreachSmsMessages">["direction"];
}): Doc<"outreachSmsMessages">["status"] {
    const { currentStatus, incomingStatus, direction } = args;
    if (currentStatus === incomingStatus) {
        return currentStatus;
    }
    if (direction === "inbound") {
        if (currentStatus === "read" || incomingStatus === "read") {
            return "read";
        }
        if (currentStatus === "received" || incomingStatus === "received") {
            return "received";
        }
        if (currentStatus === "unknown") {
            return incomingStatus;
        }
        if (incomingStatus === "unknown") {
            return currentStatus;
        }
        return incomingStatus;
    }

    if (
        OUTBOUND_SMS_SUCCESS_TERMINAL_STATUSES.has(currentStatus) ||
        OUTBOUND_SMS_FAILURE_TERMINAL_STATUSES.has(currentStatus)
    ) {
        return currentStatus;
    }
    if (
        OUTBOUND_SMS_SUCCESS_TERMINAL_STATUSES.has(incomingStatus) ||
        OUTBOUND_SMS_FAILURE_TERMINAL_STATUSES.has(incomingStatus)
    ) {
        return incomingStatus;
    }

    const currentOrder = OUTBOUND_SMS_PROGRESS_ORDER[currentStatus] ?? -1;
    const incomingOrder = OUTBOUND_SMS_PROGRESS_ORDER[incomingStatus] ?? -1;
    return incomingOrder >= currentOrder ? incomingStatus : currentStatus;
}

function resolveInboundOptOutUpdate(messageBody: string): boolean | undefined {
    const keyword = messageBody.trim().split(/\s+/)[0]?.toLowerCase();
    if (!keyword) {
        return undefined;
    }
    if (
        keyword === "stop" ||
        keyword === "unsubscribe" ||
        keyword === "cancel" ||
        keyword === "end" ||
        keyword === "quit" ||
        keyword === "stopall" ||
        keyword === "revoke" ||
        keyword === "optout"
    ) {
        return true;
    }
    if (
        keyword === "start" ||
        keyword === "unstop" ||
        keyword === "yes" ||
        keyword === "optin"
    ) {
        return false;
    }
    return undefined;
}

async function resolveOutreachCallId(
    ctx: MutationCtx,
    rawId?: string,
): Promise<Id<"outreachCalls"> | undefined> {
    const normalized = normalizeOptionalString(rawId);
    if (!normalized) {
        return undefined;
    }
    try {
        const callId = normalized as Id<"outreachCalls">;
        const call = await ctx.db.get(callId);
        return call ? callId : undefined;
    } catch {
        return undefined;
    }
}

async function resolveCampaignId(
    ctx: MutationCtx,
    rawId?: string,
): Promise<Id<"outreachCampaigns"> | undefined> {
    const normalized = normalizeOptionalString(rawId);
    if (!normalized) {
        return undefined;
    }
    try {
        const campaignId = normalized as Id<"outreachCampaigns">;
        const campaign = await ctx.db.get(campaignId);
        return campaign ? campaignId : undefined;
    } catch {
        return undefined;
    }
}

async function resolveLeadId(
    ctx: MutationCtx,
    rawId?: string,
): Promise<Id<"leads"> | undefined> {
    const normalized = normalizeOptionalString(rawId);
    if (!normalized) {
        return undefined;
    }
    try {
        const leadId = normalized as Id<"leads">;
        const lead = await ctx.db.get(leadId);
        return lead ? leadId : undefined;
    } catch {
        return undefined;
    }
}

export const createCampaign = mutation({
    args: {
        name: v.string(),
        description: v.optional(v.string()),
        template_key: v.optional(outreachCampaignTemplateKeyValidator),
        custom_template_id: v.optional(v.id("outreachCampaignTemplates")),
        template_version: v.optional(v.number()),
        agent_instructions: v.optional(outreachAgentInstructionsValidator),
        status: v.optional(
            v.union(
                v.literal("draft"),
                v.literal("active"),
                v.literal("paused"),
                v.literal("completed"),
                v.literal("archived"),
            ),
        ),
        retell_agent_id: v.optional(v.string()),
        retell_phone_number_id: v.optional(v.string()),
        twilio_messaging_service_sid: v.optional(v.string()),
        timezone: v.optional(v.string()),
        calling_window: v.optional(CALLING_WINDOW_VALIDATOR),
        retry_policy: v.optional(
            v.object({
                max_attempts: v.number(),
                min_minutes_between_attempts: v.number(),
            }),
        ),
        outcome_routing: v.optional(OUTCOME_ROUTING_VALIDATOR),
        follow_up_sms: v.optional(FOLLOW_UP_SMS_VALIDATOR),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        validateCallingWindow(args.calling_window);
        const now = Date.now();
        const envRetellAgentId = process.env.RETELL_DEFAULT_AGENT_ID?.trim();
        const envRetellPhoneNumberId =
            process.env.RETELL_DEFAULT_PHONE_NUMBER_ID?.trim();
        const envTwilioMessagingServiceSid =
            process.env.TWILIO_DEFAULT_MESSAGING_SERVICE_SID?.trim();
        const envDefaultTimezone =
            process.env.OUTREACH_DEFAULT_TIMEZONE?.trim();
        const customTemplate = args.custom_template_id
            ? await ctx.db.get(args.custom_template_id)
            : null;
        if (
            args.custom_template_id &&
            (!customTemplate || customTemplate.owner_user_id !== userId)
        ) {
            throw new Error("Campaign template not found.");
        }
        const template = customTemplate
            ? buildTemplateDefinitionFromCustomTemplate(customTemplate)
            : args.template_key
              ? getOutreachCampaignTemplate(args.template_key)
              : null;

        const resolvedRetellAgentId =
            args.retell_agent_id?.trim() || envRetellAgentId;
        if (!resolvedRetellAgentId) {
            throw new Error(
                "Missing Retell agent ID. Set RETELL_DEFAULT_AGENT_ID or provide a campaign override.",
            );
        }

        const resolvedRetellPhoneNumberId =
            args.retell_phone_number_id?.trim() || envRetellPhoneNumberId;
        const resolvedTwilioMessagingServiceSid =
            args.twilio_messaging_service_sid?.trim() ||
            envTwilioMessagingServiceSid;
        const resolvedTimezone =
            args.timezone?.trim() ||
            envDefaultTimezone ||
            "America/Los_Angeles";
        const templateVersion = template?.version ?? args.template_version;

        if (
            template &&
            args.template_version !== undefined &&
            args.template_version !== template.version
        ) {
            throw new Error(
                `Campaign template version mismatch. Expected v${template.version}.`,
            );
        }

        return await ctx.db.insert("outreachCampaigns", {
            name: args.name.trim(),
            description: args.description?.trim() || undefined,
            status: args.status ?? "active",
            template_key: template?.key,
            custom_template_id: customTemplate?._id,
            template_version: templateVersion,
            campaign_focus: template?.focus,
            agent_instructions: args.agent_instructions
                ? normalizeAgentInstructions(args.agent_instructions)
                : template?.agentInstructions
                  ? normalizeAgentInstructions(template.agentInstructions)
                : undefined,
            retell_agent_id: resolvedRetellAgentId,
            retell_phone_number_id: resolvedRetellPhoneNumberId || undefined,
            twilio_messaging_service_sid:
                resolvedTwilioMessagingServiceSid || undefined,
            timezone: resolvedTimezone,
            calling_window: args.calling_window ?? template?.callingWindow ?? {
                start_hour_local: 9,
                start_minute_local: 0,
                end_hour_local: 18,
                end_minute_local: 0,
                allowed_weekdays: [1, 2, 3, 4, 5],
            },
            retry_policy: args.retry_policy ?? template?.retryPolicy ?? {
                max_attempts: 3,
                min_minutes_between_attempts: 60,
            },
            follow_up_sms: {
                enabled:
                    args.follow_up_sms?.enabled ??
                    template?.followUpSms.enabled ??
                    true,
                delay_minutes: FIXED_FOLLOW_UP_SMS_DELAY_MINUTES,
                default_template:
                    args.follow_up_sms?.default_template?.trim() ||
                    template?.followUpSms.default_template ||
                    undefined,
                send_only_on_outcomes: args.follow_up_sms
                    ?.send_only_on_outcomes ??
                    template?.followUpSms.send_only_on_outcomes ??
                    ["no_answer", "voicemail_left"],
            },
            outcome_routing: args.outcome_routing
                ? sanitizeOutcomeRouting(args.outcome_routing)
                : template?.outcomeRouting,
            created_by_user_id: userId,
            created_at: now,
            updated_at: now,
        });
    },
});

export const updateCampaignSettings = mutation({
    args: {
        campaignId: v.id("outreachCampaigns"),
        name: v.optional(v.string()),
        description: v.optional(v.union(v.string(), v.null())),
        status: v.optional(
            v.union(
                v.literal("draft"),
                v.literal("active"),
                v.literal("paused"),
                v.literal("completed"),
                v.literal("archived"),
            ),
        ),
        timezone: v.optional(v.string()),
        agent_instructions: v.optional(
            v.union(outreachAgentInstructionsValidator, v.null()),
        ),
        retell_agent_id: v.optional(v.union(v.string(), v.null())),
        retell_phone_number_id: v.optional(v.union(v.string(), v.null())),
        twilio_messaging_service_sid: v.optional(v.union(v.string(), v.null())),
        calling_window: v.optional(CALLING_WINDOW_VALIDATOR),
        retry_policy: v.optional(
            v.object({
                max_attempts: v.number(),
                min_minutes_between_attempts: v.number(),
            }),
        ),
        outcome_routing: v.optional(
            v.union(OUTCOME_ROUTING_VALIDATOR, v.null()),
        ),
        follow_up_sms: v.optional(v.union(FOLLOW_UP_SMS_VALIDATOR, v.null())),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        validateCallingWindow(args.calling_window);
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }
        if (campaign.created_by_user_id !== userId) {
            throw new Error("Campaign not found");
        }
        const updatesOnlyStatus =
            args.name === undefined &&
            args.description === undefined &&
            args.timezone === undefined &&
            args.agent_instructions === undefined &&
            args.retell_agent_id === undefined &&
            args.retell_phone_number_id === undefined &&
            args.twilio_messaging_service_sid === undefined &&
            args.calling_window === undefined &&
            args.retry_policy === undefined &&
            args.outcome_routing === undefined &&
            args.follow_up_sms === undefined;
        if (campaign.status === "active" && !updatesOnlyStatus) {
            throw new Error(
                "Pause this campaign before editing its runtime settings.",
            );
        }

        const updates: Record<string, unknown> = {
            updated_at: Date.now(),
        };

        if (args.name !== undefined) {
            updates.name = args.name.trim();
        }
        if (args.description !== undefined) {
            updates.description = args.description?.trim() || undefined;
        }
        if (args.status !== undefined) {
            updates.status = args.status;
        }
        if (args.timezone !== undefined) {
            updates.timezone = args.timezone.trim();
        }
        if (args.agent_instructions !== undefined) {
            updates.agent_instructions = args.agent_instructions
                ? normalizeAgentInstructions(args.agent_instructions)
                : undefined;
        }
        if (args.retell_agent_id !== undefined) {
            updates.retell_agent_id = args.retell_agent_id?.trim() || undefined;
        }
        if (args.retell_phone_number_id !== undefined) {
            updates.retell_phone_number_id =
                args.retell_phone_number_id?.trim() || undefined;
        }
        if (args.twilio_messaging_service_sid !== undefined) {
            updates.twilio_messaging_service_sid =
                args.twilio_messaging_service_sid?.trim() || undefined;
        }
        if (args.calling_window !== undefined) {
            updates.calling_window = args.calling_window;
        }
        if (args.retry_policy !== undefined) {
            updates.retry_policy = args.retry_policy;
        }
        if (args.outcome_routing !== undefined) {
            updates.outcome_routing = args.outcome_routing
                ? sanitizeOutcomeRouting(args.outcome_routing)
                : undefined;
        }
        if (args.follow_up_sms !== undefined) {
            updates.follow_up_sms = args.follow_up_sms
                ? {
                      ...args.follow_up_sms,
                      delay_minutes: FIXED_FOLLOW_UP_SMS_DELAY_MINUTES,
                  }
                : undefined;
        }

        await ctx.db.patch(args.campaignId, updates);
        return await ctx.db.get(args.campaignId);
    },
});

export const deleteCampaign = mutation({
    args: {
        campaignId: v.id("outreachCampaigns"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }
        if (campaign.created_by_user_id !== userId) {
            throw new Error("Campaign not found");
        }

        const existingCall = await ctx.db
            .query("outreachCalls")
            .withIndex("by_campaign_id", (q) =>
                q.eq("campaign_id", args.campaignId),
            )
            .first();
        if (existingCall) {
            throw new Error(
                "Cannot delete campaign with call history. Archive it instead.",
            );
        }

        await ctx.db.delete(args.campaignId);
        return null;
    },
});

export const recordCallDispatchResult = internalMutation({
    args: {
        callId: v.id("outreachCalls"),
        call_status: v.optional(
            v.union(
                v.literal("queued"),
                v.literal("ringing"),
                v.literal("in_progress"),
                v.literal("completed"),
                v.literal("failed"),
                v.literal("canceled"),
            ),
        ),
        retell_call_id: v.optional(v.union(v.string(), v.null())),
        error_message: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.callId);
        if (!existing) {
            throw new Error("Outreach call not found");
        }

        const updates: Partial<Doc<"outreachCalls">> = {
            updated_at: Date.now(),
        };

        if (args.call_status !== undefined) {
            updates.call_status = args.call_status;
            if (args.call_status === "in_progress" && !existing.started_at) {
                updates.started_at = Date.now();
            }
        }
        if (args.retell_call_id !== undefined) {
            updates.retell_call_id = args.retell_call_id ?? undefined;
        }
        if (args.error_message !== undefined) {
            updates.error_message = args.error_message ?? undefined;
            if (args.error_message) {
                updates.call_status = "failed";
            }
        }

        await ctx.db.patch(args.callId, updates);
        return await ctx.db.get(args.callId);
    },
});

type NormalizedOutcome = Exclude<Doc<"outreachCalls">["outcome"], undefined>;

const SUPPORTED_RETELL_FINAL_EVENT_TYPES = new Set([
    "call_ended",
    "call_analyzed",
]);
const SUPPORTED_RETELL_EVENT_TYPES = new Set([
    "call_started",
    ...SUPPORTED_RETELL_FINAL_EVENT_TYPES,
]);

const OUTCOME_ALIAS_MAP: Record<string, NormalizedOutcome> = {
    connected_interested: "connected_interested",
    interested: "connected_interested",
    qualified: "connected_interested",
    connected_not_interested: "connected_not_interested",
    not_interested: "connected_not_interested",
    uninterested: "connected_not_interested",
    no_interest: "connected_not_interested",
    callback_requested: "callback_requested",
    callback: "callback_requested",
    call_back: "callback_requested",
    voicemail_left: "voicemail_left",
    voicemail: "voicemail_left",
    no_answer: "no_answer",
    unanswered: "no_answer",
    wrong_number: "wrong_number",
    do_not_call: "do_not_call",
    dnc: "do_not_call",
    failed: "failed",
    failure: "failed",
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim();
    return normalized ? normalized : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value !== "string") {
        return undefined;
    }
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
}

function asTimestampMs(value: unknown): number | undefined {
    const rawNumber = asNumber(value);
    if (rawNumber === undefined) {
        return undefined;
    }
    if (rawNumber < 10_000_000_000) {
        return Math.trunc(rawNumber * 1000);
    }
    return Math.trunc(rawNumber);
}

function normalizeOutcomeKey(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function normalizeOutcomeCandidate(
    rawOutcome?: string,
): NormalizedOutcome | undefined {
    if (!rawOutcome) {
        return undefined;
    }
    const key = normalizeOutcomeKey(rawOutcome);
    return OUTCOME_ALIAS_MAP[key];
}

function resolveOutcome(args: {
    normalizedOutcome?: string;
    disconnectionReason?: string;
    callSuccessful?: boolean;
    inVoicemail?: boolean;
    callStatus?: string;
}): NormalizedOutcome {
    const normalized = normalizeOutcomeCandidate(args.normalizedOutcome);
    if (normalized) {
        return normalized;
    }

    const reason = args.disconnectionReason?.toLowerCase() ?? "";
    if (reason.includes("wrong_number") || reason.includes("wrong number")) {
        return "wrong_number";
    }
    if (
        reason.includes("do_not_call") ||
        reason.includes("do not call") ||
        reason.includes("dnc")
    ) {
        return "do_not_call";
    }
    if (reason.includes("voicemail") || reason.includes("machine")) {
        return "voicemail_left";
    }
    if (
        reason.includes("no_answer") ||
        reason.includes("no answer") ||
        reason.includes("busy") ||
        reason.includes("unanswered")
    ) {
        return "no_answer";
    }
    if (reason.includes("user_hangup") || reason.includes("agent_hangup")) {
        return args.callSuccessful
            ? "connected_interested"
            : "connected_not_interested";
    }

    if (args.inVoicemail) {
        return "voicemail_left";
    }
    if (args.callSuccessful) {
        return "connected_interested";
    }

    const status = args.callStatus?.toLowerCase();
    if (status === "error" || status === "failed" || status === "canceled") {
        return "failed";
    }
    return "failed";
}

function mapRetellCallStatus(
    status?: string,
    eventType?: string,
): Doc<"outreachCalls">["call_status"] {
    switch (status?.toLowerCase()) {
        case "registered":
        case "not_connected":
            return "queued";
        case "ongoing":
        case "in_progress":
            return "in_progress";
        case "ended":
            return "completed";
        case "error":
        case "failed":
            return "failed";
        case "canceled":
        case "cancelled":
            return "canceled";
        default:
            return SUPPORTED_RETELL_FINAL_EVENT_TYPES.has(eventType ?? "")
                ? "completed"
                : "queued";
    }
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "Unexpected webhook processing error";
}

function extractRetellCallPayload(
    payload: unknown,
): Record<string, unknown> | null {
    const root = asRecord(payload);
    const rootData = asRecord(root?.data);
    return asRecord(root?.call) ?? asRecord(rootData?.call);
}

function buildExtractedData(
    callPayload: Record<string, unknown>,
    callAnalysis: Record<string, unknown> | null,
    customAnalysisData: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
    const extractedData: Record<string, unknown> = {};
    if (callAnalysis) {
        extractedData.call_analysis = callAnalysis;
    }
    if (customAnalysisData) {
        extractedData.custom_analysis_data = customAnalysisData;
    }

    const passthroughKeys = [
        "latency",
        "llm_token_usage",
        "call_cost",
        "disconnection_reason",
        "transcript_object",
        "transcript_with_tool_calls",
        "public_log_url",
        "recording_multi_channel_url",
        "from_number",
        "to_number",
    ] as const;
    for (const key of passthroughKeys) {
        const value = callPayload[key];
        if (value !== undefined) {
            extractedData[key] = value;
        }
    }

    return Object.keys(extractedData).length > 0 ? extractedData : undefined;
}

async function queueFollowUpSmsAfterFinalOutcome(
    ctx: MutationCtx,
    args: {
        callId: Id<"outreachCalls">;
        campaign: Doc<"outreachCampaigns"> | null;
        lead: Doc<"leads"> | null;
        outcome: NormalizedOutcome;
    },
): Promise<void> {
    const latestCall = await ctx.db.get(args.callId);
    if (!latestCall) {
        return;
    }
    if (
        latestCall.follow_up_sms_status !== undefined &&
        latestCall.follow_up_sms_status !== "not_needed"
    ) {
        return;
    }

    const now = Date.now();
    const campaignFollowUpConfig = args.campaign?.follow_up_sms;
    if (!campaignFollowUpConfig?.enabled) {
        await ctx.db.patch(args.callId, {
            follow_up_sms_status: "not_needed",
            follow_up_sms_error:
                "Follow-up SMS is disabled or campaign is not configured.",
            updated_at: now,
        });
        return;
    }

    if (!args.lead) {
        await ctx.db.patch(args.callId, {
            follow_up_sms_status: "failed",
            follow_up_sms_error: "Lead record is missing for follow-up SMS.",
            updated_at: now,
        });
        return;
    }
    const lead = args.lead;

    if (
        lead.sms_opt_out === true ||
        lead.do_not_call === true ||
        args.outcome === "do_not_call"
    ) {
        await ctx.db.patch(args.callId, {
            follow_up_sms_status: "opted_out",
            follow_up_sms_error:
                "Lead has an SMS or do-not-call compliance block.",
            updated_at: now,
        });
        return;
    }

    const isSmsTriggerOutcome =
        args.outcome === "no_answer" || args.outcome === "voicemail_left";
    if (!isSmsTriggerOutcome) {
        await ctx.db.patch(args.callId, {
            follow_up_sms_status: "not_needed",
            follow_up_sms_error:
                "Follow-up SMS policy requires no_answer or voicemail_left outcome.",
            updated_at: now,
        });
        return;
    }

    const allowedOutcomes = campaignFollowUpConfig.send_only_on_outcomes;
    const expandedAllowedOutcomes = new Set(allowedOutcomes ?? []);
    if (expandedAllowedOutcomes.has("no_answer")) {
        expandedAllowedOutcomes.add("voicemail_left");
    }
    if (
        allowedOutcomes &&
        allowedOutcomes.length > 0 &&
        !expandedAllowedOutcomes.has(args.outcome)
    ) {
        await ctx.db.patch(args.callId, {
            follow_up_sms_status: "not_needed",
            follow_up_sms_error:
                "Campaign follow-up SMS outcome filters do not include this outcome.",
            updated_at: now,
        });
        return;
    }

    const routeRule = args.campaign?.outcome_routing?.find(
        (rule) => rule.outcome === args.outcome,
    );
    if (routeRule?.send_follow_up_sms === false) {
        await ctx.db.patch(args.callId, {
            follow_up_sms_status: "not_needed",
            follow_up_sms_error:
                "Outcome routing disabled follow-up SMS for this outcome.",
            updated_at: now,
        });
        return;
    }

    // Use state row count instead of unbounded call history scan.
    let followUpAttemptsInCampaign = 0;
    if (args.campaign) {
        const stateRow = await ctx.db
            .query("outreachCampaignLeadStates")
            .withIndex("by_campaign_id_and_lead_id", (q) =>
                q
                    .eq("campaign_id", args.campaign!._id)
                    .eq("lead_id", lead._id),
            )
            .first();
        followUpAttemptsInCampaign =
            stateRow?.no_answer_or_voicemail_count ?? 0;
    }
    if (followUpAttemptsInCampaign < 3) {
        await ctx.db.patch(args.callId, {
            follow_up_sms_status: "not_needed",
            follow_up_sms_error: `Follow-up SMS policy requires at least 3 no_answer/voicemail_left attempts in campaign (current: ${followUpAttemptsInCampaign}).`,
            updated_at: now,
        });
        return;
    }

    const delayMinutes = FIXED_FOLLOW_UP_SMS_DELAY_MINUTES;
    await ctx.db.patch(args.callId, {
        follow_up_sms_status: "pending",
        follow_up_sms_error: undefined,
        updated_at: now,
    });
    await ctx.scheduler.runAfter(
        delayMinutes * 60 * 1000,
        internal.outreach.actions.dispatchFollowUpSms,
        { callId: args.callId },
    );
}

type NormalizedOutcomeOrUndefined =
    | "connected_interested"
    | "connected_not_interested"
    | "callback_requested"
    | "voicemail_left"
    | "no_answer"
    | "wrong_number"
    | "do_not_call"
    | "failed"
    | undefined;

/**
 * Inline helper to drive the outreachCampaignLeadStates state machine
 * from within webhook-processing mutations (same transaction).
 */
async function transitionStateOnCallEventImpl(
    ctx: MutationCtx,
    args: {
        callId: Id<"outreachCalls">;
        campaignId: Id<"outreachCampaigns">;
        leadId: Id<"leads">;
        eventType: string;
        outcome: NormalizedOutcomeOrUndefined;
    },
): Promise<void> {
    const stateRow = await ctx.db
        .query("outreachCampaignLeadStates")
        .withIndex("by_campaign_id_and_lead_id", (q) =>
            q
                .eq("campaign_id", args.campaignId)
                .eq("lead_id", args.leadId),
        )
        .first();
    if (!stateRow) return;

    if (args.eventType === "call_started") {
        if (stateRow.state !== "queued" && stateRow.state !== "in_progress") {
            return;
        }
        await ctx.db.patch(stateRow._id, { state: "in_progress" });
        return;
    }

    // call_ended or call_analyzed.
    if (args.eventType !== "call_ended" && args.eventType !== "call_analyzed") {
        return;
    }

    const outcome = args.outcome;
    const campaign = await ctx.db.get(args.campaignId);
    const now = Date.now();
    const isCorrection =
        args.eventType === "call_analyzed" &&
        stateRow.state !== "queued" &&
        stateRow.state !== "in_progress";
    if (
        !isCorrection &&
        stateRow.state !== "queued" &&
        stateRow.state !== "in_progress"
    ) {
        return;
    }

    const previousWasNoAnswer =
        stateRow.last_outcome === "no_answer" ||
        stateRow.last_outcome === "voicemail_left";
    const nextIsNoAnswer =
        outcome === "no_answer" || outcome === "voicemail_left";
    const newAttempts = isCorrection
        ? stateRow.attempts_in_campaign
        : stateRow.attempts_in_campaign + 1;
    let newNoAnswerCount = stateRow.no_answer_or_voicemail_count;
    if (isCorrection) {
        if (previousWasNoAnswer && !nextIsNoAnswer) {
            newNoAnswerCount = Math.max(0, newNoAnswerCount - 1);
        } else if (!previousWasNoAnswer && nextIsNoAnswer) {
            newNoAnswerCount += 1;
        }
    } else if (nextIsNoAnswer) {
        newNoAnswerCount += 1;
    }

    const baseUpdates: Partial<Doc<"outreachCampaignLeadStates">> = {
        attempts_in_campaign: newAttempts,
        no_answer_or_voicemail_count: newNoAnswerCount,
        last_attempt_at: isCorrection ? stateRow.last_attempt_at ?? now : now,
        last_outcome: outcome,
        active_call_id: undefined,
    };

    if (outcome === "do_not_call" || outcome === "wrong_number") {
        await ctx.db.patch(stateRow._id, {
            ...baseUpdates,
            state: "terminal_blocked",
            next_action_at_ms: undefined,
        });
        return;
    }

    const routeRule = campaign?.outcome_routing?.find(
        (rule) => rule.outcome === outcome,
    );
    const campaignLeadAction =
        routeRule?.campaign_lead_action ?? getDefaultCampaignLeadAction(outcome);

    if (campaignLeadAction === "stop_calling") {
        await ctx.db.patch(stateRow._id, {
            ...baseUpdates,
            state: "done",
            next_action_at_ms: undefined,
        });
        return;
    }

    if (campaignLeadAction === "pause_for_realtor") {
        await ctx.db.patch(stateRow._id, {
            ...baseUpdates,
            state: "paused_for_realtor",
            next_action_at_ms: undefined,
        });
        return;
    }

    const smsEnabled = campaign?.follow_up_sms?.enabled === true;
    if (
        (outcome === "no_answer" || outcome === "voicemail_left") &&
        newNoAnswerCount >= 3 &&
        smsEnabled
    ) {
        await ctx.db.patch(stateRow._id, {
            ...baseUpdates,
            state: "sms_pending",
            next_action_at_ms: undefined,
        });
        return;
    }

    const maxAttempts = campaign?.retry_policy.max_attempts ?? 3;
    if (newAttempts >= maxAttempts) {
        await ctx.db.patch(stateRow._id, {
            ...baseUpdates,
            state: "done",
            next_action_at_ms: undefined,
        });
        return;
    }

    const cooldownMs =
        (campaign?.retry_policy.min_minutes_between_attempts ?? 60) * 60 * 1000;
    const nextActionAtMs = (baseUpdates.last_attempt_at ?? now) + cooldownMs;
    await ctx.db.patch(stateRow._id, {
        ...baseUpdates,
        state: "cooldown",
        next_action_at_ms: nextActionAtMs,
    });

    await ctx.scheduler.runAt(
        nextActionAtMs,
        internal.outreach.campaignLeadState.evaluateCampaignLeadState,
        { stateId: stateRow._id },
    );
}

async function applyRetellCallEventToOutreachState(
    ctx: MutationCtx,
    args: {
        callId: Id<"outreachCalls">;
        leadId?: Id<"leads">;
        retellCallId?: string;
        eventType: string;
        eventTimestamp?: number;
        payload: unknown;
    },
): Promise<{ outcome: NormalizedOutcome }> {
    const callRecord = await ctx.db.get(args.callId);
    if (!callRecord) {
        throw new Error("Outreach call not found");
    }

    const callPayload = extractRetellCallPayload(args.payload);
    if (!callPayload) {
        throw new Error("Retell payload missing call object");
    }

    const callAnalysis = asRecord(callPayload.call_analysis);
    const customAnalysisData =
        asRecord(callAnalysis?.custom_analysis_data) ??
        asRecord(callPayload.custom_analysis_data);
    const disconnectionReason = asString(callPayload.disconnection_reason);
    const outcome = resolveOutcome({
        normalizedOutcome: asString(customAnalysisData?.normalized_outcome),
        disconnectionReason,
        callSuccessful: asBoolean(callAnalysis?.call_successful),
        inVoicemail: asBoolean(callAnalysis?.in_voicemail),
        callStatus: asString(callPayload.call_status),
    });
    const durationMs = asNumber(callPayload.duration_ms);
    const durationSeconds =
        durationMs !== undefined
            ? Math.max(0, Math.round(durationMs / 1000))
            : undefined;
    const startedAt = asTimestampMs(callPayload.start_timestamp);
    const endedAt =
        asTimestampMs(callPayload.end_timestamp) ?? args.eventTimestamp;
    const mappedCallStatus = mapRetellCallStatus(
        asString(callPayload.call_status),
        args.eventType,
    );
    const campaign = callRecord.campaign_id
        ? await ctx.db.get(callRecord.campaign_id)
        : null;

    const updates: Partial<Doc<"outreachCalls">> = {
        updated_at: Date.now(),
        call_status: mappedCallStatus,
        outcome,
        outcome_reason: disconnectionReason ?? undefined,
    };
    if (startedAt !== undefined) {
        updates.started_at = startedAt;
    }
    if (endedAt !== undefined) {
        updates.ended_at = endedAt;
    }
    if (durationSeconds !== undefined) {
        updates.duration_seconds = durationSeconds;
    }
    const summary = asString(callAnalysis?.call_summary);
    if (summary !== undefined) {
        updates.summary = summary;
    }
    const transcript = asString(callPayload.transcript);
    if (transcript !== undefined) {
        updates.transcript = transcript;
    }
    const recordingUrl = asString(callPayload.recording_url);
    if (recordingUrl !== undefined) {
        updates.recording_url = recordingUrl;
    }
    const retellConversationId =
        asString(callPayload.conversation_id) ??
        asString(callPayload.retell_conversation_id);
    if (retellConversationId !== undefined) {
        updates.retell_conversation_id = retellConversationId;
    }
    const resolvedRetellCallId =
        args.retellCallId ?? asString(callPayload.call_id);
    if (resolvedRetellCallId !== undefined) {
        updates.retell_call_id = resolvedRetellCallId;
    }
    const extractedData = buildExtractedData(
        callPayload,
        callAnalysis,
        customAnalysisData,
    );
    if (extractedData !== undefined) {
        updates.extracted_data = extractedData;
    }

    await ctx.db.patch(args.callId, updates);

    const targetLeadId = args.leadId ?? callRecord.lead_id;
    const lead = await ctx.db.get(targetLeadId);
    if (lead) {
        const routeRule = campaign?.outcome_routing?.find(
            (rule) => rule.outcome === outcome,
        );
        const leadUpdates: Partial<Doc<"leads">> = {
            last_outreach_call_id: args.callId,
            last_call_outcome: outcome,
        };
        if (routeRule?.next_lead_status !== undefined) {
            leadUpdates.status = routeRule.next_lead_status;
        }
        if (routeRule?.next_buyer_pipeline_stage !== undefined) {
            leadUpdates.buyer_pipeline_stage =
                routeRule.next_buyer_pipeline_stage;
        }
        if (routeRule?.next_seller_pipeline_stage !== undefined) {
            leadUpdates.seller_pipeline_stage =
                routeRule.next_seller_pipeline_stage;
        }
        if (outcome === "do_not_call") {
            leadUpdates.do_not_call = true;
        }
        await ctx.db.patch(targetLeadId, leadUpdates);
    }

    await queueFollowUpSmsAfterFinalOutcome(ctx, {
        callId: args.callId,
        campaign,
        lead,
        outcome,
    });

    // Drive the new state machine for campaign lead state.
    if (callRecord.campaign_id) {
        await transitionStateOnCallEventImpl(ctx, {
            callId: args.callId,
            campaignId: callRecord.campaign_id,
            leadId: targetLeadId,
            eventType: args.eventType,
            outcome,
        });
    }

    return { outcome };
}

export const recordFollowUpSmsDispatchResult = internalMutation({
    args: {
        callId: v.id("outreachCalls"),
        follow_up_sms_status: v.union(
            v.literal("not_needed"),
            v.literal("pending"),
            v.literal("sent"),
            v.literal("failed"),
            v.literal("opted_out"),
        ),
        follow_up_sms_sent_at: v.optional(v.union(v.number(), v.null())),
        follow_up_sms_sid: v.optional(v.union(v.string(), v.null())),
        follow_up_sms_error: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, args) => {
        const call = await ctx.db.get(args.callId);
        if (!call) {
            throw new Error("Outreach call not found");
        }

        if (
            call.follow_up_sms_status === "sent" &&
            args.follow_up_sms_status !== "sent"
        ) {
            return call;
        }

        const updates: Partial<Doc<"outreachCalls">> = {
            follow_up_sms_status: args.follow_up_sms_status,
            updated_at: Date.now(),
        };
        if (args.follow_up_sms_sent_at !== undefined) {
            updates.follow_up_sms_sent_at =
                args.follow_up_sms_sent_at ?? undefined;
        }
        if (args.follow_up_sms_sid !== undefined) {
            updates.follow_up_sms_sid = args.follow_up_sms_sid ?? undefined;
        }
        if (args.follow_up_sms_error !== undefined) {
            updates.follow_up_sms_error = args.follow_up_sms_error ?? undefined;
        }
        if (args.follow_up_sms_status === "sent") {
            updates.follow_up_sms_error = undefined;
        }

        await ctx.db.patch(args.callId, updates);

        // Drive state machine on SMS completion (sent or failed).
        if (
            call.campaign_id &&
            (args.follow_up_sms_status === "sent" ||
                args.follow_up_sms_status === "failed")
        ) {
            // Find the state row and transition from sms_pending.
            const stateRow = await ctx.db
                .query("outreachCampaignLeadStates")
                .withIndex("by_campaign_id_and_lead_id", (q) =>
                    q
                        .eq("campaign_id", call.campaign_id!)
                        .eq("lead_id", call.lead_id),
                )
                .first();
            if (stateRow && stateRow.state === "sms_pending") {
                const campaign = await ctx.db.get(call.campaign_id);
                const maxAttempts =
                    campaign?.retry_policy.max_attempts ?? 3;

                if (stateRow.attempts_in_campaign >= maxAttempts) {
                    await ctx.db.patch(stateRow._id, {
                        state: "done",
                        next_action_at_ms: undefined,
                    });
                } else {
                    const cooldownMs =
                        (campaign?.retry_policy
                            .min_minutes_between_attempts ?? 60) *
                        60 *
                        1000;
                    const nextActionAtMs = Date.now() + cooldownMs;
                    await ctx.db.patch(stateRow._id, {
                        state: "cooldown",
                        next_action_at_ms: nextActionAtMs,
                    });
                    await ctx.scheduler.runAt(
                        nextActionAtMs,
                        internal.outreach.campaignLeadState
                            .evaluateCampaignLeadState,
                        { stateId: stateRow._id },
                    );
                }
            }
        }

        return await ctx.db.get(args.callId);
    },
});

export const upsertOutreachSmsMessage = internalMutation({
    args: {
        lead_id: v.optional(v.union(v.id("leads"), v.null())),
        campaign_id: v.optional(v.union(v.id("outreachCampaigns"), v.null())),
        call_id: v.optional(v.union(v.id("outreachCalls"), v.null())),
        provider: v.literal("twilio"),
        provider_message_sid: v.optional(v.union(v.string(), v.null())),
        provider_account_sid: v.optional(v.union(v.string(), v.null())),
        provider_messaging_service_sid: v.optional(
            v.union(v.string(), v.null()),
        ),
        direction: OUTREACH_SMS_DIRECTION_VALIDATOR,
        body: v.string(),
        from_number: v.string(),
        to_number: v.string(),
        status: OUTREACH_SMS_STATUS_VALIDATOR,
        error_code: v.optional(v.union(v.string(), v.null())),
        error_message: v.optional(v.union(v.string(), v.null())),
        sent_at: v.optional(v.union(v.number(), v.null())),
        received_at: v.optional(v.union(v.number(), v.null())),
        raw_payload: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const providerMessageSid =
            normalizeOptionalString(args.provider_message_sid ?? undefined) ??
            undefined;
        const existingMessage = providerMessageSid
            ? await ctx.db
                  .query("outreachSmsMessages")
                  .withIndex("by_provider_message_sid", (q) =>
                      q.eq("provider_message_sid", providerMessageSid),
                  )
                  .first()
            : null;

        const leadId = args.lead_id ?? undefined;
        const campaignId = args.campaign_id ?? undefined;
        const callId = args.call_id ?? undefined;
        const fromNumber =
            normalizePhoneNumber(args.from_number) ?? args.from_number;
        const toNumber = normalizePhoneNumber(args.to_number) ?? args.to_number;
        const body = args.body.trim();

        if (existingMessage) {
            const nextStatus = resolveSmsStatusTransition({
                currentStatus: existingMessage.status,
                incomingStatus: args.status,
                direction: existingMessage.direction,
            });
            const updates: Partial<Doc<"outreachSmsMessages">> = {
                lead_id: leadId ?? existingMessage.lead_id,
                campaign_id: campaignId ?? existingMessage.campaign_id,
                call_id: callId ?? existingMessage.call_id,
                provider_account_sid:
                    normalizeOptionalString(
                        args.provider_account_sid ?? undefined,
                    ) ?? existingMessage.provider_account_sid,
                provider_messaging_service_sid:
                    normalizeOptionalString(
                        args.provider_messaging_service_sid ?? undefined,
                    ) ?? existingMessage.provider_messaging_service_sid,
                direction: args.direction,
                body: body || existingMessage.body,
                from_number: fromNumber || existingMessage.from_number,
                to_number: toNumber || existingMessage.to_number,
                status: nextStatus,
                updated_at: now,
            };

            if (args.error_code !== undefined) {
                updates.error_code =
                    normalizeOptionalString(args.error_code ?? undefined) ??
                    undefined;
            }
            if (args.error_message !== undefined) {
                updates.error_message =
                    normalizeOptionalString(args.error_message ?? undefined) ??
                    undefined;
            }
            if (args.sent_at !== undefined) {
                updates.sent_at = args.sent_at ?? undefined;
            }
            if (args.received_at !== undefined) {
                updates.received_at = args.received_at ?? undefined;
            }
            if (args.raw_payload !== undefined) {
                updates.raw_payload = args.raw_payload;
            }

            await ctx.db.patch(existingMessage._id, updates);
            return await ctx.db.get(existingMessage._id);
        }

        const insertedId = await ctx.db.insert("outreachSmsMessages", {
            lead_id: leadId,
            campaign_id: campaignId,
            call_id: callId,
            provider: "twilio",
            provider_message_sid: providerMessageSid,
            provider_account_sid: normalizeOptionalString(
                args.provider_account_sid ?? undefined,
            ),
            provider_messaging_service_sid: normalizeOptionalString(
                args.provider_messaging_service_sid ?? undefined,
            ),
            direction: args.direction,
            body: body || "(empty)",
            from_number: fromNumber,
            to_number: toNumber,
            status: args.status,
            error_code: normalizeOptionalString(args.error_code ?? undefined),
            error_message: normalizeOptionalString(
                args.error_message ?? undefined,
            ),
            sent_at: args.sent_at ?? undefined,
            received_at: args.received_at ?? undefined,
            raw_payload: args.raw_payload,
            created_at: now,
            updated_at: now,
        });

        return await ctx.db.get(insertedId);
    },
});

export const ingestTwilioMessagingWebhook = internalMutation({
    args: {
        message_sid: v.optional(v.string()),
        account_sid: v.optional(v.string()),
        messaging_service_sid: v.optional(v.string()),
        message_status: v.optional(v.string()),
        from_number: v.optional(v.string()),
        to_number: v.optional(v.string()),
        body: v.optional(v.string()),
        error_code: v.optional(v.string()),
        error_message: v.optional(v.string()),
        raw_payload: v.any(),
        received_at: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = args.received_at ?? Date.now();
        const messageSid = normalizeOptionalString(args.message_sid);
        const messageStatus = normalizeSmsStatus(args.message_status);
        const body = args.body?.trim() ?? "";
        const fromNumberRaw = normalizeOptionalString(args.from_number);
        const toNumberRaw = normalizeOptionalString(args.to_number);
        const fromNumber = fromNumberRaw
            ? (normalizePhoneNumber(fromNumberRaw) ?? fromNumberRaw)
            : "unknown";
        const toNumber = toNumberRaw
            ? (normalizePhoneNumber(toNumberRaw) ?? toNumberRaw)
            : "unknown";

        let existing = messageSid
            ? await ctx.db
                  .query("outreachSmsMessages")
                  .withIndex("by_provider_message_sid", (q) =>
                      q.eq("provider_message_sid", messageSid),
                  )
                  .first()
            : null;

        const isInbound = messageStatus === "received";
        let resolvedLeadId = existing?.lead_id;
        let resolvedCampaignId = existing?.campaign_id;
        let resolvedCallId = existing?.call_id;

        if (!resolvedLeadId && fromNumberRaw) {
            const byNormalized = await ctx.db
                .query("leads")
                .withIndex("by_phone", (q) => q.eq("phone", fromNumber))
                .first();
            const byRaw =
                byNormalized ??
                (fromNumber !== fromNumberRaw
                    ? await ctx.db
                          .query("leads")
                          .withIndex("by_phone", (q) =>
                              q.eq("phone", fromNumberRaw),
                          )
                          .first()
                    : null);
            if (byRaw) {
                resolvedLeadId = byRaw._id;
            }
        }

        if (!resolvedCallId && resolvedLeadId) {
            const lead = await ctx.db.get(resolvedLeadId);
            if (lead?.last_outreach_call_id) {
                const lastCall = await ctx.db.get(lead.last_outreach_call_id);
                if (lastCall) {
                    resolvedCallId = lastCall._id;
                    resolvedCampaignId = lastCall.campaign_id;
                }
            }
        }

        if (!resolvedCampaignId && resolvedCallId) {
            const call = await ctx.db.get(resolvedCallId);
            resolvedCampaignId = call?.campaign_id;
        }

        const normalizedErrorCode = normalizeOptionalString(args.error_code);
        const normalizedErrorMessage = normalizeOptionalString(
            args.error_message,
        );

        if (existing) {
            const nextStatus = resolveSmsStatusTransition({
                currentStatus: existing.status,
                incomingStatus: messageStatus,
                direction: existing.direction,
            });
            await ctx.db.patch(existing._id, {
                lead_id: resolvedLeadId ?? existing.lead_id,
                campaign_id: resolvedCampaignId ?? existing.campaign_id,
                call_id: resolvedCallId ?? existing.call_id,
                provider_account_sid:
                    normalizeOptionalString(args.account_sid) ??
                    existing.provider_account_sid,
                provider_messaging_service_sid:
                    normalizeOptionalString(args.messaging_service_sid) ??
                    existing.provider_messaging_service_sid,
                status: nextStatus,
                error_code: normalizedErrorCode ?? existing.error_code,
                error_message: normalizedErrorMessage ?? existing.error_message,
                body: body || existing.body,
                from_number:
                    fromNumber !== "unknown"
                        ? fromNumber
                        : existing.from_number,
                to_number:
                    toNumber !== "unknown" ? toNumber : existing.to_number,
                received_at: isInbound ? now : existing.received_at,
                raw_payload: args.raw_payload,
                updated_at: now,
            });
        } else {
            const insertedId = await ctx.db.insert("outreachSmsMessages", {
                lead_id: resolvedLeadId,
                campaign_id: resolvedCampaignId,
                call_id: resolvedCallId,
                provider: "twilio",
                provider_message_sid: messageSid,
                provider_account_sid: normalizeOptionalString(args.account_sid),
                provider_messaging_service_sid: normalizeOptionalString(
                    args.messaging_service_sid,
                ),
                direction: isInbound ? "inbound" : "outbound",
                body: body || "(empty)",
                from_number: fromNumber,
                to_number: toNumber,
                status: messageStatus,
                error_code: normalizedErrorCode,
                error_message: normalizedErrorMessage,
                sent_at: isInbound ? undefined : now,
                received_at: isInbound ? now : undefined,
                raw_payload: args.raw_payload,
                created_at: now,
                updated_at: now,
            });
            existing = await ctx.db.get(insertedId);
        }

        if (resolvedLeadId && isInbound && body) {
            const smsOptOutUpdate = resolveInboundOptOutUpdate(body);
            if (smsOptOutUpdate !== undefined) {
                await ctx.db.patch(resolvedLeadId, {
                    sms_opt_out: smsOptOutUpdate,
                });
            }
        }

        return {
            messageId: existing?._id ?? null,
            messageSid: messageSid ?? null,
            direction: isInbound ? "inbound" : "outbound",
            status: messageStatus,
            leadId: resolvedLeadId ?? null,
            campaignId: resolvedCampaignId ?? null,
            callId: resolvedCallId ?? null,
        };
    },
});

export const cleanupStaleActiveCalls = internalMutation({
    args: {
        now_ms: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = args.now_ms ?? Date.now();
        const queuedCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_call_status", (q) => q.eq("call_status", "queued"))
            .take(200);
        const ringingCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_call_status", (q) => q.eq("call_status", "ringing"))
            .take(200);
        const inProgressCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_call_status", (q) =>
                q.eq("call_status", "in_progress"),
            )
            .take(200);

        const activeCalls = [
            ...queuedCalls,
            ...ringingCalls,
            ...inProgressCalls,
        ];
        const scanned = activeCalls.length;
        let closed = 0;
        const scannedByStatus = {
            queued: queuedCalls.length,
            ringing: ringingCalls.length,
            in_progress: inProgressCalls.length,
        };
        const closedByStatus = {
            queued: 0,
            ringing: 0,
            in_progress: 0,
        };

        for (const call of activeCalls) {
            if (
                call.call_status !== "queued" &&
                call.call_status !== "ringing" &&
                call.call_status !== "in_progress"
            ) {
                continue;
            }

            const timeoutMs =
                call.call_status === "in_progress"
                    ? STALE_IN_PROGRESS_TIMEOUT_MS
                    : STALE_QUEUED_OR_RINGING_TIMEOUT_MS;
            const referenceTime =
                call.call_status === "in_progress"
                    ? (call.started_at ?? call.initiated_at)
                    : call.initiated_at;

            if (now - referenceTime < timeoutMs) {
                continue;
            }

            await ctx.db.patch(call._id, {
                call_status: "failed",
                outcome: "failed",
                ended_at: now,
                error_message: `Auto-closed stale ${call.call_status} call after timeout (${timeoutMs}ms)`,
                updated_at: now,
            });

            closed += 1;
            closedByStatus[call.call_status] += 1;
        }

        return {
            scanned,
            closed,
            scannedByStatus,
            closedByStatus,
        };
    },
});

async function applyRetellCallStartedEventToOutreachState(
    ctx: MutationCtx,
    args: {
        callId: Id<"outreachCalls">;
        retellCallId?: string;
        eventType: string;
        eventTimestamp?: number;
        payload: unknown;
    },
): Promise<void> {
    const callRecord = await ctx.db.get(args.callId);
    if (!callRecord) {
        throw new Error("Outreach call not found");
    }

    const callPayload = extractRetellCallPayload(args.payload);
    if (!callPayload) {
        throw new Error("Retell payload missing call object");
    }

    const startedAt =
        asTimestampMs(callPayload.start_timestamp) ?? args.eventTimestamp;
    const mappedCallStatus = mapRetellCallStatus(
        asString(callPayload.call_status),
        args.eventType,
    );

    const updates: Partial<Doc<"outreachCalls">> = {
        updated_at: Date.now(),
        call_status: mappedCallStatus,
    };
    if (startedAt !== undefined) {
        updates.started_at = startedAt;
    }
    const resolvedRetellCallId =
        args.retellCallId ?? asString(callPayload.call_id);
    if (resolvedRetellCallId !== undefined) {
        updates.retell_call_id = resolvedRetellCallId;
    }
    const retellConversationId =
        asString(callPayload.conversation_id) ??
        asString(callPayload.retell_conversation_id);
    if (retellConversationId !== undefined) {
        updates.retell_conversation_id = retellConversationId;
    }
    const extractedData = buildExtractedData(callPayload, null, null);
    if (extractedData !== undefined) {
        updates.extracted_data = extractedData;
    }

    await ctx.db.patch(args.callId, updates);

    // Drive the new state machine for call_started events.
    if (callRecord.campaign_id) {
        await transitionStateOnCallEventImpl(ctx, {
            callId: args.callId,
            campaignId: callRecord.campaign_id,
            leadId: callRecord.lead_id,
            eventType: args.eventType,
            outcome: undefined,
        });
    }
}

export const ingestRetellWebhookEvent = internalMutation({
    args: {
        retell_event_id: v.optional(v.string()),
        retell_call_id: v.optional(v.string()),
        event_type: v.string(),
        event_timestamp: v.optional(v.number()),
        payload: v.any(),
        call_id: v.optional(v.string()),
        campaign_id: v.optional(v.string()),
        lead_id: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const eventType =
            normalizeOptionalString(args.event_type)?.toLowerCase() ??
            "unknown";
        const retellEventId = normalizeOptionalString(args.retell_event_id);
        const retellCallId = normalizeOptionalString(args.retell_call_id);

        const existingEvent = retellEventId
            ? await ctx.db
                  .query("outreachWebhookEvents")
                  .withIndex("by_retell_event_id", (q) =>
                      q.eq("retell_event_id", retellEventId),
                  )
                  .first()
            : null;
        const isDuplicate = existingEvent !== null;

        let callId = await resolveOutreachCallId(ctx, args.call_id);
        if (!callId && retellCallId) {
            const matchedCall = await ctx.db
                .query("outreachCalls")
                .withIndex("by_retell_call_id", (q) =>
                    q.eq("retell_call_id", retellCallId),
                )
                .first();
            callId = matchedCall?._id;
        }

        const matchedCall = callId ? await ctx.db.get(callId) : null;
        const campaignId =
            (await resolveCampaignId(ctx, args.campaign_id)) ??
            matchedCall?.campaign_id;
        const leadId =
            (await resolveLeadId(ctx, args.lead_id)) ?? matchedCall?.lead_id;

        const processingStatus = isDuplicate ? "ignored" : "received";
        const processingError = isDuplicate
            ? "Duplicate Retell event delivery"
            : undefined;
        const processedAt = isDuplicate ? now : undefined;

        const eventId = await ctx.db.insert("outreachWebhookEvents", {
            call_id: callId,
            campaign_id: campaignId,
            lead_id: leadId,
            retell_call_id: retellCallId,
            retell_event_id: retellEventId,
            event_type: eventType,
            event_timestamp: args.event_timestamp,
            payload: args.payload,
            processing_status: processingStatus,
            processing_error: processingError,
            received_at: now,
            processed_at: processedAt,
        });

        if (!isDuplicate) {
            if (!SUPPORTED_RETELL_EVENT_TYPES.has(eventType)) {
                await ctx.db.patch(eventId, {
                    processing_status: "ignored",
                    processing_error: `Unsupported Retell event type: ${eventType}`,
                    processed_at: Date.now(),
                });
                return {
                    eventId,
                    processingStatus: "ignored",
                    isDuplicate,
                };
            }

            if (!callId) {
                await ctx.db.patch(eventId, {
                    processing_status: "failed",
                    processing_error:
                        "Unable to resolve outreach call from webhook payload",
                    processed_at: Date.now(),
                });
                return {
                    eventId,
                    processingStatus: "failed",
                    isDuplicate,
                };
            }

            try {
                if (eventType === "call_started") {
                    await applyRetellCallStartedEventToOutreachState(ctx, {
                        callId,
                        retellCallId,
                        eventType,
                        eventTimestamp: args.event_timestamp,
                        payload: args.payload,
                    });
                } else {
                    await applyRetellCallEventToOutreachState(ctx, {
                        callId,
                        leadId,
                        retellCallId,
                        eventType,
                        eventTimestamp: args.event_timestamp,
                        payload: args.payload,
                    });
                }
                await ctx.db.patch(eventId, {
                    processing_status: "processed",
                    processing_error: undefined,
                    processed_at: Date.now(),
                });
                return {
                    eventId,
                    processingStatus: "processed",
                    isDuplicate,
                };
            } catch (error) {
                await ctx.db.patch(eventId, {
                    processing_status: "failed",
                    processing_error: toErrorMessage(error),
                    processed_at: Date.now(),
                });
                return {
                    eventId,
                    processingStatus: "failed",
                    isDuplicate,
                };
            }
        }

        return {
            eventId,
            processingStatus,
            isDuplicate,
        };
    },
});
