import { defineTable } from "convex/server";
import { v } from "convex/values";

export const leadsTable = defineTable({
  name: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  property_address: v.optional(v.string()),
  timeline: v.optional(v.string()),
  intent: v.union(v.literal("buyer"), v.literal("seller"), v.literal("investor")),
  source: v.string(), // "sms_link_open_house", "qr_code_123", etc.
  urgency_score: v.number(),
  status: v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified")),
  ai_suggestion: v.optional(v.string()),
  created_at: v.number(),
})
  .index("by_status", ["status"])
  .index("by_source", ["source"]);
