import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
    internalMutation,
    mutation,
    type MutationCtx,
} from "../_generated/server";
import { v } from "convex/values";
import { normalizePhoneNumber } from "./phone";

const ACTIVE_CALL_STATUSES: ReadonlySet<Doc<"outreachCalls">["call_status"]> =
    new Set(["queued", "ringing", "in_progress"]);

const STALE_QUEUED_OR_RINGING_TIMEOUT_MS = 20 * 60 * 1000;
const STALE_IN_PROGRESS_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const FIXED_FOLLOW_UP_SMS_DELAY_MINUTES = 3;

const WEEKDAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
};

type StartSkipReason =
    | "campaign_not_active"
    | "lead_not_found"
    | "invalid_phone"
    | "do_not_call"
    | "status_not_eligible"
    | "active_call_in_progress"
    | "in_other_active_campaign"
    | "max_attempts_reached"
    | "blocked_by_terminal_outcome"
    | "outside_calling_window"
    | "cooldown_active";

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
    }),
);

const FOLLOW_UP_SMS_VALIDATOR = v.object({
    enabled: v.boolean(),
    delay_minutes: v.number(),
    default_template: v.optional(v.string()),
    send_only_on_outcomes: v.optional(v.array(OUTCOME_VALIDATOR)),
});

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

type CampaignLeadCallStats = {
    attemptsInCampaign: number;
    hasActiveCall: boolean;
    latestOutcome?: Doc<"outreachCalls">["outcome"];
    latestInitiatedAt?: number;
};

async function getCurrentUserIdOrThrow(ctx: MutationCtx): Promise<Id<"users">> {
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

function getLocalWeekdayHour(
    timestamp: number,
    timeZone: string,
): { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; hour: number } {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        hour: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const weekdayPart = parts.find((part) => part.type === "weekday")?.value;
    const hourPart = parts.find((part) => part.type === "hour")?.value;

    const weekdayKey = weekdayPart?.toLowerCase().slice(0, 3) ?? "sun";
    const weekday = WEEKDAY_MAP[weekdayKey];
    const hour = hourPart ? Number(hourPart) : 0;
    return { weekday, hour };
}

function isInsideCallingWindow(
    timestamp: number,
    timeZone: string,
    window: {
        start_hour_local: number;
        end_hour_local: number;
        allowed_weekdays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
    },
): boolean {
    const { weekday, hour } = getLocalWeekdayHour(timestamp, timeZone);
    if (!window.allowed_weekdays.includes(weekday)) {
        return false;
    }

    const start = window.start_hour_local;
    const end = window.end_hour_local;
    if (start === end) {
        return true;
    }
    if (start < end) {
        return hour >= start && hour < end;
    }
    // Overnight windows (example 21 -> 6)
    return hour >= start || hour < end;
}

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
        outcome_routing: v.optional(OUTCOME_ROUTING_VALIDATOR),
        follow_up_sms: v.optional(FOLLOW_UP_SMS_VALIDATOR),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const now = Date.now();
        const envRetellAgentId = process.env.RETELL_DEFAULT_AGENT_ID?.trim();
        const envRetellPhoneNumberId =
            process.env.RETELL_DEFAULT_PHONE_NUMBER_ID?.trim();
        const envTwilioMessagingServiceSid =
            process.env.TWILIO_DEFAULT_MESSAGING_SERVICE_SID?.trim();
        const envDefaultTimezone =
            process.env.OUTREACH_DEFAULT_TIMEZONE?.trim();

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

        return await ctx.db.insert("outreachCampaigns", {
            name: args.name.trim(),
            description: args.description?.trim() || undefined,
            status: args.status ?? "active",
            retell_agent_id: resolvedRetellAgentId,
            retell_phone_number_id: resolvedRetellPhoneNumberId || undefined,
            twilio_messaging_service_sid:
                resolvedTwilioMessagingServiceSid || undefined,
            timezone: resolvedTimezone,
            calling_window: {
                start_hour_local: 9,
                end_hour_local: 18,
                allowed_weekdays: [1, 2, 3, 4, 5],
            },
            retry_policy: {
                max_attempts: 3,
                min_minutes_between_attempts: 60,
            },
            follow_up_sms: {
                enabled: args.follow_up_sms?.enabled ?? true,
                delay_minutes: FIXED_FOLLOW_UP_SMS_DELAY_MINUTES,
                default_template:
                    args.follow_up_sms?.default_template?.trim() || undefined,
                send_only_on_outcomes: args.follow_up_sms
                    ?.send_only_on_outcomes ?? ["no_answer", "voicemail_left"],
            },
            outcome_routing: args.outcome_routing,
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
        retell_agent_id: v.optional(v.union(v.string(), v.null())),
        retell_phone_number_id: v.optional(v.union(v.string(), v.null())),
        twilio_messaging_service_sid: v.optional(v.union(v.string(), v.null())),
        calling_window: v.optional(
            v.object({
                start_hour_local: v.number(),
                end_hour_local: v.number(),
                allowed_weekdays: v.array(WEEKDAY_VALIDATOR),
            }),
        ),
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
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }
        if (campaign.created_by_user_id !== userId) {
            throw new Error("Campaign not found");
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
            updates.outcome_routing = args.outcome_routing ?? undefined;
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

async function queueCampaignOutreachCalls(
    ctx: MutationCtx,
    args: {
        campaignId: Id<"outreachCampaigns">;
        leadIds: Id<"leads">[];
        actorUserId?: Id<"users">;
    },
) {
    const now = Date.now();
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
        throw new Error("Campaign not found");
    }
    if (args.actorUserId && campaign.created_by_user_id !== args.actorUserId) {
        throw new Error("Campaign not found");
    }

    const uniqueLeadIds = Array.from(
        new Set(args.leadIds.map((leadId) => String(leadId))),
    ) as Id<"leads">[];

    const campaignCalls = await ctx.db
        .query("outreachCalls")
        .withIndex("by_campaign_id", (q) =>
            q.eq("campaign_id", args.campaignId),
        )
        .collect();
    const statsByLead = new Map<string, CampaignLeadCallStats>();
    for (const call of campaignCalls) {
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

    const started: Array<{
        leadId: Id<"leads">;
        callId: Id<"outreachCalls">;
        dialToNumber: string;
    }> = [];
    const skipped: Array<{ leadId: Id<"leads">; reason: StartSkipReason }> = [];
    const campaignCache = new Map<
        Id<"outreachCampaigns">,
        Doc<"outreachCampaigns"> | null
    >();

    for (const leadId of uniqueLeadIds) {
        if (campaign.status !== "active") {
            skipped.push({ leadId, reason: "campaign_not_active" });
            continue;
        }

        const lead = await ctx.db.get(leadId);
        if (!lead) {
            skipped.push({ leadId, reason: "lead_not_found" });
            continue;
        }

        const dialToNumber = normalizePhoneNumber(lead.phone);
        if (!dialToNumber) {
            skipped.push({ leadId, reason: "invalid_phone" });
            continue;
        }
        if (lead.do_not_call === true) {
            skipped.push({ leadId, reason: "do_not_call" });
            continue;
        }
        if (lead.status !== "new" && lead.status !== "contacted") {
            skipped.push({ leadId, reason: "status_not_eligible" });
            continue;
        }

        const leadCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_lead_id", (q) => q.eq("lead_id", leadId))
            .collect();
        let inOtherActiveCampaign = false;
        for (const leadCall of leadCalls) {
            const otherCampaignId = leadCall.campaign_id;
            if (!otherCampaignId || otherCampaignId === args.campaignId) {
                continue;
            }

            let otherCampaign = campaignCache.get(otherCampaignId) ?? null;
            if (!campaignCache.has(otherCampaignId)) {
                otherCampaign = await ctx.db.get(otherCampaignId);
                campaignCache.set(otherCampaignId, otherCampaign);
            }
            if (
                otherCampaign?.status === "active" &&
                otherCampaign.created_by_user_id === campaign.created_by_user_id
            ) {
                inOtherActiveCampaign = true;
                break;
            }
        }
        if (inOtherActiveCampaign) {
            skipped.push({ leadId, reason: "in_other_active_campaign" });
            continue;
        }
        const hasAnyActiveCall = leadCalls.some((call) =>
            ACTIVE_CALL_STATUSES.has(call.call_status),
        );
        if (hasAnyActiveCall) {
            skipped.push({ leadId, reason: "active_call_in_progress" });
            continue;
        }

        const campaignStats = statsByLead.get(String(leadId));
        if (
            (campaignStats?.attemptsInCampaign ?? 0) >=
            campaign.retry_policy.max_attempts
        ) {
            skipped.push({ leadId, reason: "max_attempts_reached" });
            continue;
        }
        if (
            campaignStats?.latestOutcome === "do_not_call" ||
            campaignStats?.latestOutcome === "wrong_number"
        ) {
            skipped.push({ leadId, reason: "blocked_by_terminal_outcome" });
            continue;
        }

        if (
            !isInsideCallingWindow(
                now,
                campaign.timezone,
                campaign.calling_window as {
                    start_hour_local: number;
                    end_hour_local: number;
                    allowed_weekdays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
                },
            )
        ) {
            skipped.push({ leadId, reason: "outside_calling_window" });
            continue;
        }

        const latestAttemptAt = campaignStats?.latestInitiatedAt;
        if (latestAttemptAt !== undefined) {
            const minSpacingMs =
                campaign.retry_policy.min_minutes_between_attempts * 60 * 1000;
            if (now - latestAttemptAt < minSpacingMs) {
                skipped.push({ leadId, reason: "cooldown_active" });
                continue;
            }
        }

        const callId = await ctx.db.insert("outreachCalls", {
            lead_id: leadId,
            campaign_id: args.campaignId,
            call_status: "queued",
            call_direction: "outbound",
            initiated_at: now,
            created_at: now,
            updated_at: now,
        });
        started.push({ leadId, callId, dialToNumber });
    }

    return {
        campaignId: args.campaignId,
        started,
        skipped,
        startedCount: started.length,
        skippedCount: skipped.length,
        requestedCount: uniqueLeadIds.length,
    };
}

export const startCampaignOutreach = mutation({
    args: {
        campaignId: v.id("outreachCampaigns"),
        leadIds: v.array(v.id("leads")),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        return await queueCampaignOutreachCalls(ctx, {
            ...args,
            actorUserId: userId,
        });
    },
});

export const queueCampaignOutreach = internalMutation({
    args: {
        campaignId: v.id("outreachCampaigns"),
        leadIds: v.array(v.id("leads")),
    },
    handler: async (ctx, args) => {
        return await queueCampaignOutreachCalls(ctx, args);
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

    const leadCalls = await ctx.db
        .query("outreachCalls")
        .withIndex("by_lead_id", (q) => q.eq("lead_id", lead._id))
        .collect();
    const followUpAttemptsInCampaign = leadCalls.filter(
        (call) =>
            call.campaign_id === args.campaign?._id &&
            (call.outcome === "no_answer" || call.outcome === "voicemail_left"),
    ).length;
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
            .collect();
        const ringingCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_call_status", (q) => q.eq("call_status", "ringing"))
            .collect();
        const inProgressCalls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_call_status", (q) =>
                q.eq("call_status", "in_progress"),
            )
            .collect();

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
