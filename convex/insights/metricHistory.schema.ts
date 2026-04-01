import { defineTable } from "convex/server";
import { v } from "convex/values";

export const metricHistoryTable = defineTable({
  regionKey: v.string(),
  metricKey: v.string(),
  date: v.string(), // ISO "YYYY-MM-DD"
  value: v.number(),
  source: v.string(),
  fetchedAt: v.number(),
})
  .index("by_region_metric_date", ["regionKey", "metricKey", "date"])
  .index("by_region_metric", ["regionKey", "metricKey"]);
