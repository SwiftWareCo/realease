import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Store a regional news context item.
 */
export const storeInsight = internalMutation({
    args: {
        regionKey: v.string(),
        region: v.object({
            city: v.string(),
            state: v.optional(v.string()),
            country: v.string(),
        }),
        category: v.union(
            v.literal("home_prices"),
            v.literal("inventory"),
            v.literal("mortgage_rates"),
            v.literal("market_trend"),
            v.literal("new_construction"),
            v.literal("rental"),
        ),
        title: v.string(),
        summary: v.string(),
        sourceUrl: v.string(),
        sourceName: v.string(),
        rawContent: v.optional(v.string()),
        relevanceScore: v.number(),
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
        aiSummary: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const expiresAt = now + 48 * 60 * 60 * 1000; // 48 hours

        // Deduplicate: if an item with the same regionKey+sourceUrl exists, patch it.
        const existing = await ctx.db
            .query("newsContextItems")
            .withIndex("by_region_source", (q) =>
                q
                    .eq("regionKey", args.regionKey)
                    .eq("sourceUrl", args.sourceUrl),
            )
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                ...args,
                dataPoints: args.dataPoints ?? [],
                fetchedAt: now,
                expiresAt,
            });
            console.log(
                `[NewsContext] Updated: ${args.title} for ${args.regionKey}`,
            );
        } else {
            await ctx.db.insert("newsContextItems", {
                ...args,
                dataPoints: args.dataPoints ?? [],
                fetchedAt: now,
                expiresAt,
            });
            console.log(
                `[NewsContext] Stored: ${args.title} for ${args.regionKey}`,
            );
        }
    },
});

/**
 * Log a news context source ingestion attempt.
 */
export const logFetch = internalMutation({
    args: {
        regionKey: v.string(),
        sourceUrl: v.string(),
        sourceName: v.string(),
        success: v.boolean(),
        contentLength: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("newsIngestionLog", {
            ...args,
            fetchedAt: Date.now(),
        });
    },
});

/**
 * Delete expired insights (can be called periodically)
 */
export const cleanupExpired = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        let deleted = 0;

        // Clean expired news context rows
        const expiredInsights = await ctx.db
            .query("newsContextItems")
            .withIndex("by_expires", (q) => q.lt("expiresAt", now))
            .take(200);

        for (const insight of expiredInsights) {
            await ctx.db.delete(insight._id);
            deleted++;
        }

        // Clean expired metrics
        const expiredMetrics = await ctx.db
            .query("marketMetrics")
            .withIndex("by_expires", (q) => q.lt("expiresAt", now))
            .take(200);

        for (const metric of expiredMetrics) {
            await ctx.db.delete(metric._id);
            deleted++;
        }

        // Clean expired summaries
        const expiredSummaries = await ctx.db
            .query("marketSummaries")
            .withIndex("by_expires", (q) => q.lt("expiresAt", now))
            .take(50);

        for (const summary of expiredSummaries) {
            await ctx.db.delete(summary._id);
            deleted++;
        }

        if (deleted > 0) {
            console.log(
                `[Insights] Cleaned up ${deleted} expired rows (news context + metrics + summaries)`,
            );
        }
        return { deleted };
    },
});

/**
 * Delete insights for a specific source (for refresh)
 */
export const deleteBySource = internalMutation({
    args: {
        regionKey: v.string(),
        sourceUrl: v.string(),
    },
    handler: async (ctx, { regionKey, sourceUrl }) => {
        let deleted = 0;
        while (true) {
            const insights = await ctx.db
                .query("newsContextItems")
                .withIndex("by_region_source", (q) =>
                    q.eq("regionKey", regionKey).eq("sourceUrl", sourceUrl),
                )
                .take(200);
            if (insights.length === 0) {
                break;
            }

            for (const insight of insights) {
                await ctx.db.delete(insight._id);
                deleted += 1;
            }
        }

        return { deleted };
    },
});
