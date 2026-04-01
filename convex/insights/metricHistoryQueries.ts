import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { NATIONAL_REGION_KEY } from "./metrics.schema";
import {
    GVR_GRAND_TOTAL_REGION_KEY,
    getGvrAreaForRegionKey,
} from "./gvrActivityMapping";
import { getSupportedRegions } from "./sources";

const DEFAULT_GVR_REGION_KEY = "greater-vancouver-bc-ca";
const DEFAULT_GVR_METRIC_KEYS = [
    "gvr_mls_benchmark_price",
    "gvr_detached_benchmark_price",
    "gvr_townhouse_benchmark_price",
    "gvr_apartment_benchmark_price",
    "gvr_detached_sales",
    "gvr_attached_sales",
    "gvr_apartment_sales",
    "gvr_detached_listings",
    "gvr_attached_listings",
    "gvr_apartment_listings",
    "gvr_mls_sales",
    "gvr_new_listings",
    "gvr_active_listings",
    "gvr_sales_to_active_ratio",
] as const;

const ACTIVITY_PROPERTY_TYPES = ["detached", "attached", "apartment"] as const;
type ActivityPropertyType = (typeof ACTIVITY_PROPERTY_TYPES)[number];

function getActivityMetricKey(
    propertyType: ActivityPropertyType,
    series: "listings" | "sales",
) {
    if (propertyType === "detached") {
        return series === "listings"
            ? "gvr_detached_listings"
            : "gvr_detached_sales";
    }
    if (propertyType === "attached") {
        return series === "listings"
            ? "gvr_attached_listings"
            : "gvr_attached_sales";
    }
    return series === "listings"
        ? "gvr_apartment_listings"
        : "gvr_apartment_sales";
}

function shiftMonth(date: string, monthDelta: number) {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return date;
    const d = new Date(
        Date.UTC(
            parseInt(match[1], 10),
            parseInt(match[2], 10) - 1 + monthDelta,
            1,
        ),
    );
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Get historical rate data for chart display.
 * Returns chart-ready data: [{ date, boc_policy_rate, prime_rate, ... }]
 * Auth-gated.
 */
export const getRateHistory = query({
    args: {
        metricKeys: v.array(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const regionKey = NATIONAL_REGION_KEY;

        // Collect all data points per metric
        const allPoints: Array<{
            date: string;
            metricKey: string;
            value: number;
        }> = [];

        const defaultStartDate = new Date();
        defaultStartDate.setFullYear(defaultStartDate.getFullYear() - 1);
        const startDate =
            args.startDate ?? defaultStartDate.toISOString().slice(0, 10);
        const requestedMetricKeys = [...new Set(args.metricKeys)];

        for (const metricKey of requestedMetricKeys) {
            const q = ctx.db
                .query("metricHistory")
                .withIndex("by_region_metric_date", (idx) => {
                    const base = idx
                        .eq("regionKey", regionKey)
                        .eq("metricKey", metricKey);
                    return base.gte("date", startDate);
                })
                .order("asc");

            const rows = await q.take(500);

            for (const row of rows) {
                if (args.endDate && row.date > args.endDate) continue;
                allPoints.push({
                    date: row.date,
                    metricKey: row.metricKey,
                    value: row.value,
                });
            }
        }

        if (allPoints.length === 0) return [];

        // Pivot into chart-ready format: { date, metric1, metric2, ... }
        const byDate = new Map<string, Record<string, number | string>>();

        for (const point of allPoints) {
            if (!byDate.has(point.date)) {
                byDate.set(point.date, { date: point.date });
            }
            byDate.get(point.date)![point.metricKey] = point.value;
        }

        // Sort by date ascending
        const result = Array.from(byDate.values()).sort((a, b) =>
            (a.date as string).localeCompare(b.date as string),
        );

        // Prefer aligned dates where all requested series are present.
        // This makes hover behavior and comparisons across lines more reliable.
        const aligned = result.filter((row) =>
            requestedMetricKeys.every(
                (metricKey) => typeof row[metricKey] === "number",
            ),
        );

        return aligned.length > 0 ? aligned : result;
    },
});

/**
 * Internal query used by ingestion flows to derive trend/previous value.
 */
export const getPreviousMetricPoint = internalQuery({
    args: {
        regionKey: v.string(),
        metricKey: v.string(),
        beforeDate: v.string(),
    },
    returns: v.union(
        v.object({
            date: v.string(),
            value: v.number(),
            source: v.string(),
            fetchedAt: v.number(),
        }),
        v.null(),
    ),
    handler: async (ctx, args) => {
        const rows = await ctx.db
            .query("metricHistory")
            .withIndex("by_region_metric_date", (idx) =>
                idx
                    .eq("regionKey", args.regionKey)
                    .eq("metricKey", args.metricKey)
                    .lt("date", args.beforeDate),
            )
            .order("desc")
            .take(1);

        const row = rows[0];
        if (!row) {
            return null;
        }

        return {
            date: row.date,
            value: row.value,
            source: row.source,
            fetchedAt: row.fetchedAt,
        };
    },
});

/**
 * Get monthly GVR metric history by region.
 * Returns chart-ready rows: [{ date, gvr_mls_benchmark_price, ... }].
 * Auth-gated.
 */
export const getGvrMonthlyHistory = query({
    args: {
        regionKey: v.optional(v.string()),
        metricKeys: v.optional(v.array(v.string())),
        months: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const regionKey = args.regionKey ?? DEFAULT_GVR_REGION_KEY;
        const requestedMetricKeys = Array.from(
            new Set(
                args.metricKeys && args.metricKeys.length > 0
                    ? args.metricKeys
                    : [...DEFAULT_GVR_METRIC_KEYS],
            ),
        );
        const months = Math.max(
            1,
            Math.min(120, Math.floor(args.months ?? 24)),
        );

        const now = new Date();
        const startDate = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
        )
            .toISOString()
            .slice(0, 10);

        const allPoints: Array<{
            date: string;
            metricKey: string;
            value: number;
        }> = [];

        for (const metricKey of requestedMetricKeys) {
            const rows = await ctx.db
                .query("metricHistory")
                .withIndex("by_region_metric_date", (idx) =>
                    idx
                        .eq("regionKey", regionKey)
                        .eq("metricKey", metricKey)
                        .gte("date", startDate),
                )
                .order("asc")
                .take(240);

            for (const row of rows) {
                allPoints.push({
                    date: row.date,
                    metricKey: row.metricKey,
                    value: row.value,
                });
            }
        }

        if (allPoints.length === 0) return [];

        const byDate = new Map<string, Record<string, number | string>>();
        for (const point of allPoints) {
            if (!byDate.has(point.date)) {
                byDate.set(point.date, { date: point.date });
            }
            byDate.get(point.date)![point.metricKey] = point.value;
        }

        const result = Array.from(byDate.values()).sort((a, b) =>
            (a.date as string).localeCompare(b.date as string),
        );

        const aligned = result.filter((row) =>
            requestedMetricKeys.every(
                (metricKey) => typeof row[metricKey] === "number",
            ),
        );

        return aligned.length > 0 ? aligned : result;
    },
});

/**
 * Get monthly GVR metric history for multiple regions.
 * Returns [{ regionKey, rows: [{ date, metricA, metricB, ... }] }].
 * Auth-gated.
 */
export const getGvrMonthlyHistoryByRegions = query({
    args: {
        regionKeys: v.array(v.string()),
        metricKeys: v.optional(v.array(v.string())),
        months: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const requestedRegionKeys = Array.from(
            new Set(args.regionKeys.filter((key) => key.trim().length > 0)),
        );
        if (requestedRegionKeys.length === 0) {
            return [];
        }

        const requestedMetricKeys = Array.from(
            new Set(
                args.metricKeys && args.metricKeys.length > 0
                    ? args.metricKeys
                    : [...DEFAULT_GVR_METRIC_KEYS],
            ),
        );
        const months = Math.max(
            1,
            Math.min(120, Math.floor(args.months ?? 24)),
        );

        const now = new Date();
        const startDate = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
        )
            .toISOString()
            .slice(0, 10);

        const rowsByRegion: Array<{
            regionKey: string;
            rows: Array<Record<string, number | string>>;
        }> = [];

        for (const regionKey of requestedRegionKeys) {
            const allPoints: Array<{
                date: string;
                metricKey: string;
                value: number;
            }> = [];

            for (const metricKey of requestedMetricKeys) {
                const rows = await ctx.db
                    .query("metricHistory")
                    .withIndex("by_region_metric_date", (idx) =>
                        idx
                            .eq("regionKey", regionKey)
                            .eq("metricKey", metricKey)
                            .gte("date", startDate),
                    )
                    .order("asc")
                    .take(240);

                for (const row of rows) {
                    allPoints.push({
                        date: row.date,
                        metricKey: row.metricKey,
                        value: row.value,
                    });
                }
            }

            if (allPoints.length === 0) {
                rowsByRegion.push({ regionKey, rows: [] });
                continue;
            }

            const byDate = new Map<string, Record<string, number | string>>();
            for (const point of allPoints) {
                if (!byDate.has(point.date)) {
                    byDate.set(point.date, { date: point.date });
                }
                byDate.get(point.date)![point.metricKey] = point.value;
            }

            const result = Array.from(byDate.values()).sort((a, b) =>
                (a.date as string).localeCompare(b.date as string),
            );

            const aligned = result.filter((row) =>
                requestedMetricKeys.every(
                    (metricKey) => typeof row[metricKey] === "number",
                ),
            );

            rowsByRegion.push({
                regionKey,
                rows: aligned.length > 0 ? aligned : result,
            });
        }

        return rowsByRegion;
    },
});

/**
 * Compare selected region activity vs GVR grand totals.
 * Returns month columns (same month prev year, previous month, current month) for listings/sales by property type.
 */
export const getGvrActivityComparisons = query({
    args: {
        regionKeys: v.optional(v.array(v.string())),
    },
    returns: v.union(
        v.object({
            comparisonDates: v.object({
                previousYearSameMonth: v.string(),
                previousMonth: v.string(),
                currentMonth: v.string(),
            }),
            regions: v.array(
                v.object({
                    regionKey: v.string(),
                    regionLabel: v.string(),
                    areaLabel: v.optional(v.string()),
                    rows: v.array(
                        v.object({
                            propertyType: v.union(
                                v.literal("detached"),
                                v.literal("attached"),
                                v.literal("apartment"),
                            ),
                            listings: v.object({
                                previousYear: v.optional(v.number()),
                                previousMonth: v.optional(v.number()),
                                currentMonth: v.optional(v.number()),
                                grandCurrentMonth: v.optional(v.number()),
                                currentMonthShareOfGrandPct: v.optional(
                                    v.number(),
                                ),
                            }),
                            sales: v.object({
                                previousYear: v.optional(v.number()),
                                previousMonth: v.optional(v.number()),
                                currentMonth: v.optional(v.number()),
                                grandCurrentMonth: v.optional(v.number()),
                                currentMonthShareOfGrandPct: v.optional(
                                    v.number(),
                                ),
                            }),
                        }),
                    ),
                }),
            ),
        }),
        v.null(),
    ),
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) =>
                q.eq("externalId", identity.subject),
            )
            .unique();

        const userRegionKeys = (user?.marketRegions ?? []).map(
            (region) =>
                `${region.city.toLowerCase().replace(/\s+/g, "-")}-${region.state?.toLowerCase() || ""}-${region.country.toLowerCase()}`,
        );

        const selectedRegionKeys = Array.from(
            new Set(
                (args.regionKeys && args.regionKeys.length > 0
                    ? args.regionKeys
                    : userRegionKeys
                ).filter((k) => k.length > 0),
            ),
        );

        if (selectedRegionKeys.length === 0) {
            return null;
        }

        const grandRows = await ctx.db
            .query("metricHistory")
            .withIndex("by_region_metric", (q) =>
                q
                    .eq("regionKey", GVR_GRAND_TOTAL_REGION_KEY)
                    .eq("metricKey", "gvr_detached_listings"),
            )
            .order("desc")
            .take(1);

        const latestGrandRow = grandRows[0];
        if (!latestGrandRow) {
            return null;
        }

        const currentMonth = latestGrandRow.date;
        const previousMonth = shiftMonth(currentMonth, -1);
        const previousYearSameMonth = shiftMonth(currentMonth, -12);
        const comparisonDates = {
            previousYearSameMonth,
            previousMonth,
            currentMonth,
        };

        const regionLabelByKey = new Map(
            getSupportedRegions().map((r) => [
                r.key,
                `${r.city}${r.state ? `, ${r.state}` : ""}`,
            ]),
        );

        const regions = [];
        for (const regionKey of selectedRegionKeys) {
            const rows = [];
            for (const propertyType of ACTIVITY_PROPERTY_TYPES) {
                const listingsKey = getActivityMetricKey(
                    propertyType,
                    "listings",
                );
                const salesKey = getActivityMetricKey(propertyType, "sales");

                const [
                    listingsPrevYear,
                    listingsPrevMonth,
                    listingsCurrent,
                    listingsGrandCurrent,
                    salesPrevYear,
                    salesPrevMonth,
                    salesCurrent,
                    salesGrandCurrent,
                ] = await Promise.all([
                    ctx.db
                        .query("metricHistory")
                        .withIndex("by_region_metric_date", (q) =>
                            q
                                .eq("regionKey", regionKey)
                                .eq("metricKey", listingsKey)
                                .eq("date", previousYearSameMonth),
                        )
                        .unique(),
                    ctx.db
                        .query("metricHistory")
                        .withIndex("by_region_metric_date", (q) =>
                            q
                                .eq("regionKey", regionKey)
                                .eq("metricKey", listingsKey)
                                .eq("date", previousMonth),
                        )
                        .unique(),
                    ctx.db
                        .query("metricHistory")
                        .withIndex("by_region_metric_date", (q) =>
                            q
                                .eq("regionKey", regionKey)
                                .eq("metricKey", listingsKey)
                                .eq("date", currentMonth),
                        )
                        .unique(),
                    ctx.db
                        .query("metricHistory")
                        .withIndex("by_region_metric_date", (q) =>
                            q
                                .eq("regionKey", GVR_GRAND_TOTAL_REGION_KEY)
                                .eq("metricKey", listingsKey)
                                .eq("date", currentMonth),
                        )
                        .unique(),
                    ctx.db
                        .query("metricHistory")
                        .withIndex("by_region_metric_date", (q) =>
                            q
                                .eq("regionKey", regionKey)
                                .eq("metricKey", salesKey)
                                .eq("date", previousYearSameMonth),
                        )
                        .unique(),
                    ctx.db
                        .query("metricHistory")
                        .withIndex("by_region_metric_date", (q) =>
                            q
                                .eq("regionKey", regionKey)
                                .eq("metricKey", salesKey)
                                .eq("date", previousMonth),
                        )
                        .unique(),
                    ctx.db
                        .query("metricHistory")
                        .withIndex("by_region_metric_date", (q) =>
                            q
                                .eq("regionKey", regionKey)
                                .eq("metricKey", salesKey)
                                .eq("date", currentMonth),
                        )
                        .unique(),
                    ctx.db
                        .query("metricHistory")
                        .withIndex("by_region_metric_date", (q) =>
                            q
                                .eq("regionKey", GVR_GRAND_TOTAL_REGION_KEY)
                                .eq("metricKey", salesKey)
                                .eq("date", currentMonth),
                        )
                        .unique(),
                ]);

                const listingsCurrentValue = listingsCurrent?.value;
                const listingsGrandCurrentValue = listingsGrandCurrent?.value;
                const salesCurrentValue = salesCurrent?.value;
                const salesGrandCurrentValue = salesGrandCurrent?.value;

                rows.push({
                    propertyType,
                    listings: {
                        previousYear: listingsPrevYear?.value,
                        previousMonth: listingsPrevMonth?.value,
                        currentMonth: listingsCurrentValue,
                        grandCurrentMonth: listingsGrandCurrentValue,
                        currentMonthShareOfGrandPct:
                            listingsCurrentValue !== undefined &&
                            listingsGrandCurrentValue !== undefined &&
                            listingsGrandCurrentValue > 0
                                ? Math.round(
                                      (listingsCurrentValue /
                                          listingsGrandCurrentValue) *
                                          10_000,
                                  ) / 100
                                : undefined,
                    },
                    sales: {
                        previousYear: salesPrevYear?.value,
                        previousMonth: salesPrevMonth?.value,
                        currentMonth: salesCurrentValue,
                        grandCurrentMonth: salesGrandCurrentValue,
                        currentMonthShareOfGrandPct:
                            salesCurrentValue !== undefined &&
                            salesGrandCurrentValue !== undefined &&
                            salesGrandCurrentValue > 0
                                ? Math.round(
                                      (salesCurrentValue /
                                          salesGrandCurrentValue) *
                                          10_000,
                                  ) / 100
                                : undefined,
                    },
                });
            }

            regions.push({
                regionKey,
                regionLabel: regionLabelByKey.get(regionKey) ?? regionKey,
                areaLabel: getGvrAreaForRegionKey(regionKey),
                rows,
            });
        }

        return {
            comparisonDates,
            regions,
        };
    },
});
