"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightsEmptyState } from "./components/InsightsEmptyState";
import { KPIStrip, KPIStripSkeleton } from "./components/KPIStrip";
import {
    MarketSnapshot,
    MarketSnapshotSkeleton,
} from "./components/MarketSnapshot";
import { MarketChartsTabs } from "./components/MarketChartsTabs";
import { Settings, MapPin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { MultiSelect } from "@/components/multi-select";
import { Badge } from "@/components/ui/badge";
import { InsightsSettingsDialog } from "./components/InsightsSettingsDialog";

const GVR_PRIMARY_REGION_KEY = "greater-vancouver-bc-ca";

function buildRegionKey(region: {
    city: string;
    state?: string;
    country: string;
}) {
    return `${region.city.toLowerCase().replace(/\s+/g, "-")}-${region.state?.toLowerCase() || ""}-${region.country.toLowerCase()}`;
}

export default function InsightsPage() {
    const [selectedRegionKeys, setSelectedRegionKeys] = useState<
        string[] | null
    >(null);
    const [currentTimeMs, setCurrentTimeMs] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const preferences = useQuery(api.insights.queries.getUserPreferences);
    const regions = (preferences?.regions ?? []).map((region) => ({
        ...region,
        key: buildRegionKey(region),
    }));

    const effectiveRegionKeys =
        selectedRegionKeys && selectedRegionKeys.length > 0
            ? selectedRegionKeys
            : regions.map((region) => region.key);

    const chartPrimaryRegionKey =
        effectiveRegionKeys[0] ?? GVR_PRIMARY_REGION_KEY;

    const kpiMetrics = useQuery(api.insights.metricsQueries.getKPIMetrics, {
        regionKeys: effectiveRegionKeys,
    });

    const marketSummary = useQuery(
        api.insights.metricsQueries.getMarketSummary,
        {
            regionKeys: effectiveRegionKeys,
        },
    );

    const metricLastUpdated =
        kpiMetrics && kpiMetrics.length > 0
            ? Math.max(...kpiMetrics.map((m) => m.fetchedAt))
            : undefined;
    const lastUpdatedForStaleCheck =
        metricLastUpdated ?? marketSummary?.generatedAt;

    useEffect(() => {
        const updateTime = () => setCurrentTimeMs(Date.now());
        const initialTimeout = window.setTimeout(updateTime, 0);
        const interval = window.setInterval(updateTime, 60_000);
        return () => {
            window.clearTimeout(initialTimeout);
            window.clearInterval(interval);
        };
    }, [lastUpdatedForStaleCheck]);

    // Check for stale data (> 24 hours)
    const isStale =
        lastUpdatedForStaleCheck !== null &&
        lastUpdatedForStaleCheck !== undefined &&
        currentTimeMs > 0 &&
        currentTimeMs - lastUpdatedForStaleCheck > 24 * 60 * 60 * 1000;

    // Loading state
    if (preferences === undefined) {
        return <InsightsLoading />;
    }

    // No region configured
    if (!preferences || regions.length === 0) {
        return (
            <>
                <div className="p-6 md:p-8 max-w-7xl mx-auto">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold tracking-tight">
                            Market Insights
                        </h1>
                        <p className="text-muted-foreground">
                            Real estate data and trends for your market
                        </p>
                    </div>
                    <InsightsEmptyState
                        hasRegion={false}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                </div>
                <InsightsSettingsDialog
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                />
            </>
        );
    }

    const regionOptions = regions.map((region) => ({
        label: `${region.city}${region.state ? `, ${region.state}` : ""}`,
        value: region.key,
    }));
    const comparisonRegionOptions = regionOptions.filter((option) =>
        effectiveRegionKeys.includes(option.value),
    );
    const hasMultipleRegions = regions.length > 1;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold tracking-tight">
                            Market Insights
                        </h1>
                        {hasMultipleRegions ? (
                            <Badge
                                variant="outline"
                                className="flex items-center gap-1"
                            >
                                <MapPin className="h-3 w-3" />
                                {regions.length} regions
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="flex items-center gap-1"
                            >
                                <MapPin className="h-3 w-3" />
                                {regions[0].city}
                                {regions[0].state
                                    ? `, ${regions[0].state}`
                                    : ""}
                                <span className="ml-1 text-muted-foreground">
                                    ({regions[0].country})
                                </span>
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Real estate data and trends for your market
                        {lastUpdatedForStaleCheck && (
                            <span className="ml-1">
                                {" "}
                                Updated{" "}
                                {formatDistanceToNow(lastUpdatedForStaleCheck, {
                                    addSuffix: true,
                                })}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {hasMultipleRegions && (
                        <MultiSelect
                            options={regionOptions}
                            defaultValue={effectiveRegionKeys}
                            onValueChange={setSelectedRegionKeys}
                            placeholder="Filter regions"
                            maxCount={2}
                            className="w-full sm:w-[260px]"
                        />
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Preferences
                    </Button>
                </div>
            </div>

            {/* Stale data warning */}
            {isStale && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-4 py-2.5">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                        Market data may be outdated. Last updated{" "}
                        {lastUpdatedForStaleCheck
                            ? formatDistanceToNow(lastUpdatedForStaleCheck, {
                                  addSuffix: true,
                              })
                            : "unknown"}
                        .
                    </span>
                </div>
            )}

            {!marketSummary && (!kpiMetrics || kpiMetrics.length === 0) ? (
                <InsightsEmptyState hasRegion={true} regions={regions} />
            ) : (
                <>
                    {/* KPI Strip */}
                    {kpiMetrics === undefined ? (
                        <KPIStripSkeleton />
                    ) : kpiMetrics && kpiMetrics.length > 0 ? (
                        <KPIStrip metrics={kpiMetrics} />
                    ) : null}

                    {/* Market Snapshot */}
                    {marketSummary === undefined ? (
                        <MarketSnapshotSkeleton />
                    ) : marketSummary ? (
                        <MarketSnapshot
                            summary={marketSummary}
                            metrics={kpiMetrics ?? undefined}
                        />
                    ) : null}

                    {/* Charts */}
                    <MarketChartsTabs
                        regionKey={chartPrimaryRegionKey}
                        regionKeys={effectiveRegionKeys}
                        regionOptions={comparisonRegionOptions}
                    />
                </>
            )}
            <InsightsSettingsDialog
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
            />
        </div>
    );
}

function InsightsLoading() {
    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header skeleton */}
            <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
            </div>

            {/* KPI skeleton */}
            <KPIStripSkeleton />

            {/* Market snapshot skeleton */}
            <MarketSnapshotSkeleton />

            {/* Chart skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full rounded-md" />
                </CardContent>
            </Card>
        </div>
    );
}
