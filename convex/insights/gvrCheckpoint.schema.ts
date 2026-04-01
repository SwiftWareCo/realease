import { defineTable } from "convex/server";
import { v } from "convex/values";

export const GVR_SOURCE_KEY = "gvr_market_watch";

/**
 * Stores the last successfully ingested GVR Market Watch report.
 * Discovery compares against this checkpoint to decide whether
 * ingest should run again.
 */
export const gvrCheckpointTable = defineTable({
    sourceKey: v.string(),
    lastReportUrl: v.string(),
    lastReportMonth: v.string(), // YYYY-MM
    lastPublishedAt: v.optional(v.string()),
    lastIngestedAt: v.number(),
    updatedAt: v.number(),
}).index("by_source_key", ["sourceKey"]);
