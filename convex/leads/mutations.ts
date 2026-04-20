import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserIdOrThrow, requireLeadOwner } from "../auth";

function normalizeNoteEntries(notes: Array<string | undefined>): string[] {
  const uniqueNotes = new Set<string>();
  const normalized: string[] = [];

  for (const note of notes) {
    const value = note?.trim();
    if (!value || uniqueNotes.has(value)) {
      continue;
    }
    uniqueNotes.add(value);
    normalized.push(value);
  }

  return normalized;
}

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
    notes_items: v.optional(v.array(v.string())),
    conversion_prediction: v.optional(v.string()),
    last_message_sentiment: v.optional(v.union(v.literal("positive"), v.literal("neutral"), v.literal("negative"))),
    last_message_content: v.optional(v.string()),
    message_count: v.optional(v.number()),
    created_by_user_id: v.id("users"),
  },
  handler: async (ctx, args) => {
    const notesToInsert = normalizeNoteEntries([
      args.notes,
      ...(args.notes_items ?? []),
    ]);
    const now = Date.now();

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
      notes: notesToInsert.at(-1),
      conversion_prediction: args.conversion_prediction,
      last_message_sentiment: args.last_message_sentiment,
      last_message_content: args.last_message_content,
      message_count: args.message_count ?? 0,
      created_by_user_id: args.created_by_user_id,
      created_at: now,
    });

    for (const [index, note] of notesToInsert.entries()) {
      await ctx.db.insert("leadNotes", {
        lead_id: leadId,
        body: note,
        created_by_user_id: args.created_by_user_id,
        created_at: now + index,
      });
    }

    return leadId;
  },
});

export const updateLeadStatus = mutation({
  args: {
    id: v.id("leads"),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified")),
  },
  handler: async (ctx, args) => {
    await requireLeadOwner(ctx, args.id);
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
    await requireLeadOwner(ctx, args.id);
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
    await requireLeadOwner(ctx, args.id);
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
    await requireLeadOwner(ctx, args.id);
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

// Public mutation for manually creating leads from the UI
export const createLead = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    property_address: v.optional(v.string()),
    timeline: v.optional(v.string()),
    intent: v.union(v.literal("buyer"), v.literal("seller"), v.literal("investor")),
    source: v.string(),
    urgency_score: v.optional(v.number()),
    notes: v.optional(v.string()),
    notes_items: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified"))),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrThrow(ctx);
    const notesToInsert = normalizeNoteEntries([
      args.notes,
      ...(args.notes_items ?? []),
    ]);
    const now = Date.now();

    const leadId = await ctx.db.insert("leads", {
      name: args.name,
      phone: args.phone,
      email: args.email,
      property_address: args.property_address,
      timeline: args.timeline,
      intent: args.intent,
      source: args.source,
      urgency_score: args.urgency_score ?? 50, // Default urgency
      status: args.status ?? "new",
      notes: notesToInsert.at(-1),
      message_count: 0,
      created_by_user_id: userId,
      created_at: now,
    });

    for (const [index, note] of notesToInsert.entries()) {
      await ctx.db.insert("leadNotes", {
        lead_id: leadId,
        body: note,
        created_by_user_id: userId,
        created_at: now + index,
      });
    }

    return leadId;
  },
});

export const updateLead = mutation({
  args: {
    id: v.id("leads"),
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    property_address: v.optional(v.string()),
    timeline: v.optional(v.string()),
    intent: v.union(v.literal("buyer"), v.literal("seller"), v.literal("investor")),
    source: v.string(),
    urgency_score: v.optional(v.number()),
    notes: v.optional(v.string()),
    notes_items: v.optional(v.array(v.string())),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireLeadOwner(ctx, args.id);
    const notesToInsert = normalizeNoteEntries([
      args.notes,
      ...(args.notes_items ?? []),
    ]);
    const now = Date.now();
    const updates: Record<string, unknown> = {
      name: args.name,
      phone: args.phone,
      email: args.email,
      property_address: args.property_address,
      timeline: args.timeline,
      intent: args.intent,
      source: args.source,
      urgency_score: args.urgency_score,
      status: args.status,
    };

    if (notesToInsert.length > 0) {
      updates.notes = notesToInsert[notesToInsert.length - 1];
    } else if (args.notes !== undefined) {
      updates.notes = args.notes;
    }

    await ctx.db.patch(args.id, updates);

    for (const [index, note] of notesToInsert.entries()) {
      await ctx.db.insert("leadNotes", {
        lead_id: args.id,
        body: note,
        created_by_user_id: userId,
        created_at: now + index,
      });
    }
  },
});

export const addLeadNote = mutation({
  args: {
    leadId: v.id("leads"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireLeadOwner(ctx, args.leadId);
    const body = args.body.trim();
    if (!body) {
      throw new Error("Note cannot be empty.");
    }

    const now = Date.now();
    const noteId = await ctx.db.insert("leadNotes", {
      lead_id: args.leadId,
      body,
      created_by_user_id: userId,
      created_at: now,
    });

    await ctx.db.patch(args.leadId, {
      notes: body,
    });

    return noteId;
  },
});

// Add a tag to a lead
export const addTag = mutation({
  args: {
    id: v.id("leads"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    const { lead } = await requireLeadOwner(ctx, args.id);

    const currentTags = lead.tags ?? [];
    // Don't add duplicate tags
    if (currentTags.includes(args.tag)) return;

    await ctx.db.patch(args.id, {
      tags: [...currentTags, args.tag],
    });
  },
});

// Remove a tag from a lead
export const removeTag = mutation({
  args: {
    id: v.id("leads"),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    const { lead } = await requireLeadOwner(ctx, args.id);

    const currentTags = lead.tags ?? [];
    await ctx.db.patch(args.id, {
      tags: currentTags.filter(t => t !== args.tag),
    });
  },
});
