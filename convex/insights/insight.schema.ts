import { defineTable } from "convex/server";
import { v } from "convex/values";

export const insightCategorySchema = v.union(
    v.literal("home_prices"),
    v.literal("inventory"),
    v.literal("mortgage_rates"),
    v.literal("market_trend"),
    v.literal("new_construction"),
    v.literal("rental"),
);

const newsContextItemFields = {
    // Region this insight applies to
    regionKey: v.string(), // e.g., "austin-tx-us"
    region: v.object({
        city: v.string(),
        state: v.optional(v.string()),
        country: v.string(),
    }),

    // Categorization
    category: insightCategorySchema,

    // Content
    title: v.string(),
    summary: v.string(),
    sourceUrl: v.string(),
    sourceName: v.string(),
    rawContent: v.optional(v.string()), // Full markdown from Jina

    // Extracted data points (structured)
    dataPoints: v.optional(
        v.array(
            v.object({
                label: v.string(),
                value: v.string(),
                trend: v.optional(
                    v.union(
                        v.literal("up"),
                        v.literal("down"),
                        v.literal("neutral"),
                    ),
                ),
            }),
        ),
    ),

    // AI-generated summary of the content
    aiSummary: v.optional(v.string()),

    // Metadata
    relevanceScore: v.number(), // 0-100
    fetchedAt: v.number(), // timestamp
    expiresAt: v.number(), // 48hr TTL
};

export const newsContextItemsTable = defineTable(newsContextItemFields)
    .index("by_region", ["regionKey"])
    .index("by_region_category", ["regionKey", "category"])
    .index("by_expires", ["expiresAt"])
    .index("by_region_source", ["regionKey", "sourceUrl"]);

// Track which sources were fetched when
const newsIngestionLogFields = {
    regionKey: v.string(),
    sourceUrl: v.string(),
    sourceName: v.string(),
    fetchedAt: v.number(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    contentLength: v.optional(v.number()),
};

export const newsIngestionLogTable = defineTable(newsIngestionLogFields)
    .index("by_region", ["regionKey"])
    .index("by_fetched_at", ["fetchedAt"]);
