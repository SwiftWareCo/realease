import { query } from "../_generated/server";
import { v } from "convex/values";

// Get all events
export const getAllEvents = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("events").order("asc").collect();
    },
});

// Get upcoming events (next 7 days by default)
export const getUpcomingEvents = query({
    args: {
        limit: v.optional(v.number()),
        daysAhead: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const daysAhead = args.daysAhead ?? 7;
        const endTime = now + daysAhead * 24 * 60 * 60 * 1000;
        const limit = args.limit ?? 10;

        const events = await ctx.db
            .query("events")
            .withIndex("by_start_time")
            .filter((q) =>
                q.and(
                    q.gte(q.field("start_time"), now),
                    q.lte(q.field("start_time"), endTime),
                    q.eq(q.field("is_completed"), false),
                ),
            )
            .order("asc")
            .take(limit);

        // Enrich events with lead data if linked
        const enrichedEvents = await Promise.all(
            events.map(async (event) => {
                if (event.lead_id) {
                    const lead = await ctx.db.get(event.lead_id);
                    return { ...event, lead };
                }
                return { ...event, lead: null };
            }),
        );

        return enrichedEvents;
    },
});

// Get events for a specific lead
export const getEventsByLead = query({
    args: {
        leadId: v.id("leads"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("events")
            .withIndex("by_lead_id", (q) => q.eq("lead_id", args.leadId))
            .order("desc")
            .collect();
    },
});

// Get events for a specific lead, bucketed by upcoming vs past on the server
export const getLeadEventsBuckets = query({
    args: {
        leadId: v.id("leads"),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const events = await ctx.db
            .query("events")
            .withIndex("by_lead_id", (q) => q.eq("lead_id", args.leadId))
            .order("desc")
            .collect();

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

// Get a single event by ID
export const getEventById = query({
    args: {
        id: v.id("events"),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.id);
        if (!event) return null;

        // Enrich with lead data if linked
        if (event.lead_id) {
            const lead = await ctx.db.get(event.lead_id);
            return { ...event, lead };
        }
        return { ...event, lead: null };
    },
});

// Get events within a date range (for calendar views)
export const getEventsInRange = query({
    args: {
        startTime: v.number(),
        endTime: v.number(),
    },
    handler: async (ctx, args) => {
        const events = await ctx.db
            .query("events")
            .withIndex("by_start_time")
            .filter((q) =>
                q.and(
                    q.gte(q.field("start_time"), args.startTime),
                    q.lte(q.field("start_time"), args.endTime),
                ),
            )
            .order("asc")
            .collect();

        // Enrich events with lead data
        const enrichedEvents = await Promise.all(
            events.map(async (event) => {
                if (event.lead_id) {
                    const lead = await ctx.db.get(event.lead_id);
                    return { ...event, lead };
                }
                return { ...event, lead: null };
            }),
        );

        return enrichedEvents;
    },
});
