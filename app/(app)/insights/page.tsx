"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InsightsEmptyState } from "./components/InsightsEmptyState";
import { KPIStrip, KPIStripSkeleton } from "./components/KPIStrip";
import {
    MarketSnapshot,
    MarketSnapshotSkeleton,
} from "./components/MarketSnapshot";
import { MarketChartsTabs } from "./components/MarketChartsTabs";
import {
    Settings,
    MapPin,
    CheckCircle2,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { MultiSelect } from "@/components/multi-select";
import { Badge } from "@/components/ui/badge";
import { InsightsSettingsDialog } from "./components/InsightsSettingsDialog";
import { toast } from "sonner";
import { InsightsPageSkeleton } from "./components/InsightsPageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

const GVR_PRIMARY_REGION_KEY = "greater-vancouver-bc-ca";
const INTEREST_TO_LABEL: Record<string, string> = {
    home_prices: "Home Prices",
    inventory: "Inventory",
    mortgage_rates: "Mortgage Rates",
    market_trend: "Market Trends",
};

function buildRegionKey(region: {
    city: string;
    state?: string;
    country: string;
}) {
    return `${region.city.toLowerCase().replace(/\s+/g, "-")}-${region.state?.toLowerCase() || ""}-${region.country.toLowerCase()}`;
}

function sameKeySet(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const left = [...a].sort();
    const right = [...b].sort();
    return left.every((value, index) => value === right[index]);
}

export default function InsightsPage() {
    const [pendingRegionKeys, setPendingRegionKeys] = useState<string[] | null>(
        null,
    );
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSavingRegions, setIsSavingRegions] = useState(false);
    const [regionSaveError, setRegionSaveError] = useState<string | null>(null);
    const latestSaveIdRef = useRef(0);

    const preferences = useQuery(api.insights.queries.getUserPreferences);
    const supportedRegions = useQuery(api.insights.queries.getSupportedRegions);
    const updateRegion = useMutation(api.users.mutations.updateRegion);

    const supportedRegionMap = useMemo(
        () =>
            new Map((supportedRegions ?? []).map((region) => [region.key, region])),
        [supportedRegions],
    );

    const savedRegionKeys = useMemo(
        () =>
            (preferences?.regions ?? [])
                .map((region) => buildRegionKey(region))
                .filter((key) => supportedRegionMap.has(key)),
        [preferences?.regions, supportedRegionMap],
    );

    const selectedRegionKeys = pendingRegionKeys ?? savedRegionKeys;

    useEffect(() => {
        if (!supportedRegions || pendingRegionKeys === null) {
            return;
        }
        if (sameKeySet(pendingRegionKeys, savedRegionKeys)) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            const nextSaveId = latestSaveIdRef.current + 1;
            latestSaveIdRef.current = nextSaveId;

            const regionsToSave = pendingRegionKeys
                .map((key) => supportedRegionMap.get(key))
                .filter(
                    (region): region is NonNullable<typeof supportedRegions>[number] =>
                        region !== undefined,
                )
                .map((region) => ({
                    city: region.city,
                    state: region.state,
                    country: region.country,
                }));

            setIsSavingRegions(true);
            setRegionSaveError(null);

            void updateRegion({ regions: regionsToSave })
                .then(() => {
                    if (latestSaveIdRef.current === nextSaveId) {
                        setRegionSaveError(null);
                    }
                })
                .catch(() => {
                    setRegionSaveError(
                        "Could not save regions. Please try selecting regions again.",
                    );
                    setPendingRegionKeys(null);
                    toast.error("Failed to save selected regions");
                })
                .finally(() => {
                    if (latestSaveIdRef.current === nextSaveId) {
                        setIsSavingRegions(false);
                    }
                });
        }, 300);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [
        pendingRegionKeys,
        savedRegionKeys,
        supportedRegionMap,
        supportedRegions,
        updateRegion,
    ]);

    const selectedInterests = useMemo(
        () => preferences?.interests ?? [],
        [preferences?.interests],
    );
    const selectedInterestSet = useMemo(
        () => new Set(selectedInterests),
        [selectedInterests],
    );
    const hasInterestSelection = selectedInterests.length > 0;

    const effectiveRegionKeys = selectedRegionKeys;

    const chartPrimaryRegionKey =
        effectiveRegionKeys[0] ?? GVR_PRIMARY_REGION_KEY;

    const kpiMetrics = useQuery(api.insights.metricsQueries.getKPIMetrics, {
        interestCategories: selectedInterests,
    });

    const marketSummary = useQuery(api.insights.metricsQueries.getMarketSummary);

    const selectedRegions = useMemo(
        () =>
            effectiveRegionKeys
                .map((key) => supportedRegionMap.get(key))
                .filter(
                    (region): region is NonNullable<typeof supportedRegions>[number] =>
                        region !== undefined,
                ),
        [effectiveRegionKeys, supportedRegionMap],
    );

    const hasSelectedRegions = selectedRegionKeys.length > 0;
    const showKpiStrip = hasInterestSelection;
    const showMarketSnapshot = selectedInterestSet.has("market_trend");
    const showCharts =
        selectedInterestSet.has("mortgage_rates") ||
        selectedInterestSet.has("home_prices") ||
        selectedInterestSet.has("inventory");
    const isInsightsDataLoading =
        kpiMetrics === undefined || marketSummary === undefined;

    const metricLastUpdated =
        kpiMetrics && kpiMetrics.length > 0
            ? Math.max(...kpiMetrics.map((m) => m.fetchedAt))
            : undefined;
    const lastUpdatedForStaleCheck =
        metricLastUpdated ?? marketSummary?.generatedAt;

    // Loading state
    if (preferences === undefined || supportedRegions === undefined) {
        return <InsightsPageSkeleton />;
    }

    const regionOptions = [...supportedRegions]
        .map((region) => ({
            label: `${region.city}${region.state ? `, ${region.state}` : ""}`,
            value: region.key,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "en-CA"));
    const comparisonRegionOptions = regionOptions.filter((option) =>
        effectiveRegionKeys.includes(option.value),
    );
    const selectedRegionLabel = selectedRegions[0]
        ? `${selectedRegions[0].city}${
              selectedRegions[0].state ? `, ${selectedRegions[0].state}` : ""
          }`
        : null;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold tracking-tight">
                            Market Insights
                        </h1>
                        {selectedRegionKeys.length > 1 ? (
                            <Badge
                                variant="outline"
                                className="flex items-center gap-1"
                            >
                                <MapPin className="h-3 w-3" />
                                {selectedRegionKeys.length} regions
                            </Badge>
                        ) : selectedRegionLabel ? (
                            <Badge
                                variant="outline"
                                className="flex items-center gap-1"
                            >
                                <MapPin className="h-3 w-3" />
                                {selectedRegionLabel}
                            </Badge>
                        ) : (
                            <Badge
                                variant="secondary"
                                className="flex items-center gap-1 text-muted-foreground"
                            >
                                <MapPin className="h-3 w-3" />
                                No regions selected
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
                    <MultiSelect
                        options={regionOptions}
                        defaultValue={selectedRegionKeys}
                        onValueChange={(nextKeys) => {
                            setRegionSaveError(null);
                            setPendingRegionKeys(nextKeys);
                        }}
                        placeholder="Select market regions"
                        maxCount={3}
                        className="w-full sm:w-[320px]"
                    />
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

            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Interests:</span>
                {selectedInterests.length > 0 ? (
                    selectedInterests.map((interest) => (
                        <Badge
                            key={interest}
                            variant="secondary"
                            className="font-normal"
                        >
                            {INTEREST_TO_LABEL[interest] ?? interest}
                        </Badge>
                    ))
                ) : (
                    <Badge variant="outline" className="font-normal">
                        No topics selected
                    </Badge>
                )}

                {isSavingRegions ? (
                    <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving regions...
                    </span>
                ) : (
                    !regionSaveError &&
                    sameKeySet(selectedRegionKeys, savedRegionKeys) && (
                        <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                            Regions saved
                        </span>
                    )
                )}
            </div>

            {regionSaveError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {regionSaveError}
                </div>
            ) : null}

            {!hasSelectedRegions ? (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center space-y-2">
                        <p className="text-sm font-medium">
                            Pick one or more regions to load market insights.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Region selections save automatically and drive your
                            sentiment snapshot and comparison charts.
                        </p>
                    </CardContent>
                </Card>
            ) : !hasInterestSelection ? (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center space-y-3">
                        <p className="text-sm font-medium">
                            No topics selected.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Choose at least one topic in Market Preferences to
                            show modules on this page.
                        </p>
                        <div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsSettingsOpen(true)}
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                Open Preferences
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : isInsightsDataLoading ? (
                <>
                    {showKpiStrip ? <KPIStripSkeleton /> : null}
                    {showMarketSnapshot ? <MarketSnapshotSkeleton /> : null}
                    {showCharts ? (
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-5 w-56" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-[320px] w-full rounded-md" />
                            </CardContent>
                        </Card>
                    ) : null}
                </>
            ) : !showMarketSnapshot &&
              !marketSummary &&
              (!kpiMetrics || kpiMetrics.length === 0) ? (
                <InsightsEmptyState hasRegion={true} regions={selectedRegions} />
            ) : (
                <>
                    {/* KPI Strip */}
                    {showKpiStrip && kpiMetrics && kpiMetrics.length > 0 ? (
                        <KPIStrip metrics={kpiMetrics} />
                    ) : null}

                    {/* Market Snapshot */}
                    {showMarketSnapshot ? (
                        marketSummary ? (
                            <MarketSnapshot
                                summary={marketSummary}
                                metrics={kpiMetrics ?? undefined}
                            />
                        ) : (
                            <Card className="border-dashed">
                                <CardContent className="py-8 text-sm text-muted-foreground">
                                    Market summary not available.
                                </CardContent>
                            </Card>
                        )
                    ) : null}

                    {/* Charts */}
                    {showCharts ? (
                        <MarketChartsTabs
                            regionKey={chartPrimaryRegionKey}
                            regionKeys={effectiveRegionKeys}
                            regionOptions={comparisonRegionOptions}
                            selectedInterests={selectedInterests}
                        />
                    ) : (
                        <Card className="border-dashed">
                            <CardContent className="py-8 text-sm text-muted-foreground">
                                No chart modules are currently mapped to your
                                selected interests. Enable Home Prices,
                                Inventory, or Mortgage Rates in Preferences.
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
            <InsightsSettingsDialog
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
            />
        </div>
    );
}
