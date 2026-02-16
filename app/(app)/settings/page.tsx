"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MapPin, Bell, Building2 } from "lucide-react";

const INTEREST_OPTIONS = [
    {
        id: "home_prices",
        label: "Home Prices",
        description: "Median prices, price trends, affordability",
    },
    {
        id: "inventory_levels",
        label: "Inventory Levels",
        description: "Available homes, days on market, supply",
    },
    {
        id: "mortgage_rates",
        label: "Mortgage Rates",
        description: "Current rates, forecasts, lending news",
    },
    {
        id: "market_trends",
        label: "Market Trends",
        description: "Overall market analysis and predictions",
    },
    {
        id: "new_construction",
        label: "New Construction",
        description: "Building permits, new developments",
    },
    {
        id: "rental_market",
        label: "Rental Market",
        description: "Rent prices, vacancy rates, trends",
    },
];

function normalizeRegionKey(region: {
    city: string;
    state?: string;
    country: string;
}) {
    return `${region.city.toLowerCase().replace(/\s+/g, "-")}-${region.state?.toLowerCase() || ""}-${region.country.toLowerCase()}`;
}

export default function SettingsPage() {
    const preferences = useQuery(api.insights.queries.getUserPreferences);
    const supportedRegions = useQuery(api.insights.queries.getSupportedRegions);
    const updateRegion = useMutation(api.users.mutations.updateRegion);
    const updateInterests = useMutation(api.users.mutations.updateInterests);

    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize from user preferences
    useEffect(() => {
        if (preferences?.regions) {
            const keys = preferences.regions.map((region) =>
                normalizeRegionKey(region),
            );
            setSelectedRegions(keys);
        }
        if (preferences?.interests) {
            setSelectedInterests(preferences.interests);
        }
    }, [preferences]);

    if (preferences === undefined || supportedRegions === undefined) {
        return <SettingsLoading />;
    }

    const handleRegionSave = async () => {
        const regionByKey = new Map(
            supportedRegions.map((region) => [region.key, region]),
        );
        const regions = selectedRegions
            .map((key) => regionByKey.get(key))
            .filter(
                (region): region is (typeof supportedRegions)[number] =>
                    region !== undefined,
            );

        setIsSaving(true);
        try {
            await updateRegion({
                regions: regions.map((region) => ({
                    city: region.city,
                    state: region.state,
                    country: region.country,
                })),
            });
            toast.success("Regions updated successfully");
        } catch (error) {
            toast.error("Failed to update regions");
        } finally {
            setIsSaving(false);
        }
    };

    const handleInterestsSave = async () => {
        setIsSaving(true);
        try {
            await updateInterests({
                interests: selectedInterests as any[],
            });
            toast.success("Interests updated successfully");
        } catch (error) {
            toast.error("Failed to update interests");
        } finally {
            setIsSaving(false);
        }
    };

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
        return selectedInterests.some((i) => !current.includes(i as any));
    };

    return (
        <div className="p-6 md:p-8 max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your market preferences and insights
                </p>
            </div>

            <div className="space-y-6">
                {/* Region Selection */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            <CardTitle>Market Region</CardTitle>
                        </div>
                        <CardDescription>
                            Select your primary market area for personalized
                            insights
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="region">City / Metro Areas</Label>
                            <MultiSelect
                                options={supportedRegions.map((region) => ({
                                    label: `${region.city}${region.state ? `, ${region.state}` : ""}`,
                                    value: region.key,
                                }))}
                                defaultValue={selectedRegions}
                                onValueChange={setSelectedRegions}
                                placeholder="Select one or more regions"
                                maxCount={3}
                                id="region"
                                className="w-full sm:w-[300px]"
                            />
                            <p className="text-xs text-muted-foreground">
                                We&apos;ll fetch market data from trusted
                                sources for these regions
                            </p>
                        </div>

                        {hasRegionChanges() && (
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleRegionSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "Saving..." : "Save Regions"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (preferences?.regions) {
                                            const keys =
                                                preferences.regions.map(
                                                    (region) =>
                                                        normalizeRegionKey(
                                                            region,
                                                        ),
                                                );
                                            setSelectedRegions(keys);
                                        } else {
                                            setSelectedRegions([]);
                                        }
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Interests Selection */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            <CardTitle>Market Interests</CardTitle>
                        </div>
                        <CardDescription>
                            Choose the topics you want to track
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
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedInterests([
                                                    ...selectedInterests,
                                                    interest.id,
                                                ]);
                                            } else {
                                                setSelectedInterests(
                                                    selectedInterests.filter(
                                                        (i) =>
                                                            i !== interest.id,
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
                                    disabled={isSaving}
                                >
                                    {isSaving ? "Saving..." : "Save Interests"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() =>
                                        setSelectedInterests(
                                            preferences?.interests || [],
                                        )
                                    }
                                >
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Data Sources Info */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-primary" />
                            <CardTitle>Data Sources</CardTitle>
                        </div>
                        <CardDescription>
                            Where we get your market insights
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground space-y-2">
                            <p>
                                We gather data from these trusted Canadian
                                sources:
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Realtor.ca Market Data</li>
                                <li>
                                    Real Estate Board Statistics (REBGV, FVREB,
                                    VREB, OMREB)
                                </li>
                                <li>Zoocasa Market Reports</li>
                                <li>Royal LePage Housing Reports</li>
                                <li>Bank of Canada Interest Rates</li>
                                <li>CREA Market Analysis</li>
                            </ul>
                            <p className="mt-4">
                                Data is refreshed daily at 6:00 AM PT. All
                                insights expire after 48 hours to ensure
                                freshness.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function SettingsLoading() {
    return (
        <div className="p-6 md:p-8 max-w-3xl mx-auto">
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-64 mb-6" />

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-10 w-[300px]" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-56" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-12" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
