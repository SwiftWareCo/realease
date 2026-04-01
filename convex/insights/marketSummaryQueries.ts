import { internalQuery, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";

function isLikelyNoiseSummary(input: string) {
    const text = input.trim();
    if (!text) return true;
    if (text.startsWith("{") || text.startsWith("[")) return true;
    return /"status"\s*:|"code"\s*:|"data"\s*:|"warning"\s*:/.test(text);
}

async function loadRecentNewsContextSummaries(
    ctx: QueryCtx,
    regionKey: string,
) {
    const insights = await ctx.db
        .query("newsContextItems")
        .withIndex("by_region", (q) => q.eq("regionKey", regionKey))
        .order("desc")
        .take(20);

    return insights
        .filter((i) => !isLikelyNoiseSummary(i.summary))
        .slice(0, 10)
        .map((i) => ({
            category: i.category,
            summary: i.summary,
            title: i.title,
        }));
}

/**
 * Get recent news context summaries for a region (used by market summary generation).
 */
export const getRecentNewsContextSummaries = internalQuery({
    args: { regionKey: v.string() },
    handler: async (ctx, { regionKey }) => {
        return await loadRecentNewsContextSummaries(ctx, regionKey);
    },
});

/**
 * @deprecated Use getRecentNewsContextSummaries.
 */
export const getRecentInsightSummaries = internalQuery({
    args: { regionKey: v.string() },
    handler: async (ctx, { regionKey }) => {
        return await loadRecentNewsContextSummaries(ctx, regionKey);
    },
});
