"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { RateTrendChart } from "./RateTrendChart";
import {
    GvrActivityComparisonTable,
    type GvrActivityTableState,
} from "./GvrActivityComparisonTable";

const GVR_GRAND_TOTAL_REGION_KEY = "gvr-grand-total-ca";
const DEFAULT_GVR_REGION_KEY = "greater-vancouver-bc-ca";

type InterestCategory =
    | "home_prices"
    | "inventory"
    | "mortgage_rates"
    | "market_trend";

type RegionOption = {
    value: string;
    label: string;
};

type RegionalHistoryRows = Array<{
    regionKey: string;
    rows: Array<Record<string, number | string>>;
}>;

const HOME_PRICE_SERIES = [
    { metricKey: "gvr_mls_benchmark_price", label: "Composite" },
    { metricKey: "gvr_detached_benchmark_price", label: "Detached" },
    { metricKey: "gvr_townhouse_benchmark_price", label: "Townhouse" },
    { metricKey: "gvr_apartment_benchmark_price", label: "Apartment" },
] as const;

const HOME_PRICE_KEYS = HOME_PRICE_SERIES.map((s) => s.metricKey);

const LISTINGS_SERIES = [
    { metricKey: "gvr_new_listings", label: "All Property Types" },
    { metricKey: "gvr_detached_listings", label: "Detached" },
    { metricKey: "gvr_attached_listings", label: "Attached" },
    { metricKey: "gvr_apartment_listings", label: "Apartment" },
] as const;

const SALES_SERIES = [
    { metricKey: "gvr_mls_sales", label: "All Property Types" },
    { metricKey: "gvr_detached_sales", label: "Detached" },
    { metricKey: "gvr_attached_sales", label: "Attached" },
    { metricKey: "gvr_apartment_sales", label: "Apartment" },
] as const;

const RATE_SERIES = [
    { metricKey: "boc_policy_rate", label: "BoC Policy Rate" },
    { metricKey: "prime_rate", label: "Prime Rate" },
    { metricKey: "5yr_fixed_mortgage", label: "5-Year Fixed" },
    { metricKey: "3yr_fixed_mortgage", label: "3-Year Fixed" },
] as const;
const RATE_KEYS = RATE_SERIES.map((entry) => entry.metricKey);

function formatDateLabel(dateStr: string) {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("en-CA", { month: "short", year: "2-digit" });
}

function formatCurrencyCompact(value: number) {
    if (Math.abs(value) >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1_000) {
        return `$${(value / 1_000).toFixed(0)}K`;
    }
    return `$${Math.round(value)}`;
}

function formatCurrencyFull(value: number) {
    return `$${Math.round(value).toLocaleString("en-CA")}`;
}

function formatCountFull(value: number) {
    return Math.round(value).toLocaleString("en-CA");
}

function formatSignedCurrencyDelta(value: number) {
    const abs = Math.abs(value);
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${formatCurrencyFull(abs)}`;
}

function formatSignedPct(value: number) {
    const sign = value > 0 ? "+" : value < 0 ? "" : "";
    return `${sign}${value.toFixed(2)}%`;
}

function humanizeRegionKey(regionKey: string) {
    return regionKey
        .split("-")
        .slice(0, -2)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function getOverlayRegionColor(index: number) {
    const palette = [
        "var(--chart-2)",
        "var(--chart-3)",
        "var(--chart-4)",
        "var(--chart-5)",
    ];
    return palette[index % palette.length] ?? "var(--chart-2)";
}

function coerceNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function findLatestSeriesValue(
    rows: Array<Record<string, number | string | undefined>>,
    key: string,
) {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
        const value = rows[i]?.[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
    }
    return undefined;
}

function findLatestRowWithMetric(
    rows: Array<Record<string, number | string | undefined>>,
    metricKey: string,
) {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
        const value = rows[i]?.[metricKey];
        if (typeof value === "number" && Number.isFinite(value)) {
            return rows[i];
        }
    }
    return undefined;
}

function ChartSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-64" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-[220px] w-full rounded-md" />
            </CardContent>
        </Card>
    );
}

function RegionVisibilityToggles({
    regionOptions,
    hiddenRegionKeys,
    onToggle,
}: {
    regionOptions: RegionOption[];
    hiddenRegionKeys: string[];
    onToggle: (regionKey: string) => void;
}) {
    if (regionOptions.length <= 1) {
        return null;
    }

    return (
        <div className="space-y-1.5 rounded-md border p-2.5">
            <p className="text-xs text-muted-foreground">Visible regions</p>
            <div className="flex flex-wrap gap-2">
                {regionOptions.map((region, index) => {
                    const hidden = hiddenRegionKeys.includes(region.value);
                    return (
                        <Button
                            key={region.value}
                            type="button"
                            size="sm"
                            variant={hidden ? "outline" : "default"}
                            className="h-7"
                            onClick={() => onToggle(region.value)}
                        >
                            <span
                                className="mr-2 h-2.5 w-2.5 rounded-[2px]"
                                style={{
                                    backgroundColor: getOverlayRegionColor(index),
                                    opacity: hidden ? 0.35 : 1,
                                }}
                            />
                            {region.label}
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}

function RateTrendSummaryTable({ className }: { className?: string }) {
    const data = useQuery(api.insights.metricHistoryQueries.getRateHistory, {
        metricKeys: RATE_KEYS,
    });

    if (data === undefined) {
        return <ChartSkeleton />;
    }

    if (!data || data.length === 0) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="text-base">Rate Table</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No rate history available yet.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const rows = RATE_SERIES.map((series) => {
        const latestRow = findLatestRowWithMetric(data, series.metricKey);
        const latestValue =
            latestRow && typeof latestRow[series.metricKey] === "number"
                ? (latestRow[series.metricKey] as number)
                : undefined;
        const latestDate =
            latestRow && typeof latestRow.date === "string"
                ? latestRow.date
                : undefined;

        let previousValue: number | undefined;
        if (latestDate) {
            const latestIndex = data.findIndex((row) => row.date === latestDate);
            for (let i = latestIndex - 1; i >= 0; i -= 1) {
                const prev = data[i]?.[series.metricKey];
                if (typeof prev === "number" && Number.isFinite(prev)) {
                    previousValue = prev;
                    break;
                }
            }
        }

        const change =
            latestValue !== undefined && previousValue !== undefined
                ? latestValue - previousValue
                : undefined;

        return {
            label: series.label,
            latestValue,
            change,
            latestDate,
        };
    });

    const latestDateLabel = rows.find((row) => row.latestDate)?.latestDate;

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Rate Table</CardTitle>
                {latestDateLabel ? (
                    <p className="text-xs text-muted-foreground">
                        Latest month: {formatDateLabel(latestDateLabel)}
                    </p>
                ) : null}
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-[12px]">
                        <thead>
                            <tr className="border-b text-muted-foreground">
                                <th className="px-2 py-1.5 text-left font-medium">
                                    Metric
                                </th>
                                <th className="px-2 py-1.5 text-right font-medium">
                                    Latest
                                </th>
                                <th className="px-2 py-1.5 text-right font-medium">
                                    MoM
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.label} className="border-b last:border-0">
                                    <td className="px-2 py-1.5 font-medium">
                                        {row.label}
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">
                                        {row.latestValue !== undefined
                                            ? formatSignedPct(row.latestValue).replace(
                                                  "+",
                                                  "",
                                              )
                                            : "-"}
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                        {row.change !== undefined
                                            ? formatSignedPct(row.change)
                                            : "-"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function HomePriceComparisonTable({
    allRegions,
    hiddenRegionKeys,
    className,
}: {
    allRegions: RegionOption[];
    hiddenRegionKeys: string[];
    className?: string;
}) {
    const visibleRegions = useMemo(
        () =>
            allRegions.filter(
                (region) => !hiddenRegionKeys.includes(region.value),
            ),
        [allRegions, hiddenRegionKeys],
    );

    const benchmarkHistory = useQuery(
        api.insights.metricHistoryQueries.getGvrMonthlyHistory,
        {
            regionKey: GVR_GRAND_TOTAL_REGION_KEY,
            metricKeys: ["gvr_mls_benchmark_price"],
            months: 12,
        },
    );

    const overlayRegionHistory = useQuery(
        api.insights.metricHistoryQueries.getGvrMonthlyHistoryByRegions,
        {
            regionKeys: allRegions.map((region) => region.value),
            metricKeys: ["gvr_mls_benchmark_price"],
            months: 12,
        },
    );

    if (benchmarkHistory === undefined || overlayRegionHistory === undefined) {
        return <ChartSkeleton />;
    }

    if (!benchmarkHistory || benchmarkHistory.length === 0) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="text-base">Home Price Table</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No home-price history available yet.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const selectedMetricKey = "gvr_mls_benchmark_price";
    const byDate = new Map<string, Record<string, number | string | undefined>>();

    for (const row of benchmarkHistory) {
        const date = String(row.date);
        const current = byDate.get(date) ?? { date };
        current.benchmark = coerceNumber(row[selectedMetricKey]);
        byDate.set(date, current);
    }

    const overlayRows = (overlayRegionHistory ?? []) as RegionalHistoryRows;
    for (const regionRows of overlayRows) {
        for (const row of regionRows.rows ?? []) {
            const date = String(row.date);
            const current = byDate.get(date) ?? { date };
            current[regionRows.regionKey] = coerceNumber(row[selectedMetricKey]);
            byDate.set(date, current);
        }
    }

    const data = Array.from(byDate.values()).sort((a, b) =>
        String(a.date).localeCompare(String(b.date)),
    );
    const latestDate = data[data.length - 1]?.date;
    const latestBenchmark = findLatestSeriesValue(data, "benchmark");

    const regionRows = visibleRegions.map((region) => {
        const value = findLatestSeriesValue(data, region.value);
        return {
            regionLabel: region.label,
            value,
            deltaToBenchmark:
                value !== undefined && latestBenchmark !== undefined
                    ? value - latestBenchmark
                    : undefined,
        };
    });

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Home Price Table</CardTitle>
                {typeof latestDate === "string" ? (
                    <p className="text-xs text-muted-foreground">
                        Latest month: {formatDateLabel(latestDate)}
                    </p>
                ) : null}
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-[12px]">
                        <thead>
                            <tr className="border-b text-muted-foreground">
                                <th className="px-2 py-1.5 text-left font-medium">
                                    Region
                                </th>
                                <th className="px-2 py-1.5 text-right font-medium">
                                    Benchmark
                                </th>
                                <th className="px-2 py-1.5 text-right font-medium">
                                    vs GVR
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b">
                                <td className="px-2 py-1.5 font-medium">
                                    GVR Benchmark
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums">
                                    {latestBenchmark !== undefined
                                        ? formatCurrencyFull(latestBenchmark)
                                        : "-"}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                    -
                                </td>
                            </tr>
                            {regionRows.map((row) => (
                                <tr key={row.regionLabel} className="border-b last:border-0">
                                    <td className="px-2 py-1.5 font-medium">
                                        {row.regionLabel}
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">
                                        {row.value !== undefined
                                            ? formatCurrencyFull(row.value)
                                            : "-"}
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                        {row.deltaToBenchmark !== undefined
                                            ? formatSignedCurrencyDelta(
                                                  row.deltaToBenchmark,
                                              )
                                            : "-"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

const PROPERTY_TYPE_SERIES = HOME_PRICE_SERIES.filter(
    (s) => s.metricKey !== "gvr_mls_benchmark_price",
);

const PROPERTY_TYPE_COLORS: Record<string, string> = {
    gvr_detached_benchmark_price: "var(--chart-3)",
    gvr_townhouse_benchmark_price: "var(--chart-4)",
    gvr_apartment_benchmark_price: "var(--chart-5)",
};

type HomePriceViewMode = "regions" | "property-types";

function GvrHomePriceComparisonChart({
    allRegions,
    hiddenRegionKeys,
    fillCompanionHeight = false,
}: {
    allRegions: RegionOption[];
    hiddenRegionKeys: string[];
    fillCompanionHeight?: boolean;
}) {
    const [viewMode, setViewMode] = useState<HomePriceViewMode>("property-types");

    const visibleRegions = useMemo(
        () =>
            allRegions.filter(
                (region) => !hiddenRegionKeys.includes(region.value),
            ),
        [allRegions, hiddenRegionKeys],
    );

    const benchmarkHistory = useQuery(
        api.insights.metricHistoryQueries.getGvrMonthlyHistory,
        {
            regionKey: GVR_GRAND_TOTAL_REGION_KEY,
            metricKeys: HOME_PRICE_KEYS,
            months: 12,
        },
    );

    const overlayRegionHistory = useQuery(
        api.insights.metricHistoryQueries.getGvrMonthlyHistoryByRegions,
        {
            regionKeys: allRegions.map((region) => region.value),
            metricKeys: HOME_PRICE_KEYS,
            months: 12,
        },
    );

    if (benchmarkHistory === undefined || overlayRegionHistory === undefined) {
        return <ChartSkeleton />;
    }

    if (!benchmarkHistory || benchmarkHistory.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Benchmark vs Region Home Prices
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No GVR home-price history yet. Run a GVR backfill to
                        populate the last 12 months.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const byDate = new Map<
        string,
        Record<string, number | string | undefined>
    >();

    for (const row of benchmarkHistory) {
        const date = String(row.date);
        const current = byDate.get(date) ?? { date };
        current.benchmark = coerceNumber(row["gvr_mls_benchmark_price"]);
        for (const series of PROPERTY_TYPE_SERIES) {
            const val = coerceNumber(row[series.metricKey]);
            if (val !== undefined) {
                current[series.metricKey] = val;
            }
        }
        byDate.set(date, current);
    }

    const overlayRows = (overlayRegionHistory ?? []) as RegionalHistoryRows;
    for (const regionRows of overlayRows) {
        for (const row of regionRows.rows ?? []) {
            const date = String(row.date);
            const current = byDate.get(date) ?? { date };
            current[regionRows.regionKey] = coerceNumber(row["gvr_mls_benchmark_price"]);
            byDate.set(date, current);
        }
    }

    const data = Array.from(byDate.values()).sort((a, b) =>
        String(a.date).localeCompare(String(b.date)),
    );

    const latestBenchmark = findLatestSeriesValue(data, "benchmark");

    const chartConfig: ChartConfig = {
        benchmark: {
            label: "Composite",
            color: "var(--chart-1)",
        },
    };

    for (const series of PROPERTY_TYPE_SERIES) {
        chartConfig[series.metricKey] = {
            label: series.label,
            color: PROPERTY_TYPE_COLORS[series.metricKey] ?? "var(--chart-2)",
        };
    }

    const regionLabelByKey = new Map<string, string>();
    allRegions.forEach((region, index) => {
        chartConfig[region.value] = {
            label: region.label,
            color: getOverlayRegionColor(index),
        };
        regionLabelByKey.set(region.value, region.label);
    });

    const labelByKey = new Map<string, string>([
        ["benchmark", "Composite"],
        ...PROPERTY_TYPE_SERIES.map(
            (s) => [s.metricKey, s.label] as [string, string],
        ),
        ...Array.from(regionLabelByKey),
    ]);

    const chartContainerClassName = fillCompanionHeight
        ? "h-full min-h-[320px] w-full aspect-auto"
        : "h-[220px] w-full";

    const showPropertyTypes = viewMode === "property-types";
    const showRegions = viewMode === "regions";

    return (
        <Card
            className={fillCompanionHeight ? "h-full flex flex-col" : undefined}
        >
            <CardHeader className="space-y-3 pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-base">
                            Home Prices (12 months)
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            {showPropertyTypes
                                ? "Benchmark comparison by property type."
                                : "Composite benchmark comparison across visible regions."}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={showPropertyTypes ? "default" : "outline"}
                            className="h-7 text-xs"
                            onClick={() => setViewMode("property-types")}
                        >
                            By Type
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={showRegions ? "default" : "outline"}
                            className="h-7 text-xs"
                            onClick={() => setViewMode("regions")}
                        >
                            By Region
                        </Button>
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-md border px-3 py-2">
                        <p className="text-xs text-muted-foreground">Composite</p>
                        <p className="text-sm font-semibold tabular-nums">
                            {latestBenchmark !== undefined
                                ? formatCurrencyFull(latestBenchmark)
                                : "-"}
                        </p>
                    </div>
                    {showPropertyTypes
                        ? PROPERTY_TYPE_SERIES.map((series) => {
                              const value = findLatestSeriesValue(
                                  data,
                                  series.metricKey,
                              );
                              return (
                                  <div
                                      key={series.metricKey}
                                      className="rounded-md border px-3 py-2"
                                  >
                                      <p className="text-xs text-muted-foreground">
                                          {series.label}
                                      </p>
                                      <p className="text-sm font-semibold tabular-nums">
                                          {value !== undefined
                                              ? formatCurrencyFull(value)
                                              : "-"}
                                      </p>
                                  </div>
                              );
                          })
                        : visibleRegions.map((region) => {
                              const latestRegionValue = findLatestSeriesValue(
                                  data,
                                  region.value,
                              );
                              return (
                                  <div
                                      key={region.value}
                                      className="rounded-md border px-3 py-2"
                                  >
                                      <p className="text-xs text-muted-foreground">
                                          {region.label}
                                      </p>
                                      <p className="text-sm font-semibold tabular-nums">
                                          {latestRegionValue !== undefined
                                              ? formatCurrencyFull(latestRegionValue)
                                              : "-"}
                                      </p>
                                  </div>
                              );
                          })}
                </div>
            </CardHeader>
            <CardContent
                className={fillCompanionHeight ? "flex flex-1 flex-col" : undefined}
            >
                <ChartContainer
                    config={chartConfig}
                    className={chartContainerClassName}
                >
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 12, left: 12, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatDateLabel}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={40}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={formatCurrencyCompact}
                            domain={["auto", "auto"]}
                        />
                        <ChartTooltip
                            content={
                                <ChartTooltipContent
                                    className="border-slate-700 bg-slate-900 text-slate-100 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900 [&_.text-muted-foreground]:text-slate-300 dark:[&_.text-muted-foreground]:text-slate-600 [&_.text-foreground]:text-slate-100 dark:[&_.text-foreground]:text-slate-900"
                                    labelFormatter={(value) =>
                                        typeof value === "string"
                                            ? formatDateLabel(value)
                                            : String(value)
                                    }
                                    formatter={(value, name, item) => {
                                        const key = String(name);
                                        const displayLabel =
                                            labelByKey.get(key) ??
                                            humanizeRegionKey(key);
                                        const numericValue =
                                            typeof value === "number"
                                                ? value
                                                : Number(value);
                                        const displayValue = Number.isFinite(
                                            numericValue,
                                        )
                                            ? formatCurrencyFull(numericValue)
                                            : String(value);
                                        const color =
                                            typeof item === "object" &&
                                            item !== null &&
                                            "color" in item &&
                                            typeof item.color === "string"
                                                ? item.color
                                                : "currentColor";

                                        return (
                                            <div className="flex w-full items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-[2px]"
                                                        style={{
                                                            backgroundColor: color,
                                                        }}
                                                    />
                                                    <span className="text-muted-foreground">
                                                        {displayLabel}
                                                    </span>
                                                </div>
                                                <span className="font-mono font-medium text-foreground tabular-nums">
                                                    {displayValue}
                                                </span>
                                            </div>
                                        );
                                    }}
                                />
                            }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line
                            type="monotone"
                            dataKey="benchmark"
                            name="benchmark"
                            stroke="var(--color-benchmark)"
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls
                        />
                        {showPropertyTypes
                            ? PROPERTY_TYPE_SERIES.map((series) => (
                                  <Line
                                      key={series.metricKey}
                                      type="monotone"
                                      dataKey={series.metricKey}
                                      name={series.metricKey}
                                      stroke={
                                          PROPERTY_TYPE_COLORS[
                                              series.metricKey
                                          ] ?? "var(--chart-2)"
                                      }
                                      strokeWidth={2}
                                      dot={false}
                                      connectNulls
                                  />
                              ))
                            : null}
                        {showRegions
                            ? allRegions.map((region, index) => (
                                  <Line
                                      key={region.value}
                                      type="monotone"
                                      dataKey={region.value}
                                      name={region.value}
                                      stroke={getOverlayRegionColor(index)}
                                      strokeWidth={2}
                                      strokeDasharray="6 4"
                                      dot={false}
                                      connectNulls
                                      hide={hiddenRegionKeys.includes(region.value)}
                                  />
                              ))
                            : null}
                    </LineChart>
                </ChartContainer>
                <p className="mt-2 text-xs text-muted-foreground">
                    {showPropertyTypes
                        ? "Showing composite, detached, townhouse, and apartment benchmarks."
                        : "Showing composite benchmark values by region."}
                </p>
            </CardContent>
        </Card>
    );
}

function GvrActivityComparisonChart({
    allRegions,
    hiddenRegionKeys,
    mode,
    tableState,
}: {
    allRegions: RegionOption[];
    hiddenRegionKeys: string[];
    mode: "listings" | "sales";
    tableState: GvrActivityTableState;
}) {
    const series = mode === "sales" ? SALES_SERIES : LISTINGS_SERIES;
    const metricKeys = series.map((entry) => entry.metricKey);
    const selectedMetricKey = mode === "sales" ? "gvr_mls_sales" : "gvr_new_listings";

    const visibleRegions = useMemo(
        () =>
            allRegions.filter(
                (region) => !hiddenRegionKeys.includes(region.value),
            ),
        [allRegions, hiddenRegionKeys],
    );

    const benchmarkHistory = useQuery(
        api.insights.metricHistoryQueries.getGvrMonthlyHistory,
        {
            regionKey: GVR_GRAND_TOTAL_REGION_KEY,
            metricKeys,
            months: 12,
        },
    );

    const overlayRegionHistory = useQuery(
        api.insights.metricHistoryQueries.getGvrMonthlyHistoryByRegions,
        {
            regionKeys: allRegions.map((region) => region.value),
            metricKeys,
            months: 12,
        },
    );

    if (benchmarkHistory === undefined || overlayRegionHistory === undefined) {
        return <ChartSkeleton />;
    }

    if (!benchmarkHistory || benchmarkHistory.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {mode === "sales"
                            ? "Benchmark vs Region Sales"
                            : "Benchmark vs Region Listings"}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No GVR activity history yet. Run a GVR backfill to
                        populate the last 12 months.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const isSales = mode === "sales";
    const byDate = new Map<
        string,
        Record<string, number | string | undefined>
    >();

    for (const row of benchmarkHistory) {
        const date = String(row.date);
        const current = byDate.get(date) ?? { date };
        current.benchmark = coerceNumber(row[selectedMetricKey]);
        byDate.set(date, current);
    }

    const overlayRows = (overlayRegionHistory ?? []) as RegionalHistoryRows;
    for (const regionRows of overlayRows) {
        for (const row of regionRows.rows ?? []) {
            const date = String(row.date);
            const current = byDate.get(date) ?? { date };
            current[regionRows.regionKey] = coerceNumber(row[selectedMetricKey]);
            byDate.set(date, current);
        }
    }

    const data = Array.from(byDate.values()).sort((a, b) =>
        String(a.date).localeCompare(String(b.date)),
    );
    const fillCompanionHeight = tableState === "ready";
    const chartContainerClassName =
        tableState === "empty"
            ? "h-[360px] w-full aspect-auto"
            : fillCompanionHeight
              ? "h-full min-h-[300px] w-full aspect-auto"
              : "h-[300px] w-full aspect-auto";

    const latestBenchmark = findLatestSeriesValue(data, "benchmark");

    const overlayConfig: ChartConfig = {
        benchmark: {
            label: "GVR Grand Total",
            color: "var(--chart-1)",
        },
    };

    const regionLabelByKey = new Map<string, string>();
    allRegions.forEach((region, index) => {
        overlayConfig[region.value] = {
            label: region.label,
            color: getOverlayRegionColor(index),
        };
        regionLabelByKey.set(region.value, region.label);
    });

    return (
        <Card className={fillCompanionHeight ? "h-full flex flex-col" : undefined}>
            <CardHeader className="space-y-3 pb-3">
                <div className="space-y-1">
                    <CardTitle className="text-base">
                        {isSales
                            ? "Benchmark vs Region Sales (12 months)"
                            : "Benchmark vs Region Listings (12 months)"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        All-property-type comparison against visible regions.
                    </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-md border px-3 py-2">
                        <p className="text-xs text-muted-foreground">GVR Grand Total</p>
                        <p className="text-sm font-semibold tabular-nums">
                            {latestBenchmark !== undefined
                                ? formatCountFull(latestBenchmark)
                                : "-"}
                        </p>
                    </div>
                    {visibleRegions.map((region) => {
                        const latestRegionValue = findLatestSeriesValue(
                            data,
                            region.value,
                        );
                        return (
                            <div
                                key={region.value}
                                className="rounded-md border px-3 py-2"
                            >
                                <p className="text-xs text-muted-foreground">
                                    {region.label}
                                </p>
                                <p className="text-sm font-semibold tabular-nums">
                                    {latestRegionValue !== undefined
                                        ? formatCountFull(latestRegionValue)
                                        : "-"}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </CardHeader>
            <CardContent className={fillCompanionHeight ? "flex flex-1 flex-col" : undefined}>
                <ChartContainer
                    config={overlayConfig}
                    className={chartContainerClassName}
                >
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 12, left: 12, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatDateLabel}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={40}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={formatCountFull}
                            domain={["auto", "auto"]}
                        />
                        <ChartTooltip
                            content={
                                <ChartTooltipContent
                                    className="border-slate-700 bg-slate-900 text-slate-100 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900 [&_.text-muted-foreground]:text-slate-300 dark:[&_.text-muted-foreground]:text-slate-600 [&_.text-foreground]:text-slate-100 dark:[&_.text-foreground]:text-slate-900"
                                    labelFormatter={(value) =>
                                        typeof value === "string"
                                            ? formatDateLabel(value)
                                            : String(value)
                                    }
                                    formatter={(value, name, item) => {
                                        const key = String(name);
                                        const displayLabel =
                                            key === "benchmark"
                                                ? "GVR Grand Total"
                                                : (regionLabelByKey.get(key) ??
                                                  humanizeRegionKey(key));
                                        const numericValue =
                                            typeof value === "number"
                                                ? value
                                                : Number(value);
                                        const displayValue = Number.isFinite(
                                            numericValue,
                                        )
                                            ? formatCountFull(numericValue)
                                            : String(value);
                                        const color =
                                            typeof item === "object" &&
                                            item !== null &&
                                            "color" in item &&
                                            typeof item.color === "string"
                                                ? item.color
                                                : "currentColor";

                                        return (
                                            <div className="flex w-full items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-[2px]"
                                                        style={{
                                                            backgroundColor: color,
                                                        }}
                                                    />
                                                    <span className="text-muted-foreground">
                                                        {displayLabel}
                                                    </span>
                                                </div>
                                                <span className="font-mono font-medium text-foreground tabular-nums">
                                                    {displayValue}
                                                </span>
                                            </div>
                                        );
                                    }}
                                />
                            }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line
                            type="monotone"
                            dataKey="benchmark"
                            name="benchmark"
                            stroke="var(--color-benchmark)"
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls
                        />
                        {allRegions.map((region, index) => (
                            <Line
                                key={region.value}
                                type="monotone"
                                dataKey={region.value}
                                name={region.value}
                                stroke={getOverlayRegionColor(index)}
                                strokeWidth={2}
                                strokeDasharray="6 4"
                                dot={false}
                                connectNulls
                                hide={hiddenRegionKeys.includes(region.value)}
                            />
                        ))}
                    </LineChart>
                </ChartContainer>
                <p className="mt-2 text-xs text-muted-foreground">
                    Showing all-property-type values.
                </p>
            </CardContent>
        </Card>
    );
}

export function MarketChartsTabs({
    regionKey,
    regionKeys,
    regionOptions,
    selectedInterests,
}: {
    regionKey?: string;
    regionKeys?: string[];
    regionOptions?: RegionOption[];
    selectedInterests?: InterestCategory[];
}) {
    const comparisonRegionKeys = useMemo(
        () =>
            regionKeys && regionKeys.length > 0
                ? regionKeys
                : regionKey
                  ? [regionKey]
                  : [],
        [regionKey, regionKeys],
    );

    const resolvedRegionOptions = useMemo(() => {
        const allowed = new Set(comparisonRegionKeys);

        const base =
            regionOptions && regionOptions.length > 0
                ? regionOptions.filter(
                      (option) =>
                          allowed.size === 0 || allowed.has(option.value),
                  )
                : comparisonRegionKeys.map((key) => ({
                      value: key,
                      label: humanizeRegionKey(key),
                  }));

        const deduped = Array.from(
            new Map(base.map((option) => [option.value, option])).values(),
        );

        if (deduped.length > 0) {
            return deduped;
        }

        const fallbackKey = regionKey ?? DEFAULT_GVR_REGION_KEY;
        return [{ value: fallbackKey, label: humanizeRegionKey(fallbackKey) }];
    }, [comparisonRegionKeys, regionKey, regionOptions]);

    const [hiddenRegionKeys, setHiddenRegionKeys] = useState<string[]>([]);
    const [selectedTab, setSelectedTab] = useState<string>("rates");
    const [listingsTableState, setListingsTableState] =
        useState<GvrActivityTableState>("loading");
    const [salesTableState, setSalesTableState] =
        useState<GvrActivityTableState>("loading");

    const activeInterestSet = useMemo(
        () => new Set(selectedInterests ?? []),
        [selectedInterests],
    );

    const availableTabs = useMemo(() => {
        const tabs = [
            {
                key: "rates",
                label: "Rate Trends",
                visible: activeInterestSet.has("mortgage_rates"),
            },
            {
                key: "home-prices",
                label: "Home Prices",
                visible: activeInterestSet.has("home_prices"),
            },
            {
                key: "listings",
                label: "Listings",
                visible: activeInterestSet.has("inventory"),
            },
            {
                key: "sales",
                label: "Sales",
                visible: activeInterestSet.has("inventory"),
            },
        ];

        return tabs.filter((tab) => tab.visible);
    }, [activeInterestSet]);

    const toggleRegionVisibility = (regionKeyToToggle: string) => {
        setHiddenRegionKeys((current) =>
            current.includes(regionKeyToToggle)
                ? current.filter((key) => key !== regionKeyToToggle)
                : [...current, regionKeyToToggle],
        );
    };

    const allowedTabKeys = new Set(availableTabs.map((tab) => tab.key));
    const activeTab = allowedTabKeys.has(selectedTab)
        ? selectedTab
        : availableTabs[0]?.key ?? "rates";

    if (availableTabs.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-8 text-sm text-muted-foreground">
                    No chart tabs are available for the currently selected
                    interests.
                </CardContent>
            </Card>
        );
    }

    return (
        <Tabs
            value={activeTab}
            onValueChange={setSelectedTab}
            className="space-y-3"
        >
            <Card>
                <CardHeader className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base">
                                Market Graphs
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Compare rate, price, listings, and sales data across
                                your selected regions.
                            </p>
                        </div>
                        <TabsList className="h-9">
                            {availableTabs.map((tab) => (
                                <TabsTrigger key={tab.key} value={tab.key}>
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    <RegionVisibilityToggles
                        regionOptions={resolvedRegionOptions}
                        hiddenRegionKeys={hiddenRegionKeys}
                        onToggle={toggleRegionVisibility}
                    />
                </CardHeader>
                <CardContent className="pt-1">
                    <TabsContent value="rates" className="mt-4">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-stretch">
                            <RateTrendChart fillHeight />
                            <RateTrendSummaryTable className="h-full" />
                        </div>
                    </TabsContent>
                    <TabsContent value="home-prices" className="mt-4">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-stretch">
                            <GvrHomePriceComparisonChart
                                allRegions={resolvedRegionOptions}
                                hiddenRegionKeys={hiddenRegionKeys}
                                fillCompanionHeight
                            />
                            <HomePriceComparisonTable
                                allRegions={resolvedRegionOptions}
                                hiddenRegionKeys={hiddenRegionKeys}
                                className="h-full"
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="listings" className="mt-4">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-stretch">
                            <GvrActivityComparisonChart
                                allRegions={resolvedRegionOptions}
                                hiddenRegionKeys={hiddenRegionKeys}
                                mode="listings"
                                tableState={listingsTableState}
                            />
                            <GvrActivityComparisonTable
                                regionKeys={comparisonRegionKeys}
                                mode="listings"
                                className="h-full"
                                onDataStateChange={setListingsTableState}
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="sales" className="mt-4">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-stretch">
                            <GvrActivityComparisonChart
                                allRegions={resolvedRegionOptions}
                                hiddenRegionKeys={hiddenRegionKeys}
                                mode="sales"
                                tableState={salesTableState}
                            />
                            <GvrActivityComparisonTable
                                regionKeys={comparisonRegionKeys}
                                mode="sales"
                                className="h-full"
                                onDataStateChange={setSalesTableState}
                            />
                        </div>
                    </TabsContent>
                </CardContent>
            </Card>
        </Tabs>
    );
}
