"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Percent,
    DollarSign,
    Clock,
    Hash,
} from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

type Metric = Doc<"marketMetrics">;

const metricDescriptions: Record<string, string> = {
    boc_policy_rate:
        "The Bank of Canada's overnight lending rate. Directly influences variable-rate mortgages and lines of credit.",
    prime_rate:
        "The base rate set by major banks, typically BoC rate + 2.2%. Variable mortgages and HELOCs are priced relative to prime.",
    "5yr_fixed_mortgage":
        "The conventional 5-year fixed mortgage rate reported by the Bank of Canada. The most common mortgage term in Canada.",
    "3yr_fixed_mortgage":
        "The conventional 3-year fixed mortgage rate reported by the Bank of Canada. A shorter-term fixed option for borrowers.",
    gvr_mls_benchmark_price:
        "MLS Home Price Index composite benchmark price for Greater Vancouver from GVR Market Watch.",
    gvr_mls_sales:
        "Total residential sales in Greater Vancouver from the latest GVR monthly report.",
    gvr_new_listings:
        "Total newly listed properties in Greater Vancouver from GVR Market Watch.",
    gvr_active_listings:
        "Total active MLS listings in Greater Vancouver from GVR Market Watch.",
    gvr_sales_to_active_ratio:
        "Sales-to-active listings ratio reported by GVR for Greater Vancouver.",
};

const unitIcons: Record<string, React.ReactNode> = {
    percent: <Percent className="size-4" aria-hidden="true" />,
    cad: <DollarSign className="size-4" aria-hidden="true" />,
    days: <Clock className="size-4" aria-hidden="true" />,
    count: <Hash className="size-4" aria-hidden="true" />,
};

function formatReferenceMonth(referenceDate: string) {
    const date = new Date(`${referenceDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toLocaleDateString("en-CA", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

function getSourceLabel(metric: Metric) {
    if (metric.source === "gvr_market_watch") {
        return "GVR Market Watch";
    }
    return metric.sourceLabel;
}

function TrendIndicator({
    trend,
    changePercent,
    changeFormatted,
}: {
    trend: Metric["trend"];
    changePercent?: number;
    changeFormatted?: string;
}) {
    const normalizedChange = changeFormatted?.replace(/\s+/g, "");
    const isZeroFormatted =
        normalizedChange !== undefined &&
        /^[-+]?0(?:\.0+)?%$/.test(normalizedChange);
    const isZeroPercent =
        typeof changePercent === "number" && Math.abs(changePercent) < 0.001;
    const shouldHide =
        trend === "neutral" &&
        (!changeFormatted || isZeroFormatted || isZeroPercent);

    if (shouldHide) return null;

    const colorClass =
        trend === "up"
            ? "text-green-600 dark:text-green-400"
            : trend === "down"
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground";

    return (
        <span
            className={`flex items-center gap-0.5 text-xs font-medium ${colorClass}`}
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
            {changeFormatted && <span>{changeFormatted}</span>}
        </span>
    );
}

function KPICard({ metric }: { metric: Metric }) {
    const description = metricDescriptions[metric.metricKey];
    const referenceMonth = formatReferenceMonth(metric.referenceDate);

    const card = (
        <Card className="p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    {unitIcons[metric.unit] ?? unitIcons.count}
                </div>
                <TrendIndicator
                    trend={metric.trend}
                    changePercent={metric.changePercent}
                    changeFormatted={metric.changeFormatted}
                />
            </div>
            <div>
                <p className="text-xs text-muted-foreground leading-none mb-1">
                    {metric.label}
                </p>
                <p
                    className="text-xl font-semibold tracking-tight"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {metric.formattedValue}
                </p>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {getSourceLabel(metric)}
                </Badge>
                {referenceMonth && (
                    <span className="text-[10px] text-muted-foreground">
                        {referenceMonth}
                    </span>
                )}
            </div>
        </Card>
    );

    if (!description) return card;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{card}</TooltipTrigger>
            <TooltipContent
                side="bottom"
                className="max-w-xs border-slate-700 bg-slate-900 text-xs text-slate-100 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900"
            >
                {description}
            </TooltipContent>
        </Tooltip>
    );
}

export function KPIStrip({ metrics }: { metrics: Metric[] }) {
    if (metrics.length === 0) return null;

    return (
        <TooltipProvider delayDuration={300}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {metrics.slice(0, 6).map((metric) => (
                    <KPICard key={metric._id} metric={metric} />
                ))}
            </div>
        </TooltipProvider>
    );
}

export function KPIStripSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <Skeleton className="size-7 rounded-md" />
                        <Skeleton className="h-4 w-12" />
                    </div>
                    <div>
                        <Skeleton className="h-3 w-20 mb-1.5" />
                        <Skeleton className="h-6 w-16" />
                    </div>
                </Card>
            ))}
        </div>
    );
}
