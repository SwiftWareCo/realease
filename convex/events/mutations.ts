import { mutation } from '../_generated/server';
import { v } from 'convex/values';

// Create a new event
export const createEvent = mutation({
    args: {
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
        start_time: v.number(),
        end_time: v.number(),
        lead_id: v.optional(v.id('leads')),
        location: v.optional(v.string()),
        reminder_config: v.optional(
            v.object({
                send_reminder: v.boolean(),
                reminder_minutes_before: v.array(v.number()),
                channels: v.array(v.union(v.literal('sms'), v.literal('email'), v.literal('push'))),
                recipient: v.union(v.literal('realtor'), v.literal('client'), v.literal('both')),
            })
        ),
    },
    handler: async (ctx, args) => {
        // Generate AI preparation tips based on event type and lead
        let aiPreparation: string | undefined;

        if (args.lead_id) {
            const lead = await ctx.db.get(args.lead_id);
            if (lead) {
                // Generate contextual preparation tips
                const tips: string[] = [];

                if (args.event_type === 'showing') {
                    tips.push(`Review ${lead.name}'s property preferences`);
                    if (lead.intent === 'buyer') {
                        tips.push('Prepare comparable listings in the area');
                    } else if (lead.intent === 'seller') {
                        tips.push('Bring market analysis documents');
                    }
                } else if (args.event_type === 'call' || args.event_type === 'follow_up') {
                    tips.push(`Check last conversation notes with ${lead.name}`);
                    if (lead.notes) {
                        tips.push(`Remember: ${lead.notes.substring(0, 50)}...`);
                    }
                } else if (args.event_type === 'meeting') {
                    tips.push(`Review ${lead.name}'s full profile before meeting`);
                }

                if (lead.urgency_score >= 75) {
                    tips.push('⚠️ High urgency lead - prioritize closing discussions');
                }

                aiPreparation = tips.join(' • ');
            }
        } else {
            // Generic tips based on event type
            if (args.event_type === 'open_house') {
                aiPreparation = 'Prepare sign-in sheets • Check property presentation • Stock marketing materials';
            } else if (args.event_type === 'showing') {
                aiPreparation = 'Confirm property access • Review listing details • Prepare talking points';
            }
        }

        const eventId = await ctx.db.insert('events', {
            title: args.title,
            description: args.description,
            event_type: args.event_type,
            start_time: args.start_time,
            end_time: args.end_time,
            lead_id: args.lead_id,
            location: args.location,
            ai_preparation: aiPreparation,
            reminder_config: args.reminder_config,
            is_completed: false,
            created_at: Date.now(),
        });

        return eventId;
    },
});

// Update an existing event
export const updateEvent = mutation({
    args: {
        id: v.id('events'),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        event_type: v.optional(
            v.union(
                v.literal('showing'),
                v.literal('meeting'),
                v.literal('follow_up'),
                v.literal('call'),
                v.literal('open_house'),
                v.literal('other')
            )
        ),
        start_time: v.optional(v.number()),
        end_time: v.optional(v.number()),
        lead_id: v.optional(v.id('leads')),
        location: v.optional(v.string()),
        is_completed: v.optional(v.boolean()),
        reminder_config: v.optional(
            v.object({
                send_reminder: v.boolean(),
                reminder_minutes_before: v.array(v.number()),
                channels: v.array(v.union(v.literal('sms'), v.literal('email'), v.literal('push'))),
                recipient: v.union(v.literal('realtor'), v.literal('client'), v.literal('both')),
            })
        ),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;

        // Filter out undefined values
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, value]) => value !== undefined)
        );

        await ctx.db.patch(id, filteredUpdates);
        return id;
    },
});

// Mark event as completed
export const markEventCompleted = mutation({
    args: {
        id: v.id('events'),
        completed: v.boolean(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { is_completed: args.completed });
        return args.id;
    },
});

// Delete an event
export const deleteEvent = mutation({
    args: {
        id: v.id('events'),
    },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return args.id;
    },
});
