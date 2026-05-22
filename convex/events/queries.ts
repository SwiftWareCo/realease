import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentUserIdOrThrow, requireLeadOwner } from "../auth";

type EnrichedEvent = Doc<"events"> & { lead: Doc<"leads"> | null };

async function enrichEventsWithOwnedLeads(
    ctx: QueryCtx,
    events: Doc<"events">[],
    userId: Id<"users">,
): Promise<EnrichedEvent[]> {
    return await Promise.all(
        events.map(async (event) => {
            if (!event.lead_id) {
                return { ...event, lead: null };
            }
            const lead = await ctx.db.get(event.lead_id);
            if (!lead || lead.created_by_user_id !== userId) {
                return { ...event, lead: null };
            }
            return { ...event, lead };
        }),
    );
}

async function canReadEvent(
    ctx: QueryCtx,
    event: Doc<"events">,
    userId: Id<"users">,
) {
    if (event.created_by_user_id === userId) {
        return true;
    }
    if (!event.created_by_user_id && event.lead_id) {
        const lead = await ctx.db.get(event.lead_id);
        return lead?.created_by_user_id === userId;
    }
    return false;
}

async function mergeReadableLegacyEvents(
    ctx: QueryCtx,
    ownedEvents: Doc<"events">[],
    candidateLegacyEvents: Doc<"events">[],
    userId: Id<"users">,
) {
    const eventsById = new Map(
        ownedEvents.map((event) => [String(event._id), event]),
    );

    for (const event of candidateLegacyEvents) {
        if (event.created_by_user_id || eventsById.has(String(event._id))) {
            continue;
        }
        if (await canReadEvent(ctx, event, userId)) {
            eventsById.set(String(event._id), event);
        }
    }

    return Array.from(eventsById.values()).sort(
        (a, b) => a.start_time - b.start_time,
    );
}

// Get current user's events.
export const getAllEvents = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const [ownedEvents, legacyCandidates] = await Promise.all([
            ctx.db
                .query("events")
                .withIndex("by_created_by_user_id_and_start_time", (q) =>
                    q.eq("created_by_user_id", userId),
                )
                .order("asc")
                .take(500),
            ctx.db.query("events").withIndex("by_start_time").order("asc").take(500),
        ]);

        return await mergeReadableLegacyEvents(
            ctx,
            ownedEvents,
            legacyCandidates,
            userId,
        );
    },
});

// Get upcoming events for the current user.
export const getUpcomingEvents = query({
    args: {
        limit: v.optional(v.number()),
        daysAhead: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const now = Date.now();
        const daysAhead = args.daysAhead ?? 7;
        const endTime = now + daysAhead * 24 * 60 * 60 * 1000;
        const limit = Math.min(args.limit ?? 10, 25);

        const [ownedEvents, legacyCandidates] = await Promise.all([
            ctx.db
                .query("events")
                .withIndex("by_created_by_user_id_and_start_time", (q) =>
                    q
                        .eq("created_by_user_id", userId)
                        .gte("start_time", now)
                        .lte("start_time", endTime),
                )
                .order("asc")
                .take(Math.max(limit * 3, 20)),
            ctx.db
                .query("events")
                .withIndex("by_start_time", (q) =>
                    q.gte("start_time", now).lte("start_time", endTime),
                )
                .order("asc")
                .take(Math.max(limit * 3, 20)),
        ]);
        const events = await mergeReadableLegacyEvents(
            ctx,
            ownedEvents,
            legacyCandidates,
            userId,
        );

        const visibleEvents = events
            .filter((event) => !event.is_completed)
            .slice(0, limit);

        return await enrichEventsWithOwnedLeads(ctx, visibleEvents, userId);
    },
});

// Get events for a specific lead.
export const getEventsByLead = query({
    args: {
        leadId: v.id("leads"),
    },
    handler: async (ctx, args) => {
        await requireLeadOwner(ctx, args.leadId);
        return await ctx.db
            .query("events")
            .withIndex("by_lead_id", (q) => q.eq("lead_id", args.leadId))
            .order("desc")
            .take(300);
    },
});

// Get events for a specific lead, bucketed by upcoming vs past on the server.
export const getLeadEventsBuckets = query({
    args: {
        leadId: v.id("leads"),
    },
    handler: async (ctx, args) => {
        await requireLeadOwner(ctx, args.leadId);
        const now = Date.now();
        const events = await ctx.db
            .query("events")
            .withIndex("by_lead_id", (q) => q.eq("lead_id", args.leadId))
            .order("desc")
            .take(300);

        const upcoming: typeof events = [];
        const past: typeof events = [];

        for (const event of events) {
            if (event.is_completed || event.start_time <= now) {
                past.push(event);
            } else {
                upcoming.push(event);
            }
        }

        return { upcoming, past };
    },
});

// Get a single event by ID.
export const getEventById = query({
    args: {
        id: v.id("events"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const event = await ctx.db.get(args.id);
        if (!event || !(await canReadEvent(ctx, event, userId))) {
            return null;
        }

        const [enrichedEvent] = await enrichEventsWithOwnedLeads(
            ctx,
            [event],
            userId,
        );
        return enrichedEvent;
    },
});

// Get current user's events within a date range for calendar views.
export const getEventsInRange = query({
    args: {
        startTime: v.number(),
        endTime: v.number(),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const [ownedEvents, legacyCandidates] = await Promise.all([
            ctx.db
                .query("events")
                .withIndex("by_created_by_user_id_and_start_time", (q) =>
                    q
                        .eq("created_by_user_id", userId)
                        .gte("start_time", args.startTime)
                        .lte("start_time", args.endTime),
                )
                .order("asc")
                .take(500),
            ctx.db
                .query("events")
                .withIndex("by_start_time", (q) =>
                    q
                        .gte("start_time", args.startTime)
                        .lte("start_time", args.endTime),
                )
                .order("asc")
                .take(500),
        ]);
        const events = await mergeReadableLegacyEvents(
            ctx,
            ownedEvents,
            legacyCandidates,
            userId,
        );

        return await enrichEventsWithOwnedLeads(ctx, events, userId);
    },
});
