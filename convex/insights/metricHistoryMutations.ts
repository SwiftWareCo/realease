import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Batch upsert historical metric rows.
 * Skips rows that already exist (regionKey + metricKey + date).
 */
export const batchUpsertHistory = internalMutation({
  args: {
    rows: v.array(
      v.object({
        regionKey: v.string(),
        metricKey: v.string(),
        date: v.string(),
        value: v.number(),
        source: v.string(),
        fetchedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    let inserted = 0;
    for (const row of rows) {
      const existing = await ctx.db
        .query("metricHistory")
        .withIndex("by_region_metric_date", (q) =>
          q
            .eq("regionKey", row.regionKey)
            .eq("metricKey", row.metricKey)
            .eq("date", row.date),
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("metricHistory", row);
        inserted++;
      } else if (existing.value !== row.value) {
        await ctx.db.patch(existing._id, {
          value: row.value,
          fetchedAt: row.fetchedAt,
        });
        inserted++;
      }
    }
    return { inserted };
  },
});
