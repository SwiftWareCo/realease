"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const METRIC_KEYS = [
    "boc_policy_rate",
    "prime_rate",
    "5yr_fixed_mortgage",
    "3yr_fixed_mortgage",
];

const chartConfig = {
    boc_policy_rate: {
        label: "BoC Policy Rate",
        color: "var(--chart-1)",
    },
    prime_rate: {
        label: "Prime Rate",
        color: "var(--chart-4)",
    },
    "5yr_fixed_mortgage": {
        label: "5-Year Fixed",
        color: "var(--chart-2)",
    },
    "3yr_fixed_mortgage": {
        label: "3-Year Fixed",
        color: "var(--chart-3)",
    },
} satisfies ChartConfig;

function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-CA", { month: "short", year: "2-digit" });
}

export function RateTrendChart({
    fillHeight = false,
}: {
    fillHeight?: boolean;
} = {}) {
    const data = useQuery(api.insights.metricHistoryQueries.getRateHistory, {
        metricKeys: METRIC_KEYS,
    });

    // Loading
    if (data === undefined) {
        return <RateTrendChartSkeleton />;
    }

    // No data yet (auth failed or no history)
    if (!data || data.length === 0) {
        return null;
    }

    const chartClassName = fillHeight
        ? "h-full min-h-[320px] w-full aspect-auto"
        : "h-[210px] w-full";

    return (
        <Card className={fillHeight ? "h-full flex flex-col" : undefined}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">
                    Rate Trends (12 months)
                </CardTitle>
            </CardHeader>
            <CardContent className={fillHeight ? "flex flex-1 flex-col" : undefined}>
                <ChartContainer config={chartConfig} className={chartClassName}>
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
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
                            tickFormatter={(v: number) => `${v}%`}
                            domain={["auto", "auto"]}
                        />
                        <ChartTooltip
                            shared={false}
                            content={
                                <ChartTooltipContent
                                    className="border-slate-700 bg-slate-900 text-slate-100 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900 [&_.text-muted-foreground]:text-slate-300 dark:[&_.text-muted-foreground]:text-slate-600 [&_.text-foreground]:text-slate-100 dark:[&_.text-foreground]:text-slate-900"
                                    labelFormatter={(value) =>
                                        typeof value === "string"
                                            ? formatDateLabel(value)
                                            : String(value)
                                    }
                                    formatter={(value, name, item) => {
                                        const configKey = String(
                                            name,
                                        ) as keyof typeof chartConfig;
                                        const displayLabel =
                                            chartConfig[configKey]?.label ??
                                            String(name);
                                        const displayValue =
                                            typeof value === "number"
                                                ? `${value.toFixed(2)}%`
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
                                                            backgroundColor:
                                                                color,
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
                            dataKey="boc_policy_rate"
                            stroke="var(--color-boc_policy_rate)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="prime_rate"
                            stroke="var(--color-prime_rate)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="5yr_fixed_mortgage"
                            stroke="var(--color-5yr_fixed_mortgage)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="3yr_fixed_mortgage"
                            stroke="var(--color-3yr_fixed_mortgage)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                        />
                    </LineChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

function RateTrendChartSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-[210px] w-full rounded-md" />
            </CardContent>
        </Card>
    );
}
