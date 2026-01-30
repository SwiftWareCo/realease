import { defineTable } from "convex/server";
import { v } from "convex/values";

export const leadsTable = defineTable({
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    property_address: v.optional(v.string()),
    timeline: v.optional(v.string()),
    intent: v.union(
        v.literal("buyer"),
        v.literal("seller"),
        v.literal("investor"),
    ),
    source: v.string(), // "sms_link_open_house", "qr_code_123", etc.
    urgency_score: v.number(),
    status: v.union(
        v.literal("new"),
        v.literal("contacted"),
        v.literal("qualified"),
    ),
    // Lead type for buyer/seller kanban assignment (null = network only)
    lead_type: v.optional(v.union(v.literal("buyer"), v.literal("seller"))),
    // Buyer pipeline stages
    buyer_pipeline_stage: v.optional(
        v.union(
            v.literal("searching"),
            v.literal("showings"),
            v.literal("offer_out"),
            v.literal("under_contract"),
            v.literal("closed"),
        ),
    ),
    // Seller pipeline stages
    seller_pipeline_stage: v.optional(
        v.union(
            v.literal("pre_listing"),
            v.literal("on_market"),
            v.literal("offer_in"),
            v.literal("under_contract"),
            v.literal("sold"),
        ),
    ),
    // Buyer-specific fields
    budget: v.optional(v.string()), // e.g., "$400K - $500K"
    preferred_location: v.optional(v.string()), // Preferred area for buyers
    // Seller-specific fields
    list_price: v.optional(v.number()), // Listing price in cents
    listed_date: v.optional(v.number()), // Timestamp for days-on-market calculation
    ai_suggestion: v.optional(v.string()),
    notes: v.optional(v.string()), // Free-form context from lead capture form
    conversion_prediction: v.optional(v.string()), // AI prediction: "Within 7 days", "Within 30 days", etc.
    last_message_sentiment: v.optional(
        v.union(
            v.literal("positive"),
            v.literal("neutral"),
            v.literal("negative"),
        ),
    ),
    last_message_content: v.optional(v.string()),
    message_count: v.optional(v.number()), // Track number of messages exchanged
    created_at: v.number(),
})
    .index("by_status", ["status"])
    .index("by_source", ["source"])
    .index("by_lead_type", ["lead_type"]);

