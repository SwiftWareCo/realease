"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface InsightCardProps {
    title: string;
    summary: string;
    sourceName: string;
    sourceUrl: string;
    category: string;
    fetchedAt: number;
    region?: { city: string; state?: string; country: string };
    dataPoints?: Array<{
        label: string;
        value: string;
        trend?: "up" | "down" | "neutral";
    }>;
    compact?: boolean;
}

const categoryLabels: Record<string, string> = {
    home_prices: "Home Prices",
    inventory: "Inventory",
    mortgage_rates: "Mortgage Rates",
    market_trend: "Market Trends",
    new_construction: "New Construction",
    rental: "Rental Market",
};

const categoryColors: Record<string, string> = {
    home_prices:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    inventory:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    mortgage_rates:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    market_trend:
        "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    new_construction:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    rental: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

function getDisplaySummary(summary: string) {
    const trimmed = summary.trim();
    if (!trimmed.startsWith("{")) {
        return trimmed;
    }

    try {
        const parsed = JSON.parse(trimmed) as {
            content?: string;
            description?: string;
            data?: {
                content?: string;
                description?: string;
            };
        };

        const candidate =
            parsed.data?.content ||
            parsed.content ||
            parsed.data?.description ||
            parsed.description;

        if (!candidate) {
            return "Summary unavailable. Open the source for details.";
        }

        const normalized = candidate.replace(/\s+/g, " ").trim();
        if (normalized.length <= 420) {
            return normalized;
        }
        return `${normalized.slice(0, 420).trimEnd()}...`;
    } catch {
        return "Summary unavailable. Open the source for details.";
    }
}

export function InsightCard({
    title,
    summary,
    sourceName,
    sourceUrl,
    category,
    fetchedAt,
    region,
    dataPoints,
    compact = false,
}: InsightCardProps) {
    const regionLabel = region
        ? `${region.city}${region.state ? `, ${region.state}` : ""}`
        : null;
    const displaySummary = getDisplaySummary(summary);

    return (
        <Card className="h-full hover:shadow-md transition-shadow">
            <CardHeader className={compact ? "pb-2" : "pb-3"}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <CardTitle className={`font-semibold leading-tight line-clamp-2 ${compact ? "text-sm" : "text-base"}`}>
                            {title}
                        </CardTitle>
                    </div>
                    {!compact && (
                        <Badge
                            className={categoryColors[category] || "bg-gray-100"}
                            variant="secondary"
                        >
                            {categoryLabels[category] || category}
                        </Badge>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{sourceName}</span>
                    {regionLabel && (
                        <>
                            <span>•</span>
                            <span>{regionLabel}</span>
                        </>
                    )}
                    <span>•</span>
                    <span>
                        {formatDistanceToNow(fetchedAt, { addSuffix: true })}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {displaySummary}
                </p>

                {dataPoints && dataPoints.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {dataPoints.map((point, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs"
                            >
                                <span className="text-muted-foreground">
                                    {point.label}:
                                </span>
                                <span className="font-medium">
                                    {point.value}
                                </span>
                                {point.trend && (
                                    <span>
                                        {point.trend === "up" && (
                                            <TrendingUp className="h-3 w-3 text-green-500" />
                                        )}
                                        {point.trend === "down" && (
                                            <TrendingDown className="h-3 w-3 text-red-500" />
                                        )}
                                        {point.trend === "neutral" && (
                                            <Minus className="h-3 w-3 text-gray-500" />
                                        )}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                    Read more
                    <ExternalLink className="h-3 w-3" />
                </a>
            </CardContent>
        </Card>
    );
}
