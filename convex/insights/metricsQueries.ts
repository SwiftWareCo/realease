import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import {
    APP_MARKET_SUMMARY_REGION_KEY,
    NATIONAL_REGION_KEY,
} from "./metrics.schema";

type SupportedInterestCategory =
    | "home_prices"
    | "inventory"
    | "mortgage_rates"
    | "market_trend";

const GVR_MVP_METRIC_KEYS = new Set([
    "gvr_mls_benchmark_price",
    "gvr_mls_sales",
    "gvr_new_listings",
    "gvr_active_listings",
    "gvr_sales_to_active_ratio",
]);

function dedupeInterests(
    values: SupportedInterestCategory[] | undefined,
): SupportedInterestCategory[] {
    return Array.from(new Set(values ?? []));
}

/**
 * Internal query: get metrics for a specific region (used by summary generation action).
 */
export const getMetricsByRegion = internalQuery({
    args: { regionKey: v.string() },
    handler: async (ctx, { regionKey }) => {
        return await ctx.db
            .query("marketMetrics")
            .withIndex("by_region", (q) => q.eq("regionKey", regionKey))
            .take(20);
    },
});

/**
 * Get KPI metrics for display.
 * Returns national rates plus GVR-wide metrics regardless of selected regions.
 * Auth-gated: returns null for unauthenticated users.
 */
export const getKPIMetrics = query({
    args: {
        interestCategories: v.optional(
            v.array(
                v.union(
                    v.literal("home_prices"),
                    v.literal("inventory"),
                    v.literal("mortgage_rates"),
                    v.literal("market_trend"),
                ),
            ),
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) =>
                q.eq("externalId", identity.subject),
            )
            .unique();

        const [nationalMetrics, gvrMetrics] = await Promise.all([
            ctx.db
                .query("marketMetrics")
                .withIndex("by_region", (q) =>
                    q.eq("regionKey", NATIONAL_REGION_KEY),
                )
                .take(20),
            ctx.db
                .query("marketMetrics")
                .withIndex("by_region", (q) =>
                    q.eq("regionKey", APP_MARKET_SUMMARY_REGION_KEY),
                )
                .take(20),
        ]);

        const allMetrics = [...nationalMetrics, ...gvrMetrics];

        // Deduplicate by metricKey — prefer GVR row over national, then bank_of_canada, then newest.
        const seen = new Map<string, (typeof nationalMetrics)[0]>();
        for (const m of allMetrics) {
            const existing = seen.get(m.metricKey);
            const incomingRegionPreferred =
                m.regionKey === APP_MARKET_SUMMARY_REGION_KEY;
            const existingRegionPreferred =
                existing?.regionKey === APP_MARKET_SUMMARY_REGION_KEY;

            if (
                !existing ||
                (incomingRegionPreferred && !existingRegionPreferred) ||
                (m.source === "bank_of_canada" &&
                    existing.source !== "bank_of_canada") ||
                (m.source === existing.source &&
                    m.fetchedAt > existing.fetchedAt)
            ) {
                seen.set(m.metricKey, m);
            }
        }
        const dedupedMetrics = Array.from(seen.values()).filter((metric) => {
            if (metric.category === "home_prices") {
                return GVR_MVP_METRIC_KEYS.has(metric.metricKey);
            }
            if (metric.category === "inventory") {
                return GVR_MVP_METRIC_KEYS.has(metric.metricKey);
            }
            if (metric.metricKey.startsWith("gvr_")) {
                return GVR_MVP_METRIC_KEYS.has(metric.metricKey);
            }
            return true;
        });

        // Sort: mortgage_rates first, then home_prices, inventory, market_trend
        const categoryPriority: Record<string, number> = {
            mortgage_rates: 0,
            home_prices: 1,
            inventory: 2,
            market_trend: 3,
        };

        dedupedMetrics.sort(
            (a, b) =>
                (categoryPriority[a.category] ?? 99) -
                (categoryPriority[b.category] ?? 99),
        );

        const normalizedInterests = dedupeInterests(
            args.interestCategories ?? user?.marketInterests,
        );
        if (normalizedInterests.length === 0) {
            return dedupedMetrics;
        }

        const allowedCategories = new Set<string>(normalizedInterests);
        return dedupedMetrics.filter((metric) =>
            allowedCategories.has(metric.category),
        );
    },
});

/**
 * Get the market summary for a region.
 * Auth-gated: returns null for unauthenticated users.
 */
export const getMarketSummary = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const summary = await ctx.db
            .query("marketSummaries")
            .withIndex("by_region", (q) =>
                q.eq("regionKey", APP_MARKET_SUMMARY_REGION_KEY),
            )
            .unique();

        if (!summary) {
            return null;
        }

        return {
            ...summary,
            // Older summary rows may not include this optional field.
            summaryStatus: summary.summaryStatus ?? "ai",
        };
    },
});
