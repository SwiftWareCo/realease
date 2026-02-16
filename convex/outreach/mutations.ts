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
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
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

async function queueCampaignOutreachCalls(
    ctx: MutationCtx,
    args: {
        campaignId: Id<"outreachCampaigns">;
        leadIds: Id<"leads">[];
    },
) {
    const now = Date.now();
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
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
        return await queueCampaignOutreachCalls(ctx, args);
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
