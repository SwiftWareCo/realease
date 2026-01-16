import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

export const insertLead = internalMutation({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    property_address: v.optional(v.string()),
    timeline: v.optional(v.string()),
    intent: v.union(v.literal("buyer"), v.literal("seller"), v.literal("investor")),
    source: v.string(),
    urgency_score: v.number(),
    ai_suggestion: v.optional(v.string()),
    notes: v.optional(v.string()),
    conversion_prediction: v.optional(v.string()),
    last_message_sentiment: v.optional(v.union(v.literal("positive"), v.literal("neutral"), v.literal("negative"))),
    last_message_content: v.optional(v.string()),
    message_count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const leadId = await ctx.db.insert("leads", {
      name: args.name,
      phone: args.phone,
      email: args.email,
      property_address: args.property_address,
      timeline: args.timeline,
      intent: args.intent,
      source: args.source,
      urgency_score: args.urgency_score,
      status: "new",
      ai_suggestion: args.ai_suggestion,
      notes: args.notes,
      conversion_prediction: args.conversion_prediction,
      last_message_sentiment: args.last_message_sentiment,
      last_message_content: args.last_message_content,
      message_count: args.message_count ?? 0,
      created_at: Date.now(),
    });
    return leadId;
  },
});

export const updateLeadStatus = mutation({
  args: {
    id: v.id("leads"),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
    });
  },
});
