"use client";

import { Badge } from "@/components/ui/badge";
import {
    Home,
    Warehouse,
    Percent,
    TrendingUp,
    Building2,
    Key,
} from "lucide-react";
import { InsightCard } from "./InsightCard";
import type { Doc } from "@/convex/_generated/dataModel";

type Insight = Doc<"newsContextItems">;
type Metric = Doc<"marketMetrics">;

const categoryMeta: Record<
    string,
    { label: string; icon: React.ReactNode; color: string }
> = {
    home_prices: {
        label: "Home Prices",
        icon: <Home className="size-4" />,
        color: "text-blue-600 dark:text-blue-400",
    },
    inventory: {
        label: "Inventory",
        icon: <Warehouse className="size-4" />,
        color: "text-green-600 dark:text-green-400",
    },
    mortgage_rates: {
        label: "Mortgage Rates",
        icon: <Percent className="size-4" />,
        color: "text-purple-600 dark:text-purple-400",
    },
    market_trend: {
        label: "Market Trends",
        icon: <TrendingUp className="size-4" />,
        color: "text-orange-600 dark:text-orange-400",
    },
    new_construction: {
        label: "New Construction",
        icon: <Building2 className="size-4" />,
        color: "text-yellow-600 dark:text-yellow-400",
    },
    rental: {
        label: "Rental Market",
        icon: <Key className="size-4" />,
        color: "text-pink-600 dark:text-pink-400",
    },
};

interface CategorySectionProps {
    category: string;
    insights: Insight[];
    metrics?: Metric[];
}

function HeadlineMetric({ metric }: { metric: Metric }) {
    return (
        <div className="flex items-baseline gap-2">
            <span
                className="text-2xl font-bold"
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {metric.formattedValue}
            </span>
            <span className="text-sm text-muted-foreground">
                {metric.label}
            </span>
        </div>
    );
}

export function CategorySection({
    category,
    insights,
    metrics,
}: CategorySectionProps) {
    const meta = categoryMeta[category] ?? {
        label: category,
        icon: <TrendingUp className="size-4" />,
        color: "text-muted-foreground",
    };

    // Pick headline metric: first metric matching this category
    const headlineMetric = metrics?.find((m) => m.category === category);

    // Collect all data points from insights in this category
    const allDataPoints = insights.flatMap((i) => i.dataPoints ?? []);

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2">
                <span className={meta.color}>{meta.icon}</span>
                <h2 className="text-lg font-semibold">{meta.label}</h2>
                <Badge variant="secondary" className="text-xs">
                    {insights.length}
                </Badge>
            </div>

            {headlineMetric && <HeadlineMetric metric={headlineMetric} />}

            {allDataPoints.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {allDataPoints.slice(0, 8).map((point, i) => (
                        <Badge
                            key={`${point.label}-${i}`}
                            variant="outline"
                            className="text-xs font-normal"
                        >
                            {point.label}:{" "}
                            <span className="font-medium ml-1">
                                {point.value}
                            </span>
                        </Badge>
                    ))}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {insights.map((insight) => (
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
                        compact
                    />
                ))}
            </div>
        </section>
    );
}
