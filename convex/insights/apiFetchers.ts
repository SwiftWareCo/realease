import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
    APP_MARKET_SUMMARY_REGION_KEY,
    NATIONAL_REGION_KEY,
} from "./metrics.schema";

// Bank of Canada Valet API series
// https://www.bankofcanada.ca/valet/docs
const BOC_SERIES = [
    {
        seriesId: "V39079",
        metricKey: "boc_policy_rate",
        label: "BoC Overnight Rate",
        unit: "percent",
    },
    {
        seriesId: "V80691335",
        metricKey: "5yr_fixed_mortgage",
        label: "5-Year Fixed Mortgage",
        unit: "percent",
    },
    {
        seriesId: "V80691334",
        metricKey: "3yr_fixed_mortgage",
        label: "3-Year Fixed Mortgage",
        unit: "percent",
    },
    {
        seriesId: "V80691311",
        metricKey: "prime_rate",
        label: "Prime Rate",
        unit: "percent",
    },
] as const;
const MARKET_METRIC_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type ValetObservation = {
    d: string; // date "YYYY-MM-DD"
    [seriesId: string]: { v: string } | string;
};

type ValetResponse = {
    observations?: ValetObservation[];
};

function toTimestamp(date: string): number {
    const ts = Date.parse(`${date}T00:00:00Z`);
    return Number.isNaN(ts) ? -Infinity : ts;
}

function getLatestAndPreviousForSeries(
    observations: ValetObservation[],
    seriesId: string,
) {
    const valid = observations
        .map((obs) => {
            const entry = obs[seriesId];
            if (!entry || typeof entry === "string") return null;
            const value = parseFloat(entry.v);
            if (isNaN(value)) return null;
            return { obs, value };
        })
        .filter(
            (x): x is { obs: ValetObservation; value: number } => x !== null,
        )
        .sort((a, b) => toTimestamp(a.obs.d) - toTimestamp(b.obs.d));

    if (valid.length === 0) {
        return null;
    }

    const latest = valid[valid.length - 1];
    const previous = valid.length > 1 ? valid[valid.length - 2] : null;
    return { latest, previous };
}

/**
 * Fetch mortgage rate data from the Bank of Canada Valet API
 * and upsert into the marketMetrics table.
 */
export const fetchBankOfCanadaRates = internalAction({
    args: {},
    returns: v.object({
        success: v.boolean(),
        metricsUpserted: v.number(),
        error: v.optional(v.string()),
    }),
    handler: async (ctx) => {
        const seriesIds = BOC_SERIES.map((s) => s.seriesId).join(",");
        const url = `https://www.bankofcanada.ca/valet/observations/${seriesIds}/json?recent=365`;

        console.log("[BoC] Fetching rates from Valet API");

        try {
            const response = await fetch(url, {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                throw new Error(`Valet API returned ${response.status}`);
            }

            const data = (await response.json()) as ValetResponse;
            const observations = data.observations;

            if (!observations || observations.length === 0) {
                throw new Error("No observations returned from Valet API");
            }

            let upserted = 0;
            let historyRowsUpserted = 0;
            const now = Date.now();
            const expiresAt = now + MARKET_METRIC_TTL_MS;
            const historyRows: Array<{
                regionKey: string;
                metricKey: string;
                date: string;
                value: number;
                source: string;
                fetchedAt: number;
            }> = [];

            for (const series of BOC_SERIES) {
                const seriesPair = getLatestAndPreviousForSeries(
                    observations,
                    series.seriesId,
                );
                if (!seriesPair) {
                    console.warn(
                        `[BoC] Series ${series.label} (${series.seriesId}) has no usable observations in recent window`,
                    );
                    continue;
                }

                const latestObservation = seriesPair.latest.obs;
                const value = seriesPair.latest.value;
                const previousObservation = seriesPair.previous?.obs ?? null;

                let previousValue: number | undefined;
                let trend: "up" | "down" | "neutral" = "neutral";
                let changePercent: number | undefined;
                let changeFormatted: string | undefined;
                const referenceDate = latestObservation.d;

                if (previousObservation) {
                    const prevEntry = previousObservation[series.seriesId];
                    if (prevEntry && typeof prevEntry !== "string") {
                        if (seriesPair.previous) {
                            previousValue = seriesPair.previous.value;
                            const pv = previousValue;
                            const diff = value - pv;
                            if (Math.abs(diff) < 0.001) {
                                trend = "neutral";
                            } else {
                                trend = diff > 0 ? "up" : "down";
                            }
                            if (Math.abs(diff) >= 0.001) {
                                changePercent =
                                    pv !== 0 ? (diff / pv) * 100 : 0;
                                const sign = diff > 0 ? "+" : "";
                                changeFormatted = `${sign}${diff.toFixed(2)}%`;
                            } else {
                                changePercent = undefined;
                                changeFormatted = undefined;
                            }
                        }
                    }
                }

                await ctx.runMutation(
                    internal.insights.metricsMutations.upsertMetric,
                    {
                        regionKey: NATIONAL_REGION_KEY,
                        metricKey: series.metricKey,
                        label: series.label,
                        value,
                        formattedValue: `${value.toFixed(2)}%`,
                        previousValue,
                        trend,
                        changePercent,
                        changeFormatted,
                        unit: series.unit,
                        category: "mortgage_rates",
                        source: "bank_of_canada",
                        sourceLabel: "Bank of Canada Valet API",
                        referenceDate,
                        fetchedAt: now,
                        expiresAt,
                    },
                );

                historyRows.push({
                    regionKey: NATIONAL_REGION_KEY,
                    metricKey: series.metricKey,
                    date: referenceDate,
                    value,
                    source: "bank_of_canada",
                    fetchedAt: now,
                });

                upserted++;
            }

            if (historyRows.length > 0) {
                const result: { inserted: number } = await ctx.runMutation(
                    internal.insights.metricHistoryMutations.batchUpsertHistory,
                    { rows: historyRows },
                );
                historyRowsUpserted = result.inserted;
            }

            console.log(
                `[BoC] Upserted ${upserted} rate metrics and ${historyRowsUpserted} history rows`,
            );

            if (upserted > 0) {
                try {
                    await ctx.scheduler.runAfter(
                        0,
                        internal.insights.marketSummary.generateMarketSummary,
                        { regionKey: APP_MARKET_SUMMARY_REGION_KEY },
                    );
                } catch (error) {
                    console.error(
                        `[BoC][summary_schedule_failed] ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }

            return { success: true, metricsUpserted: upserted };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            console.error(`[BoC] Failed to fetch rates: ${message}`);
            return { success: false, metricsUpserted: 0, error: message };
        }
    },
});

/**
 * Fetch 12 months of historical rate data from Bank of Canada Valet API
 * and store in the metricHistory table.
 * Used for initial historical seeding/backfill.
 */
export const fetchBankOfCanadaHistoricalRates = internalAction({
    args: {},
    returns: v.object({
        success: v.boolean(),
        rowsInserted: v.number(),
        error: v.optional(v.string()),
    }),
    handler: async (ctx) => {
        const now = new Date();
        const endDate = now.toISOString().slice(0, 10);
        const startDate = new Date(
            now.getFullYear() - 1,
            now.getMonth(),
            now.getDate(),
        )
            .toISOString()
            .slice(0, 10);

        const seriesIds = BOC_SERIES.map((s) => s.seriesId).join(",");
        const url = `https://www.bankofcanada.ca/valet/observations/${seriesIds}/json?start_date=${startDate}&end_date=${endDate}`;

        console.log(`[BoC History] Fetching ${startDate} to ${endDate}`);

        try {
            const response = await fetch(url, {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                throw new Error(`Valet API returned ${response.status}`);
            }

            const data = (await response.json()) as ValetResponse;
            const observations = data.observations;

            if (!observations || observations.length === 0) {
                throw new Error("No historical observations returned");
            }

            const fetchedAt = Date.now();
            let totalInserted = 0;

            // Build rows from observations
            const allRows: Array<{
                regionKey: string;
                metricKey: string;
                date: string;
                value: number;
                source: string;
                fetchedAt: number;
            }> = [];

            for (const obs of observations) {
                for (const series of BOC_SERIES) {
                    const entry = obs[series.seriesId];
                    if (!entry || typeof entry === "string") continue;
                    const value = parseFloat(entry.v);
                    if (isNaN(value)) continue;

                    allRows.push({
                        regionKey: NATIONAL_REGION_KEY,
                        metricKey: series.metricKey,
                        date: obs.d,
                        value,
                        source: "bank_of_canada",
                        fetchedAt,
                    });
                }
            }

            // Insert in batches of 50
            for (let i = 0; i < allRows.length; i += 50) {
                const batch = allRows.slice(i, i + 50);
                const result: { inserted: number } = await ctx.runMutation(
                    internal.insights.metricHistoryMutations.batchUpsertHistory,
                    { rows: batch },
                );
                totalInserted += result.inserted;
            }

            console.log(
                `[BoC History] Processed ${observations.length} observations, inserted ${totalInserted} new rows`,
            );
            return { success: true, rowsInserted: totalInserted };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            console.error(`[BoC History] Failed: ${message}`);
            return { success: false, rowsInserted: 0, error: message };
        }
    },
});
