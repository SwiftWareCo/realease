import { defineTable } from "convex/server";
import { v } from "convex/values";

export const GVR_SOURCE_KEY = "gvr_market_watch";

/**
 * Generic ingestion checkpoint table.
 * Stores the last successfully ingested artifact per source.
 */
export const ingestionCheckpointTable = defineTable({
    sourceKey: v.string(),
    lastArtifactUrl: v.string(),
    lastArtifactPeriod: v.string(), // e.g. YYYY-MM
    lastPublishedAt: v.optional(v.string()),
    lastIngestedAt: v.number(),
    updatedAt: v.number(),
}).index("by_source_key", ["sourceKey"]);
