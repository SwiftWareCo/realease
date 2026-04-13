import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import {
    outreachCallOutcomeCounts,
    outreachStateCounts,
} from "./counters";

const DEFAULT_PAGE_SIZE = 500;

/**
 * One-shot backfill for the campaign-lead-state aggregate counter.
 *
 * Call it repeatedly with the returned `continueCursor` until `isDone` is
 * true. It uses `insertIfDoesNotExist` so live writes (which go through the
 * idempotent trigger on this table) remain safe.
 */
export const backfillOutreachStateCounts = internalMutation({
    args: {
        cursor: v.optional(v.union(v.string(), v.null())),
        numItems: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const pageSize = args.numItems ?? DEFAULT_PAGE_SIZE;
        const page = await ctx.db
            .query("outreachCampaignLeadStates")
            .paginate({ cursor: args.cursor ?? null, numItems: pageSize });

        for (const doc of page.page) {
            await outreachStateCounts.insertIfDoesNotExist(ctx, doc);
        }

        return {
            continueCursor: page.continueCursor,
            isDone: page.isDone,
            processed: page.page.length,
        };
    },
});

/**
 * One-shot backfill for the outreach-call outcome aggregate counter. Skips
 * ad-hoc (non-campaign) calls, which are not tracked in the aggregate.
 */
export const backfillOutreachCallOutcomeCounts = internalMutation({
    args: {
        cursor: v.optional(v.union(v.string(), v.null())),
        numItems: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const pageSize = args.numItems ?? DEFAULT_PAGE_SIZE;
        const page = await ctx.db
            .query("outreachCalls")
            .paginate({ cursor: args.cursor ?? null, numItems: pageSize });

        let processed = 0;
        for (const doc of page.page) {
            if (!doc.campaign_id) continue;
            await outreachCallOutcomeCounts.insertIfDoesNotExist(ctx, doc);
            processed += 1;
        }

        return {
            continueCursor: page.continueCursor,
            isDone: page.isDone,
            processed,
        };
    },
});
