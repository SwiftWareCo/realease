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
import { GvrActivityComparisonTable } from "./GvrActivityComparisonTable";

const GVR_GRAND_TOTAL_REGION_KEY = "gvr-grand-total-ca";
const DEFAULT_GVR_REGION_KEY = "greater-vancouver-bc-ca";

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

function ChartSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-64" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-[320px] w-full rounded-md" />
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
        <div className="space-y-2 rounded-md border p-3">
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
                            className="h-8"
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

function GvrHomePriceComparisonChart({
    allRegions,
    hiddenRegionKeys,
}: {
    allRegions: RegionOption[];
    hiddenRegionKeys: string[];
}) {
    const [selectedMetricKey, setSelectedMetricKey] = useState<
        (typeof HOME_PRICE_SERIES)[number]["metricKey"]
    >("gvr_apartment_benchmark_price");

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

    const selectedSeriesLabel =
        HOME_PRICE_SERIES.find((s) => s.metricKey === selectedMetricKey)?.label ??
        "Price";

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

    const latestBenchmark = findLatestSeriesValue(data, "benchmark");

    const overlayConfig: ChartConfig = {
        benchmark: {
            label: "GVR Benchmark",
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
        <Card>
            <CardHeader className="space-y-4">
                <div className="space-y-1">
                    <CardTitle className="text-base">
                        Benchmark vs Region Home Prices (12 months)
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Compare GVR benchmark values against visible regions.
                    </p>
                </div>

                <Tabs
                    value={selectedMetricKey}
                    onValueChange={(value) =>
                        setSelectedMetricKey(
                            value as (typeof HOME_PRICE_SERIES)[number]["metricKey"],
                        )
                    }
                    className="space-y-3"
                >
                    <TabsList>
                        {HOME_PRICE_SERIES.map((series) => (
                            <TabsTrigger key={series.metricKey} value={series.metricKey}>
                                {series.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-md border px-3 py-2">
                        <p className="text-xs text-muted-foreground">GVR Benchmark</p>
                        <p className="text-sm font-semibold tabular-nums">
                            {latestBenchmark !== undefined
                                ? formatCurrencyFull(latestBenchmark)
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
                                        ? formatCurrencyFull(latestRegionValue)
                                        : "-"}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={overlayConfig} className="h-[320px] w-full">
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
                                    labelFormatter={(value) =>
                                        typeof value === "string"
                                            ? formatDateLabel(value)
                                            : String(value)
                                    }
                                    formatter={(value, name, item) => {
                                        const key = String(name);
                                        const displayLabel =
                                            key === "benchmark"
                                                ? "GVR Benchmark"
                                                : (regionLabelByKey.get(key) ??
                                                  humanizeRegionKey(key));
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
                    Showing {selectedSeriesLabel} benchmark values.
                </p>
            </CardContent>
        </Card>
    );
}

function GvrActivityComparisonChart({
    allRegions,
    hiddenRegionKeys,
    mode,
}: {
    allRegions: RegionOption[];
    hiddenRegionKeys: string[];
    mode: "listings" | "sales";
}) {
    const series = mode === "sales" ? SALES_SERIES : LISTINGS_SERIES;
    const metricKeys = series.map((entry) => entry.metricKey);
    const [selectedMetricKey, setSelectedMetricKey] = useState<string>(
        mode === "sales" ? "gvr_mls_sales" : "gvr_new_listings",
    );

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
    const selectedSeriesLabel =
        series.find((entry) => entry.metricKey === selectedMetricKey)?.label ??
        "All Property Types";

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
        <Card>
            <CardHeader className="space-y-4">
                <div className="space-y-1">
                    <CardTitle className="text-base">
                        {isSales
                            ? "Benchmark vs Region Sales (12 months)"
                            : "Benchmark vs Region Listings (12 months)"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Compare GVR grand-total activity against visible regions.
                    </p>
                </div>

                <Tabs
                    value={selectedMetricKey}
                    onValueChange={(value) => setSelectedMetricKey(value)}
                    className="space-y-3"
                >
                    <TabsList>
                        {series.map((entry) => (
                            <TabsTrigger key={entry.metricKey} value={entry.metricKey}>
                                {entry.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <CardContent>
                <ChartContainer config={overlayConfig} className="h-[320px] w-full">
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
                    Showing {selectedSeriesLabel} values.
                </p>
            </CardContent>
        </Card>
    );
}

export function MarketChartsTabs({
    regionKey,
    regionKeys,
    regionOptions,
}: {
    regionKey?: string;
    regionKeys?: string[];
    regionOptions?: RegionOption[];
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

    const toggleRegionVisibility = (regionKeyToToggle: string) => {
        setHiddenRegionKeys((current) =>
            current.includes(regionKeyToToggle)
                ? current.filter((key) => key !== regionKeyToToggle)
                : [...current, regionKeyToToggle],
        );
    };

    return (
        <Tabs defaultValue="rates" className="space-y-4">
            <div className="space-y-3">
                <TabsList>
                    <TabsTrigger value="rates">Rate Trends</TabsTrigger>
                    <TabsTrigger value="home-prices">Home Prices</TabsTrigger>
                    <TabsTrigger value="listings">Listings</TabsTrigger>
                    <TabsTrigger value="sales">Sales</TabsTrigger>
                </TabsList>
                <RegionVisibilityToggles
                    regionOptions={resolvedRegionOptions}
                    hiddenRegionKeys={hiddenRegionKeys}
                    onToggle={toggleRegionVisibility}
                />
            </div>

            <TabsContent value="rates" className="mt-0">
                <RateTrendChart />
            </TabsContent>
            <TabsContent value="home-prices" className="mt-0">
                <GvrHomePriceComparisonChart
                    allRegions={resolvedRegionOptions}
                    hiddenRegionKeys={hiddenRegionKeys}
                />
            </TabsContent>
            <TabsContent value="listings" className="mt-0">
                <div className="space-y-4">
                    <GvrActivityComparisonChart
                        allRegions={resolvedRegionOptions}
                        hiddenRegionKeys={hiddenRegionKeys}
                        mode="listings"
                    />
                    <GvrActivityComparisonTable
                        regionKeys={comparisonRegionKeys}
                        mode="listings"
                    />
                </div>
            </TabsContent>
            <TabsContent value="sales" className="mt-0">
                <div className="space-y-4">
                    <GvrActivityComparisonChart
                        allRegions={resolvedRegionOptions}
                        hiddenRegionKeys={hiddenRegionKeys}
                        mode="sales"
                    />
                    <GvrActivityComparisonTable
                        regionKeys={comparisonRegionKeys}
                        mode="sales"
                    />
                </div>
            </TabsContent>
        </Tabs>
    );
}
