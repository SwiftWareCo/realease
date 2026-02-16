import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Store a market insight
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
      v.literal('home_prices'),
      v.literal('inventory'),
      v.literal('mortgage_rates'),
      v.literal('market_trend'),
      v.literal('new_construction'),
      v.literal('rental'),
    ),
    title: v.string(),
    summary: v.string(),
    sourceUrl: v.string(),
    sourceName: v.string(),
    rawContent: v.optional(v.string()),
    relevanceScore: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 48 * 60 * 60 * 1000; // 48 hours

    await ctx.db.insert("marketInsights", {
      ...args,
      fetchedAt: now,
      expiresAt,
      dataPoints: [],
    });

    console.log(`[Insights] Stored: ${args.title} for ${args.regionKey}`);
  },
});

/**
 * Log a fetch attempt
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
    await ctx.db.insert("insightFetchLog", {
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
    const expired = await ctx.db
      .query("marketInsights")
      .withIndex("by_expires", q => q.lt("expiresAt", now))
      .collect();

    for (const insight of expired) {
      await ctx.db.delete(insight._id);
    }

    console.log(`[Insights] Cleaned up ${expired.length} expired insights`);
    return { deleted: expired.length };
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
    const insights = await ctx.db
      .query("marketInsights")
      .withIndex("by_region", q => q.eq("regionKey", regionKey))
      .filter(q => q.eq(q.field("sourceUrl"), sourceUrl))
      .collect();

    for (const insight of insights) {
      await ctx.db.delete(insight._id);
    }

    return { deleted: insights.length };
  },
});
