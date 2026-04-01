"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Building2, MapPin, RefreshCw } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { MultiSelect } from "@/components/multi-select";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const INTEREST_OPTIONS = [
    {
        id: "home_prices",
        label: "Home Prices",
        description: "Median prices, price trends, affordability",
    },
    {
        id: "inventory",
        label: "Inventory Levels",
        description: "Available homes, days on market, supply",
    },
    {
        id: "mortgage_rates",
        label: "Mortgage Rates",
        description: "Current rates, forecasts, lending news",
    },
    {
        id: "market_trend",
        label: "Market Trends",
        description: "Overall market analysis and predictions",
    },
] as const;

type InterestOptionId = (typeof INTEREST_OPTIONS)[number]["id"];
type Region = { city: string; state?: string; country: string };

interface InsightsSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function normalizeRegionKey(region: Region) {
    return `${region.city.toLowerCase().replace(/\s+/g, "-")}-${region.state?.toLowerCase() || ""}-${region.country.toLowerCase()}`;
}

function formatRegionLabel(region: Region) {
    return `${region.city}${region.state ? `, ${region.state}` : ""}`;
}

export function InsightsSettingsDialog({
    open,
    onOpenChange,
}: InsightsSettingsDialogProps) {
    const preferences = useQuery(api.insights.queries.getUserPreferences);
    const supportedRegions = useQuery(api.insights.queries.getSupportedRegions);
    const updateRegion = useMutation(api.users.mutations.updateRegion);
    const updateInterests = useMutation(api.users.mutations.updateInterests);
    const manualFetchBatch = useAction(api.insights.actions.manualFetchBatch);
    const backfillGvrHistory = useAction(
        api.insights.actions.backfillGvrHistory,
    );

    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [selectedInterests, setSelectedInterests] = useState<
        InterestOptionId[]
    >([]);
    const [isSavingRegions, setIsSavingRegions] = useState(false);
    const [isSavingInterests, setIsSavingInterests] = useState(false);
    const [isManualFetching, setIsManualFetching] = useState(false);
    const [isBackfillingGvr, setIsBackfillingGvr] = useState(false);

    useEffect(() => {
        if (preferences?.regions) {
            const keys = preferences.regions.map((region) =>
                normalizeRegionKey(region),
            );
            setSelectedRegions(keys);
        } else {
            setSelectedRegions([]);
        }

        if (preferences?.interests) {
            setSelectedInterests([...preferences.interests]);
        } else {
            setSelectedInterests([]);
        }
    }, [preferences]);

    const supportedRegionMap = useMemo(
        () =>
            new Map(
                (supportedRegions ?? []).map((region) => [region.key, region]),
            ),
        [supportedRegions],
    );
    const savedRegions = preferences?.regions ?? [];

    const hasRegionChanges = () => {
        const currentKeys = (preferences?.regions || []).map((region) =>
            normalizeRegionKey(region),
        );
        if (currentKeys.length !== selectedRegions.length) return true;
        return selectedRegions.some((region) => !currentKeys.includes(region));
    };

    const hasInterestChanges = () => {
        const current = preferences?.interests || [];
        if (current.length !== selectedInterests.length) return true;
        return selectedInterests.some(
            (interest) => !current.includes(interest),
        );
    };

    const handleRegionSave = async () => {
        if (!supportedRegions) return;

        const regions = selectedRegions
            .map((key) => supportedRegionMap.get(key))
            .filter(
                (region): region is (typeof supportedRegions)[number] =>
                    region !== undefined,
            );

        setIsSavingRegions(true);
        try {
            await updateRegion({
                regions: regions.map((region) => ({
                    city: region.city,
                    state: region.state,
                    country: region.country,
                })),
            });
            toast.success("Regions updated");
        } catch {
            toast.error("Failed to update regions");
        } finally {
            setIsSavingRegions(false);
        }
    };

    const handleInterestsSave = async () => {
        setIsSavingInterests(true);
        try {
            await updateInterests({
                interests: selectedInterests,
            });
            toast.success("Interests updated");
        } catch {
            toast.error("Failed to update interests");
        } finally {
            setIsSavingInterests(false);
        }
    };

    const handleManualFetch = async () => {
        if (savedRegions.length === 0) {
            toast.error(
                "Save at least one region before running manual fetch.",
            );
            return;
        }

        setIsManualFetching(true);
        try {
            const result = await manualFetchBatch({
                regions: savedRegions.map((region) => ({
                    city: region.city,
                    state: region.state,
                    country: region.country,
                })),
            });

            if (result.failedRegions === 0) {
                toast.success(
                    `Manual fetch completed for ${result.succeededRegions} region${result.succeededRegions === 1 ? "" : "s"}.`,
                );
            } else if (result.succeededRegions > 0) {
                toast.error(
                    `Manual fetch finished with issues (${result.succeededRegions} succeeded, ${result.failedRegions} failed).`,
                );
            } else {
                toast.error("Manual fetch failed for all regions.");
            }
        } catch {
            toast.error("Manual fetch failed.");
        } finally {
            setIsManualFetching(false);
        }
    };

    const handleBackfillGvr = async () => {
        setIsBackfillingGvr(true);
        try {
            const result = await backfillGvrHistory({ months: 12 });
            if (result.failed === 0) {
                toast.success(
                    `Backfill complete: ${result.succeeded}/${result.requestedMonths} months ingested.`,
                );
            } else {
                toast.error(
                    `Backfill finished with issues (${result.succeeded} succeeded, ${result.failed} failed).`,
                );
            }
        } catch {
            toast.error("Failed to backfill GVR history.");
        } finally {
            setIsBackfillingGvr(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Market Preferences</DialogTitle>
                    <DialogDescription>
                        Manage your market regions, insight topics, and run a
                        manual data fetch.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 p-6 space-y-6 overflow-y-auto scrollbar-hidden">
                    {preferences === undefined ||
                    supportedRegions === undefined ? (
                        <DialogLoading />
                    ) : (
                        <>
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-5 w-5 text-primary" />
                                        <CardTitle>Market Regions</CardTitle>
                                    </div>
                                    <CardDescription>
                                        Select one or more Greater Vancouver
                                        markets for personalized insights.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="insights-regions">
                                            City / Metro Areas
                                        </Label>
                                        <MultiSelect
                                            id="insights-regions"
                                            options={supportedRegions.map(
                                                (region) => ({
                                                    label: formatRegionLabel(
                                                        region,
                                                    ),
                                                    value: region.key,
                                                }),
                                            )}
                                            defaultValue={selectedRegions}
                                            onValueChange={setSelectedRegions}
                                            placeholder="Select one or more regions"
                                            maxCount={3}
                                            className="w-full sm:w-[320px]"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Region selection is currently
                                            limited to Greater Vancouver markets
                                            supported by GVR Market Watch.
                                        </p>
                                    </div>

                                    {hasRegionChanges() && (
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleRegionSave}
                                                disabled={isSavingRegions}
                                            >
                                                {isSavingRegions
                                                    ? "Saving..."
                                                    : "Save Regions"}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={() => {
                                                    const currentKeys = (
                                                        preferences?.regions ||
                                                        []
                                                    ).map((region) =>
                                                        normalizeRegionKey(
                                                            region,
                                                        ),
                                                    );
                                                    setSelectedRegions(
                                                        currentKeys,
                                                    );
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-primary" />
                                        <CardTitle>Market Interests</CardTitle>
                                    </div>
                                    <CardDescription>
                                        Choose what topics to prioritize in your
                                        feed.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {INTEREST_OPTIONS.map((interest) => (
                                            <div
                                                key={interest.id}
                                                className="flex items-start space-x-3"
                                            >
                                                <Checkbox
                                                    id={interest.id}
                                                    checked={selectedInterests.includes(
                                                        interest.id,
                                                    )}
                                                    onCheckedChange={(
                                                        checked,
                                                    ) => {
                                                        if (checked) {
                                                            setSelectedInterests(
                                                                [
                                                                    ...selectedInterests,
                                                                    interest.id,
                                                                ],
                                                            );
                                                        } else {
                                                            setSelectedInterests(
                                                                selectedInterests.filter(
                                                                    (value) =>
                                                                        value !==
                                                                        interest.id,
                                                                ),
                                                            );
                                                        }
                                                    }}
                                                />
                                                <div className="space-y-1 leading-none">
                                                    <Label
                                                        htmlFor={interest.id}
                                                        className="text-sm font-medium cursor-pointer"
                                                    >
                                                        {interest.label}
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {interest.description}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {hasInterestChanges() && (
                                        <div className="flex gap-2 mt-4">
                                            <Button
                                                onClick={handleInterestsSave}
                                                disabled={isSavingInterests}
                                            >
                                                {isSavingInterests
                                                    ? "Saving..."
                                                    : "Save Interests"}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={() =>
                                                    setSelectedInterests(
                                                        preferences?.interests ||
                                                            [],
                                                    )
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <RefreshCw className="h-5 w-5 text-primary" />
                                        <CardTitle>Manual Fetch</CardTitle>
                                    </div>
                                    <CardDescription>
                                        Pull the latest market data immediately.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                        Fetch runs for your saved regions and
                                        also refreshes structured rate data.
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        For charts, backfill the last 12 months
                                        of GVR reports into your database.
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Targets:{" "}
                                        {savedRegions.length > 0
                                            ? savedRegions
                                                  .map((region) =>
                                                      formatRegionLabel(region),
                                                  )
                                                  .join(", ")
                                            : "No saved regions"}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            onClick={handleManualFetch}
                                            disabled={
                                                isManualFetching ||
                                                savedRegions.length === 0
                                            }
                                        >
                                            {isManualFetching
                                                ? "Fetching..."
                                                : "Fetch Latest Now"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleBackfillGvr}
                                            disabled={isBackfillingGvr}
                                        >
                                            {isBackfillingGvr
                                                ? "Backfilling..."
                                                : "Backfill Last 12 Months"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <Bell className="h-5 w-5 text-primary" />
                                        <CardTitle>Data Sources</CardTitle>
                                    </div>
                                    <CardDescription>
                                        Where we get your market insights.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground space-y-2">
                                        <p>
                                            We gather data from these trusted
                                            Canadian sources:
                                        </p>
                                        <ul className="list-disc list-inside space-y-1 ml-2">
                                            <li>
                                                <strong>
                                                    GVR Market Watch
                                                </strong>{" "}
                                                - Monthly MLS benchmark price,
                                                sales, listings, and
                                                sales-to-active ratio for
                                                Greater Vancouver
                                            </li>
                                            <li>
                                                <strong>
                                                    Bank of Canada Valet API
                                                </strong>{" "}
                                                - Policy rate, mortgage rates,
                                                prime rate
                                            </li>
                                        </ul>
                                        <p>
                                            GVR source pages are refreshed
                                            daily. Structured BoC API data
                                            refreshes every 6 hours. Data
                                            expires after 24-48 hours.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DialogLoading() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-36" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-10 w-[320px]" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-56" />
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-12" />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
