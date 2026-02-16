"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightCard } from "./components/InsightCard";
import { InsightsEmptyState } from "./components/InsightsEmptyState";
import { Settings, MapPin } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { MultiSelect } from "@/components/multi-select";
import { Badge } from "@/components/ui/badge";

const categoryOrder = [
    "home_prices",
    "mortgage_rates",
    "inventory",
    "market_trend",
    "new_construction",
    "rental",
];

const categoryLabels: Record<string, string> = {
    home_prices: "Home Prices",
    inventory: "Inventory",
    mortgage_rates: "Mortgage Rates",
    market_trend: "Market Trends",
    new_construction: "New Construction",
    rental: "Rental",
};

export default function InsightsPage() {
    const [selectedRegionKeys, setSelectedRegionKeys] = useState<
        string[] | null
    >(null);
    const data = useQuery(
        api.insights.queries.getMyInsights,
        selectedRegionKeys ? { regionKeys: selectedRegionKeys } : {},
    );

    if (data === undefined) {
        return <InsightsLoading />;
    }

    if (data === null) {
        return (
            <div className="p-6 md:p-8 max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">
                        Market Insights
                    </h1>
                    <p className="text-muted-foreground">
                        Real estate data and trends for your market
                    </p>
                </div>
                <InsightsEmptyState hasRegion={false} />
            </div>
        );
    }

    const { regions, insights, lastUpdated } = data;
    const hasInsights = Object.keys(insights).length > 0;
    const regionOptions = regions.map((region) => ({
        label: `${region.city}${region.state ? `, ${region.state}` : ""}`,
        value: region.key,
    }));
    const hasMultipleRegions = regions.length > 1;

    // Get sorted categories that have data
    const availableCategories = categoryOrder.filter(
        (cat) => insights[cat]?.length > 0,
    );

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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
                        {lastUpdated && (
                            <span className="ml-1">
                                • Updated{" "}
                                {formatDistanceToNow(lastUpdated, {
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
                            defaultValue={
                                selectedRegionKeys ??
                                regions.map((region) => region.key)
                            }
                            onValueChange={setSelectedRegionKeys}
                            placeholder="Filter regions"
                            maxCount={2}
                            className="w-full sm:w-[260px]"
                        />
                    )}
                    <Link href="/settings">
                        <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                        </Button>
                    </Link>
                </div>
            </div>

            {!hasInsights ? (
                <InsightsEmptyState hasRegion={true} regions={regions} />
            ) : (
                <Tabs
                    defaultValue={availableCategories[0]}
                    className="space-y-6"
                >
                    <TabsList className="flex flex-wrap h-auto gap-1">
                        {availableCategories.map((category) => (
                            <TabsTrigger
                                key={category}
                                value={category}
                                className="text-xs"
                            >
                                {categoryLabels[category]}
                                <span className="ml-1.5 text-[10px] text-muted-foreground">
                                    ({insights[category].length})
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {availableCategories.map((category) => (
                        <TabsContent
                            key={category}
                            value={category}
                            className="space-y-4"
                        >
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {insights[category].map((insight) => (
                                    <InsightCard
                                        key={insight._id}
                                        title={insight.title}
                                        summary={insight.summary}
                                        sourceName={insight.sourceName}
                                        sourceUrl={insight.sourceUrl}
                                        category={insight.category}
                                        fetchedAt={insight.fetchedAt}
                                        dataPoints={insight.dataPoints}
                                        region={insight.region}
                                    />
                                ))}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            )}
        </div>
    );
}

function InsightsLoading() {
    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <div className="mb-6">
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="h-[200px]">
                        <CardHeader className="pb-3">
                            <Skeleton className="h-5 w-full mb-2" />
                            <Skeleton className="h-3 w-24" />
                        </CardHeader>
                        <CardContent className="pt-0">
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-4 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-1/2" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
