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

export const updateBuyerPipelineStage = mutation({
  args: {
    id: v.id("leads"),
    stage: v.union(
      v.literal("searching"),
      v.literal("showings"),
      v.literal("offer_out"),
      v.literal("under_contract"),
      v.literal("closed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      buyer_pipeline_stage: args.stage,
    });
  },
});

export const updateSellerPipelineStage = mutation({
  args: {
    id: v.id("leads"),
    stage: v.union(
      v.literal("pre_listing"),
      v.literal("on_market"),
      v.literal("offer_in"),
      v.literal("under_contract"),
      v.literal("sold"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      seller_pipeline_stage: args.stage,
    });
  },
});

// For future Network page integration - assign lead as buyer or seller
export const setLeadType = mutation({
  args: {
    id: v.id("leads"),
    leadType: v.union(v.literal("buyer"), v.literal("seller")),
    // Initial pipeline stage when assigning
    initialBuyerStage: v.optional(v.literal("searching")),
    initialSellerStage: v.optional(v.literal("pre_listing")),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      lead_type: args.leadType,
    };

    if (args.leadType === "buyer") {
      updates.buyer_pipeline_stage = args.initialBuyerStage ?? "searching";
    } else {
      updates.seller_pipeline_stage = args.initialSellerStage ?? "pre_listing";
    }

    await ctx.db.patch(args.id, updates);
  },
});

