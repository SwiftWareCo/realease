"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    TrendingUp,
    TrendingDown,
    Minus,
    BarChart3,
    ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

interface MetricCardProps {
    title: string;
    value: string;
    change?: string;
    trend: "up" | "down" | "neutral";
    icon: React.ReactNode;
}

function MetricCard({ title, value, change, trend, icon }: MetricCardProps) {
    return (
        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    {icon}
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">{title}</p>
                    <p
                        className="text-base font-bold"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                        {value}
                    </p>
                </div>
            </div>
            {change && (
                <div
                    className={`flex items-center gap-1 text-xs font-medium ${
                        trend === "up"
                            ? "text-green-600 dark:text-green-400"
                            : trend === "down"
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                    }`}
                >
                    {trend === "up" && (
                        <TrendingUp className="size-3" aria-hidden="true" />
                    )}
                    {trend === "down" && (
                        <TrendingDown className="size-3" aria-hidden="true" />
                    )}
                    {trend === "neutral" && (
                        <Minus className="size-3" aria-hidden="true" />
                    )}
                    <span>{change}</span>
                </div>
            )}
        </div>
    );
}

export function AnalyticsCard() {
    const kpiMetrics = useQuery(api.insights.metricsQueries.getKPIMetrics, {});

    const isLoading = kpiMetrics === undefined;
    const hasData = kpiMetrics && kpiMetrics.length > 0;
    const visibleMetrics = hasData ? kpiMetrics.slice(0, 3) : [];

    return (
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/20 h-full flex flex-col">
            <div
                className="absolute inset-0 rounded-xl opacity-30"
                style={{
                    background:
                        "linear-gradient(90deg, transparent, var(--primary), transparent)",
                    backgroundSize: "200% 100%",
                }}
                aria-hidden="true"
            />

            <CardHeader className="pb-1.5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <BarChart3
                            className="size-5 text-primary"
                            aria-hidden="true"
                        />
                        Market Analytics
                    </CardTitle>
                    <Link
                        href="/insights"
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                    >
                        View Report
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                    </Link>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    {hasData ? "Live market data" : "Real-time market overview"}
                </p>
            </CardHeader>

            <CardContent className="space-y-1.5">
                {isLoading ? (
                    <>
                        <Skeleton className="h-14 w-full rounded-lg" />
                        <Skeleton className="h-14 w-full rounded-lg" />
                        <Skeleton className="h-14 w-full rounded-lg" />
                    </>
                ) : hasData ? (
                    visibleMetrics.map((metric) => (
                        <MetricCard
                            key={metric._id}
                            title={metric.label}
                            value={metric.formattedValue}
                            change={metric.changeFormatted}
                            trend={metric.trend}
                            icon={
                                <BarChart3
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            }
                        />
                    ))
                ) : (
                    <div className="p-4 rounded-lg bg-muted/20 border border-dashed border-muted-foreground/20">
                        <div className="flex items-center justify-center h-20">
                            <p className="text-xs text-muted-foreground text-center">
                                No market data yet. Configure your region in
                                Settings.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
