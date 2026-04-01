import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Shared constant for the national (Canada-wide) region key */
export const NATIONAL_REGION_KEY = "national-ca";

export const metricTrendSchema = v.union(
  v.literal("up"),
  v.literal("down"),
  v.literal("neutral"),
);

export const metricCategorySchema = v.union(
  v.literal("mortgage_rates"),
  v.literal("home_prices"),
  v.literal("inventory"),
  v.literal("market_trend"),
  v.literal("rental"),
);

export const marketConditionSchema = v.union(
  v.literal("buyers"),
  v.literal("balanced"),
  v.literal("sellers"),
);

export const marketMetricsTable = defineTable({
  regionKey: v.string(), // e.g., "national-ca" or "vancouver-bc-ca"
  metricKey: v.string(), // e.g., "boc_policy_rate", "median_price"
  label: v.string(), // Display label: "BoC Policy Rate"
  value: v.number(),
  formattedValue: v.string(), // "4.50%"
  previousValue: v.optional(v.number()),
  trend: metricTrendSchema,
  changePercent: v.optional(v.number()),
  changeFormatted: v.optional(v.string()), // "+0.25%"
  unit: v.string(), // "percent", "cad", "days", "count"
  category: metricCategorySchema,
  source: v.string(), // "bank_of_canada", "ai_extracted"
  sourceLabel: v.string(), // "Bank of Canada Valet API"
  referenceDate: v.string(), // ISO date of the data point
  fetchedAt: v.number(),
  expiresAt: v.number(),
})
  .index("by_region", ["regionKey"])
  .index("by_region_and_metric", ["regionKey", "metricKey"])
  .index("by_region_and_category", ["regionKey", "category"])
  .index("by_expires", ["expiresAt"]);

export const marketSummariesTable = defineTable({
  regionKey: v.string(),
  summary: v.string(), // 2-3 sentence AI summary
  marketCondition: marketConditionSchema,
  keyDrivers: v.array(v.string()), // e.g., ["Rising rates", "Low inventory"]
  generatedAt: v.number(),
  expiresAt: v.number(),
})
  .index("by_region", ["regionKey"])
  .index("by_expires", ["expiresAt"]);
