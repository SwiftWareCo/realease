import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { NATIONAL_REGION_KEY } from "./metrics.schema";
import type { Doc } from "../_generated/dataModel";

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

type Region = { city: string; state?: string; country: string };

function buildRegionKey(region: Region) {
    return `${region.city.toLowerCase().replace(/\s+/g, "-")}-${region.state?.toLowerCase() || ""}-${region.country.toLowerCase()}`;
}

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
 * Get KPI metrics for display. Returns national metrics + region-specific metrics.
 * Auth-gated: returns null for unauthenticated users.
 */
export const getKPIMetrics = query({
    args: {
        regionKeys: v.optional(v.array(v.string())),
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
        const userRegions = user?.marketRegions ?? [];
        const effectiveRegionKeys =
            args.regionKeys && args.regionKeys.length > 0
                ? args.regionKeys
                : userRegions.map((region) => buildRegionKey(region));

        // Always fetch national metrics
        const nationalMetrics = await ctx.db
            .query("marketMetrics")
            .withIndex("by_region", (q) =>
                q.eq("regionKey", NATIONAL_REGION_KEY),
            )
            .take(20);

        // Fetch region-specific metrics if requested
        let regionMetrics: typeof nationalMetrics = [];
        if (effectiveRegionKeys.length > 0) {
            const batches = await Promise.all(
                effectiveRegionKeys.map((regionKey) =>
                    ctx.db
                        .query("marketMetrics")
                        .withIndex("by_region", (q) =>
                            q.eq("regionKey", regionKey),
                        )
                        .take(20),
                ),
            );
            regionMetrics = batches.flat();
        }

        const allMetrics = [...nationalMetrics, ...regionMetrics];

        const selectedRegionKeys = new Set(effectiveRegionKeys);

        // Deduplicate by metricKey — prefer selected region over national, then bank_of_canada, then newest
        const seen = new Map<string, (typeof allMetrics)[0]>();
        for (const m of allMetrics) {
            const existing = seen.get(m.metricKey);
            const incomingRegionPreferred =
                m.regionKey !== NATIONAL_REGION_KEY &&
                selectedRegionKeys.has(m.regionKey);
            const existingRegionPreferred =
                existing?.regionKey !== NATIONAL_REGION_KEY &&
                existing &&
                selectedRegionKeys.has(existing.regionKey);

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
    args: {
        regionKey: v.optional(v.string()),
        regionKeys: v.optional(v.array(v.string())),
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
        const userRegions = user?.marketRegions ?? [];

        const userRegionKeys = userRegions.map((region) =>
            buildRegionKey(region),
        );
        const requestedRegionKeys = (args.regionKeys ?? []).filter(
            (value) => value.trim().length > 0,
        );

        // For multi-region selections, prefer a standardized national summary first.
        const summaryLookupOrder = Array.from(
            new Set(
                [
                    args.regionKey,
                    requestedRegionKeys.length > 1
                        ? NATIONAL_REGION_KEY
                        : undefined,
                    ...requestedRegionKeys,
                    ...(userRegions.length === 1
                        ? [userRegionKeys[0]]
                        : userRegionKeys),
                    NATIONAL_REGION_KEY,
                ].filter((value): value is string => Boolean(value)),
            ),
        );

        let summary: Doc<"marketSummaries"> | null = null;
        let resolvedRegionKey = NATIONAL_REGION_KEY;

        for (const candidateRegionKey of summaryLookupOrder) {
            const candidateSummary = await ctx.db
                .query("marketSummaries")
                .withIndex("by_region", (q) =>
                    q.eq("regionKey", candidateRegionKey),
                )
                .unique();
            if (candidateSummary) {
                summary = candidateSummary;
                resolvedRegionKey = candidateRegionKey;
                break;
            }
        }

        if (!summary) return null;

        let effectiveSummary = summary;
        let regionalHighlights: string[] = [];
        if (requestedRegionKeys.length > 1) {
            const regionalSummaries = await Promise.all(
                requestedRegionKeys.map((regionKey) =>
                    ctx.db
                        .query("marketSummaries")
                        .withIndex("by_region", (q) =>
                            q.eq("regionKey", regionKey),
                        )
                        .unique(),
                ),
            );

            regionalHighlights = Array.from(
                new Set(
                    regionalSummaries
                        .filter(
                            (row): row is Doc<"marketSummaries"> =>
                                row !== null,
                        )
                        .flatMap((row) => row.keyDrivers ?? []),
                ),
            )
                .filter(
                    (driver) => !effectiveSummary.keyDrivers.includes(driver),
                )
                .slice(0, 2);

            if (regionalHighlights.length > 0) {
                effectiveSummary = {
                    ...effectiveSummary,
                    keyDrivers: Array.from(
                        new Set([
                            ...effectiveSummary.keyDrivers,
                            ...regionalHighlights,
                        ]),
                    ).slice(0, 4),
                };
            }
        }

        const normalizedInterests = dedupeInterests(
            args.interestCategories ?? user?.marketInterests,
        );
        if (normalizedInterests.length === 0) {
            return {
                ...effectiveSummary,
                regionalHighlights,
            };
        }

        const allowedCategories = new Set<string>(normalizedInterests);
        const [regionMetrics, nationalMetrics] = await Promise.all([
            ctx.db
                .query("marketMetrics")
                .withIndex("by_region", (q) =>
                    q.eq("regionKey", resolvedRegionKey),
                )
                .take(20),
            ctx.db
                .query("marketMetrics")
                .withIndex("by_region", (q) =>
                    q.eq("regionKey", NATIONAL_REGION_KEY),
                )
                .take(20),
        ]);

        const focusedMetrics = [...regionMetrics, ...nationalMetrics].filter(
            (metric) => {
                if (!allowedCategories.has(metric.category)) {
                    return false;
                }
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
            },
        );

        if (focusedMetrics.length === 0) {
            return {
                ...effectiveSummary,
                regionalHighlights,
            };
        }

        const topFocused = focusedMetrics.slice(0, 3);
        const categoryLabels: Record<string, string> = {
            home_prices: "Home prices",
            inventory: "Inventory",
            mortgage_rates: "Mortgage rates",
            market_trend: "Market trends",
        };

        const interestLabels = normalizedInterests.map(
            (interest) =>
                categoryLabels[interest] ?? interest.replace(/_/g, " "),
        );

        const focusedLine = topFocused
            .map((metric) => `${metric.label} ${metric.formattedValue}`)
            .join(", ");

        return {
            ...effectiveSummary,
            keyDrivers: Array.from(
                new Set([...interestLabels, ...effectiveSummary.keyDrivers]),
            ).slice(0, 4),
            focusTopics: interestLabels,
            focusMetrics: focusedLine,
            regionalHighlights,
        };
    },
});
