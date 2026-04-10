import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

type GvrBackfillResult = {
    requestedMonths: number;
    processed: number;
    succeeded: number;
    failed: number;
};

const gvrBackfillResultSchema = v.object({
    requestedMonths: v.number(),
    processed: v.number(),
    succeeded: v.number(),
    failed: v.number(),
});

/**
 * Backfill recent GVR monthly reports into metric history.
 * Used for initial database population/historical seeding.
 */
export const backfillGvrHistory = action({
    args: {
        months: v.optional(v.number()),
    },
    returns: gvrBackfillResultSchema,
    handler: async (ctx, args): Promise<GvrBackfillResult> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const months = Math.max(1, Math.min(24, Math.floor(args.months ?? 12)));
        const result: GvrBackfillResult = await ctx.runAction(
            internal.insights.gvrDiscovery.backfillRecentGvrReports,
            { months },
        );
        return result;
    },
});
