import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
    metricTrendSchema,
    metricCategorySchema,
    marketConditionSchema,
    marketSummaryStatusSchema,
} from "./metrics.schema";

const AUTHORITATIVE_STRUCTURED_SOURCES = new Set([
    "bank_of_canada",
    "gvr_market_watch",
]);
const EXPIRY_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

type UpsertMetricArgs = {
    regionKey: string;
    metricKey: string;
    label: string;
    value: number;
    formattedValue: string;
    previousValue?: number;
    trend: "up" | "down" | "neutral";
    changePercent?: number;
    changeFormatted?: string;
    unit: string;
    category:
        | "mortgage_rates"
        | "home_prices"
        | "inventory"
        | "market_trend"
        | "rental";
    source: string;
    sourceLabel: string;
    referenceDate: string;
    fetchedAt: number;
    expiresAt: number;
};

function optionalNumberEqual(a: number | undefined, b: number | undefined) {
    return (a ?? null) === (b ?? null);
}

function optionalStringEqual(a: string | undefined, b: string | undefined) {
    return (a ?? null) === (b ?? null);
}

function hasMaterialMetricChange(
    existing: Doc<"marketMetrics">,
    next: UpsertMetricArgs,
) {
    return !(
        existing.regionKey === next.regionKey &&
        existing.metricKey === next.metricKey &&
        existing.label === next.label &&
        existing.value === next.value &&
        existing.formattedValue === next.formattedValue &&
        optionalNumberEqual(existing.previousValue, next.previousValue) &&
        existing.trend === next.trend &&
        optionalNumberEqual(existing.changePercent, next.changePercent) &&
        optionalStringEqual(existing.changeFormatted, next.changeFormatted) &&
        existing.unit === next.unit &&
        existing.category === next.category &&
        existing.source === next.source &&
        existing.sourceLabel === next.sourceLabel &&
        existing.referenceDate === next.referenceDate
    );
}

/**
 * Upsert a metric row. If a row for (regionKey, metricKey) exists, patch it;
 * otherwise insert a new row.
 */
export const upsertMetric = internalMutation({
    args: {
        regionKey: v.string(),
        metricKey: v.string(),
        label: v.string(),
        value: v.number(),
        formattedValue: v.string(),
        previousValue: v.optional(v.number()),
        trend: metricTrendSchema,
        changePercent: v.optional(v.number()),
        changeFormatted: v.optional(v.string()),
        unit: v.string(),
        category: metricCategorySchema,
        source: v.string(),
        sourceLabel: v.string(),
        referenceDate: v.string(),
        fetchedAt: v.number(),
        expiresAt: v.number(),
    },
    handler: async (ctx, args: UpsertMetricArgs) => {
        const existing = await ctx.db
            .query("marketMetrics")
            .withIndex("by_region_and_metric", (q) =>
                q
                    .eq("regionKey", args.regionKey)
                    .eq("metricKey", args.metricKey),
            )
            .unique();

        if (existing) {
            // Don't let AI-extracted metrics overwrite authoritative structured sources.
            if (
                AUTHORITATIVE_STRUCTURED_SOURCES.has(existing.source) &&
                args.source === "ai_extracted"
            ) {
                return;
            }

            const hasChanges = hasMaterialMetricChange(existing, args);
            if (!hasChanges) {
                const shouldRefreshExpiry =
                    existing.expiresAt <= Date.now() + EXPIRY_REFRESH_WINDOW_MS;
                if (!shouldRefreshExpiry) {
                    return;
                }

                await ctx.db.patch(existing._id, {
                    fetchedAt: args.fetchedAt,
                    expiresAt: args.expiresAt,
                });
                return;
            }

            await ctx.db.patch(existing._id, args);
        } else {
            await ctx.db.insert("marketMetrics", args);
        }
    },
});

/**
 * Upsert a market summary for a region.
 */
export const upsertMarketSummary = internalMutation({
    args: {
        regionKey: v.string(),
        summary: v.string(),
        summaryStatus: v.optional(marketSummaryStatusSchema),
        marketCondition: marketConditionSchema,
        keyDrivers: v.array(v.string()),
        confidence: v.optional(
            v.object({
                level: v.union(
                    v.literal("high"),
                    v.literal("medium"),
                    v.literal("low"),
                ),
                reason: v.string(),
            }),
        ),
        whatChanged: v.optional(v.string()),
        actionableIntel: v.optional(
            v.object({
                seller: v.string(),
                buyer: v.string(),
                sellerObjection: v.optional(
                    v.object({
                        objection: v.string(),
                        response: v.string(),
                    }),
                ),
                buyerObjection: v.optional(
                    v.object({
                        objection: v.string(),
                        response: v.string(),
                    }),
                ),
            }),
        ),
        whyThisGuidance: v.optional(
            v.object({
                rationale: v.string(),
                rateImpact: v.string(),
                rateTranslation: v.optional(v.string()),
                evidence: v.array(v.string()),
            }),
        ),
        generatedAt: v.number(),
        expiresAt: v.number(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("marketSummaries")
            .withIndex("by_region", (q) => q.eq("regionKey", args.regionKey))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, args);
        } else {
            await ctx.db.insert("marketSummaries", args);
        }
    },
});
