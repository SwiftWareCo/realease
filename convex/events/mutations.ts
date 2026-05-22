import { mutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentUserIdOrThrow, requireLeadOwner } from "../auth";

async function canMutateEvent(
    ctx: MutationCtx,
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

function buildGenericPreparation(eventType: Doc<"events">["event_type"]) {
    if (eventType === "open_house") {
        return "Prepare sign-in sheets, property presentation, and marketing materials";
    }
    if (eventType === "showing") {
        return "Confirm property access, review listing details, and prepare talking points";
    }
    return undefined;
}

function buildLeadPreparation(args: {
    eventType: Doc<"events">["event_type"];
    lead: Doc<"leads">;
}) {
    const tips: string[] = [];

    if (args.eventType === "showing") {
        tips.push(`Review ${args.lead.name}'s property preferences`);
        if (args.lead.intent === "buyer") {
            tips.push("Prepare comparable listings in the area");
        } else if (args.lead.intent === "seller") {
            tips.push("Bring market analysis documents");
        }
    } else if (args.eventType === "call" || args.eventType === "follow_up") {
        tips.push(`Check last conversation notes with ${args.lead.name}`);
        if (args.lead.notes) {
            tips.push(`Remember: ${args.lead.notes.substring(0, 50)}...`);
        }
    } else if (args.eventType === "meeting") {
        tips.push(`Review ${args.lead.name}'s full profile before meeting`);
    }

    if (args.lead.urgency_score >= 75) {
        tips.push("High urgency lead - prioritize closing discussions");
    }

    return tips.length > 0 ? tips.join(" | ") : undefined;
}

// Create a new event.
export const createEvent = mutation({
    args: {
        title: v.string(),
        description: v.optional(v.string()),
        event_type: v.union(
            v.literal("showing"),
            v.literal("meeting"),
            v.literal("follow_up"),
            v.literal("call"),
            v.literal("open_house"),
            v.literal("other"),
        ),
        start_time: v.number(),
        end_time: v.number(),
        lead_id: v.optional(v.id("leads")),
        location: v.optional(v.string()),
        reminder_config: v.optional(
            v.object({
                send_reminder: v.boolean(),
                reminder_minutes_before: v.array(v.number()),
                channels: v.array(
                    v.union(
                        v.literal("sms"),
                        v.literal("email"),
                        v.literal("push"),
                    ),
                ),
                recipient: v.union(
                    v.literal("realtor"),
                    v.literal("client"),
                    v.literal("both"),
                ),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const lead = args.lead_id
            ? (await requireLeadOwner(ctx, args.lead_id)).lead
            : null;
        const aiPreparation = lead
            ? buildLeadPreparation({ eventType: args.event_type, lead })
            : buildGenericPreparation(args.event_type);

        return await ctx.db.insert("events", {
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
            created_by_user_id: userId,
            created_at: Date.now(),
        });
    },
});

// Update an existing event.
export const updateEvent = mutation({
    args: {
        id: v.id("events"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        event_type: v.optional(
            v.union(
                v.literal("showing"),
                v.literal("meeting"),
                v.literal("follow_up"),
                v.literal("call"),
                v.literal("open_house"),
                v.literal("other"),
            ),
        ),
        start_time: v.optional(v.number()),
        end_time: v.optional(v.number()),
        lead_id: v.optional(v.id("leads")),
        location: v.optional(v.string()),
        is_completed: v.optional(v.boolean()),
        reminder_config: v.optional(
            v.object({
                send_reminder: v.boolean(),
                reminder_minutes_before: v.array(v.number()),
                channels: v.array(
                    v.union(
                        v.literal("sms"),
                        v.literal("email"),
                        v.literal("push"),
                    ),
                ),
                recipient: v.union(
                    v.literal("realtor"),
                    v.literal("client"),
                    v.literal("both"),
                ),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const event = await ctx.db.get(args.id);
        if (!event || !(await canMutateEvent(ctx, event, userId))) {
            throw new Error("Event not found");
        }
        if (args.lead_id) {
            await requireLeadOwner(ctx, args.lead_id);
        }

        const { id, ...updates } = args;
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, value]) => value !== undefined),
        );

        if (Object.keys(filteredUpdates).length > 0) {
            await ctx.db.patch(id, {
                ...filteredUpdates,
                created_by_user_id: event.created_by_user_id ?? userId,
            });
        }
        return id;
    },
});

// Mark event as completed.
export const markEventCompleted = mutation({
    args: {
        id: v.id("events"),
        completed: v.boolean(),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const event = await ctx.db.get(args.id);
        if (!event || !(await canMutateEvent(ctx, event, userId))) {
            throw new Error("Event not found");
        }
        await ctx.db.patch(args.id, {
            is_completed: args.completed,
            created_by_user_id: event.created_by_user_id ?? userId,
        });
        return args.id;
    },
});

// Delete an event.
export const deleteEvent = mutation({
    args: {
        id: v.id("events"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const event = await ctx.db.get(args.id);
        if (!event || !(await canMutateEvent(ctx, event, userId))) {
            throw new Error("Event not found");
        }
        await ctx.db.delete(args.id);
        return args.id;
    },
});
