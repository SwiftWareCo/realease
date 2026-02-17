import type { Doc, Id } from "../_generated/dataModel";
import {
    internalMutation,
    mutation,
    type MutationCtx,
} from "../_generated/server";
import { v } from "convex/values";
import { normalizePhoneNumber } from "./phone";

const ACTIVE_CALL_STATUSES: ReadonlySet<Doc<"outreachCalls">["call_status"]> =
    new Set(["queued", "ringing", "in_progress"]);

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
                enabled: true,
                delay_minutes: 10,
            },
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
        const leadUpdates: Partial<Doc<"leads">> = {
            last_outreach_call_id: args.callId,
            last_call_outcome: outcome,
        };
        await ctx.db.patch(targetLeadId, leadUpdates);
    }

    return { outcome };
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
            if (!SUPPORTED_RETELL_FINAL_EVENT_TYPES.has(eventType)) {
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
                await applyRetellCallEventToOutreachState(ctx, {
                    callId,
                    leadId,
                    retellCallId,
                    eventType,
                    eventTimestamp: args.event_timestamp,
                    payload: args.payload,
                });
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
