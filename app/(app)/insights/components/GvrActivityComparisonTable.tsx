"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function formatCount(value: number | undefined) {
    if (value === undefined) return "-";
    return Math.round(value).toLocaleString("en-CA");
}

function formatPct(value: number | undefined) {
    if (value === undefined) return "-";
    return `${value.toFixed(1)}%`;
}

function propertyTypeLabel(value: "detached" | "attached" | "apartment") {
    if (value === "detached") return "Detached";
    if (value === "attached") return "Attached";
    return "Apartment";
}

export function GvrActivityComparisonTable({
    regionKeys,
    mode = "both",
}: {
    regionKeys: string[];
    mode?: "listings" | "sales" | "both";
}) {
    const sortedRegionKeys = useMemo(
        () => [...new Set(regionKeys)].sort(),
        [regionKeys],
    );
    const data = useQuery(
        api.insights.metricHistoryQueries.getGvrActivityComparisons,
        {
            regionKeys: sortedRegionKeys,
        },
    );

    if (data === undefined) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-72" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </CardContent>
            </Card>
        );
    }

    const title =
        mode === "listings"
            ? "Region vs Grand Total (Listings)"
            : mode === "sales"
              ? "Region vs Grand Total (Sales)"
              : "Region vs Grand Total (Listings & Sales)";

    if (!data || data.regions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No activity comparison data yet. Run the GVR backfill to
                        populate summary-table values.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const showListings = mode === "listings" || mode === "both";
    const showSales = mode === "sales" || mode === "both";

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Columns from GVR summary table:{" "}
                    {data.comparisonDates.previousYearSameMonth},{" "}
                    {data.comparisonDates.previousMonth},{" "}
                    {data.comparisonDates.currentMonth}
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {data.regions.map((region) => (
                    <div key={region.regionKey} className="space-y-2">
                        <h3 className="text-sm font-semibold">
                            {region.regionLabel}
                            {region.areaLabel ? ` (${region.areaLabel})` : ""}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="px-2 py-2 text-left font-medium">
                                            Type
                                        </th>
                                        {showListings ? (
                                            <>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    Listings PY
                                                </th>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    Listings PM
                                                </th>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    Listings CM
                                                </th>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    Grand CM
                                                </th>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    % Grand
                                                </th>
                                            </>
                                        ) : null}
                                        {showSales ? (
                                            <>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    Sales PY
                                                </th>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    Sales PM
                                                </th>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    Sales CM
                                                </th>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    Grand CM
                                                </th>
                                                <th className="px-2 py-2 text-right font-medium">
                                                    % Grand
                                                </th>
                                            </>
                                        ) : null}
                                    </tr>
                                </thead>
                                <tbody>
                                    {region.rows.map((row) => (
                                        <tr
                                            key={row.propertyType}
                                            className="border-b last:border-0"
                                        >
                                            <td className="px-2 py-2 font-medium">
                                                {propertyTypeLabel(row.propertyType)}
                                            </td>
                                            {showListings ? (
                                                <>
                                                    <td className="px-2 py-2 text-right tabular-nums">
                                                        {formatCount(
                                                            row.listings.previousYear,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-right tabular-nums">
                                                        {formatCount(
                                                            row.listings.previousMonth,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-right tabular-nums">
                                                        {formatCount(
                                                            row.listings.currentMonth,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                                                        {formatCount(
                                                            row.listings
                                                                .grandCurrentMonth,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                                                        {formatPct(
                                                            row.listings
                                                                .currentMonthShareOfGrandPct,
                                                        )}
                                                    </td>
                                                </>
                                            ) : null}
                                            {showSales ? (
                                                <>
                                                    <td className="px-2 py-2 text-right tabular-nums">
                                                        {formatCount(
                                                            row.sales.previousYear,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-right tabular-nums">
                                                        {formatCount(
                                                            row.sales.previousMonth,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-right tabular-nums">
                                                        {formatCount(
                                                            row.sales.currentMonth,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                                                        {formatCount(
                                                            row.sales
                                                                .grandCurrentMonth,
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                                                        {formatPct(
                                                            row.sales
                                                                .currentMonthShareOfGrandPct,
                                                        )}
                                                    </td>
                                                </>
                                            ) : null}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
