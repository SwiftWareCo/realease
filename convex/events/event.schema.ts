import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const eventsTable = defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    event_type: v.union(
        v.literal('showing'),
        v.literal('meeting'),
        v.literal('follow_up'),
        v.literal('call'),
        v.literal('open_house'),
        v.literal('other')
    ),
    start_time: v.number(), // Unix timestamp
    end_time: v.number(), // Unix timestamp
    lead_id: v.optional(v.id('leads')), // Optional link to a lead
    location: v.optional(v.string()),
    // AI-generated preparation tips based on event type and linked lead
    ai_preparation: v.optional(v.string()),
    // Future integration config for reminders
    reminder_config: v.optional(
        v.object({
            send_reminder: v.boolean(),
            reminder_minutes_before: v.array(v.number()), // e.g., [1440, 60] for 1 day and 1 hour before
            channels: v.array(v.union(v.literal('sms'), v.literal('email'), v.literal('push'))),
            recipient: v.union(v.literal('realtor'), v.literal('client'), v.literal('both')),
        })
    ),
    is_completed: v.boolean(),
    created_at: v.number(),
})
    .index('by_start_time', ['start_time'])
    .index('by_lead_id', ['lead_id'])
    .index('by_event_type', ['event_type']);
