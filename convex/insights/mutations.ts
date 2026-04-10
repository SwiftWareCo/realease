import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Delete expired insight rows from active Insights tables.
 */
export const cleanupExpired = internalMutation({
    args: {},
    returns: v.object({ deleted: v.number() }),
    handler: async (ctx) => {
        const now = Date.now();
        let deleted = 0;

        const expiredMetrics = await ctx.db
            .query("marketMetrics")
            .withIndex("by_expires", (q) => q.lt("expiresAt", now))
            .take(200);

        for (const metric of expiredMetrics) {
            await ctx.db.delete(metric._id);
            deleted += 1;
        }

        const expiredSummaries = await ctx.db
            .query("marketSummaries")
            .withIndex("by_expires", (q) => q.lt("expiresAt", now))
            .take(50);

        for (const summary of expiredSummaries) {
            await ctx.db.delete(summary._id);
            deleted += 1;
        }

        if (deleted > 0) {
            console.log(
                `[Insights] Cleaned up ${deleted} expired rows (metrics + summaries)`,
            );
        }

        return { deleted };
    },
});
