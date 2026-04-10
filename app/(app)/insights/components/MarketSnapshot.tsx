"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Info,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Minus,
} from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Doc } from "@/convex/_generated/dataModel";

type MarketSummary = Doc<"marketSummaries">;
type Metric = Doc<"marketMetrics">;

type ObjectionHandler = {
    objection: string;
    response: string;
};

type ConfidenceLevel = "high" | "medium" | "low";

type MarketConfidence = {
    level: ConfidenceLevel;
    reason: string;
};

type WhyThisGuidanceView = {
    rationale: string;
    rateImpact: string;
    rateTranslation?: string;
    evidence: string[];
};

type MarketSummaryView = MarketSummary & {
    confidence?: MarketConfidence;
    whatChanged?: string;
    actionableIntel?: {
        seller: string;
        buyer: string;
        sellerObjection?: ObjectionHandler;
        buyerObjection?: ObjectionHandler;
    };
    whyThisGuidance?: WhyThisGuidanceView;
};

const GVR_MVP_METRIC_KEYS = new Set([
    "gvr_mls_benchmark_price",
    "gvr_mls_sales",
    "gvr_new_listings",
    "gvr_active_listings",
    "gvr_sales_to_active_ratio",
]);

const metricDescriptions: Record<string, string> = {
    gvr_mls_benchmark_price:
        "Estimated typical home value in Greater Vancouver (MLS HPI benchmark), used as the pricing anchor for comps.",
    gvr_mls_sales:
        "Total homes sold during the report month. Higher sales generally signal stronger demand and faster deal flow.",
    gvr_new_listings:
        "Newly listed homes in the report month. Rising new listings usually means buyers have more choice.",
    gvr_active_listings:
        "Total homes currently listed for sale. Higher inventory generally increases buyer negotiating power.",
    gvr_sales_to_active_ratio:
        "Absorption ratio: sales divided by active listings. <12% often buyer-leaning, 12-20% balanced, >20% seller-leaning.",
};

const conditionConfig: Record<
    MarketSummary["marketCondition"],
    { label: string; className: string }
> = {
    buyers: {
        label: "Buyer's Market",
        className:
            "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    },
    balanced: {
        label: "Balanced Market",
        className:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
    },
    sellers: {
        label: "Seller's Market",
        className:
            "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    },
};

const confidenceConfig: Record<
    ConfidenceLevel,
    { label: string; className: string; dotClassName: string }
> = {
    high: {
        label: "High confidence",
        className:
            "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
        dotClassName: "bg-emerald-400",
    },
    medium: {
        label: "Medium confidence",
        className:
            "border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
        dotClassName: "bg-amber-400",
    },
    low: {
        label: "Low confidence",
        className:
            "border border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-200",
        dotClassName: "bg-slate-400",
    },
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getSentimentMeterPosition(
    condition: MarketSummary["marketCondition"],
    salesToActiveRatio: number | undefined,
) {
    if (
        typeof salesToActiveRatio === "number" &&
        Number.isFinite(salesToActiveRatio) &&
        salesToActiveRatio > 0
    ) {
        // Common GVR interpretation:
        // <12% buyer-leaning, 12-20% balanced, >20% seller-leaning.
        if (salesToActiveRatio < 12) {
            return clamp(8 + (salesToActiveRatio / 12) * 32, 8, 40);
        }
        if (salesToActiveRatio <= 20) {
            return clamp(40 + ((salesToActiveRatio - 12) / 8) * 20, 40, 60);
        }
        const capped = Math.min(salesToActiveRatio, 40);
        return clamp(60 + ((capped - 20) / 20) * 32, 60, 92);
    }

    if (condition === "buyers") return 18;
    if (condition === "sellers") return 82;
    return 50;
}

function formatTimeAgo(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

function formatReferenceMonth(referenceDate: string | null) {
    if (!referenceDate) return null;
    const date = new Date(`${referenceDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-CA", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

function getSnapshotSourceDetails(metrics?: Metric[]) {
    if (!metrics || metrics.length === 0) {
        return {
            sourceLabel: "Mixed Sources",
            referenceDate: null as string | null,
        };
    }

    const gvrMetrics = metrics.filter(
        (metric) =>
            metric.source === "gvr_market_watch" &&
            GVR_MVP_METRIC_KEYS.has(metric.metricKey),
    );

    if (gvrMetrics.length === 0) {
        const latest = [...metrics].sort((a, b) =>
            b.referenceDate.localeCompare(a.referenceDate),
        )[0];
        return {
            sourceLabel: latest?.sourceLabel ?? "Mixed Sources",
            referenceDate: latest?.referenceDate ?? null,
        };
    }

    const latestGvr = [...gvrMetrics].sort((a, b) =>
        b.referenceDate.localeCompare(a.referenceDate),
    )[0];

    return {
        sourceLabel: "GVR Market Watch",
        referenceDate: latestGvr?.referenceDate ?? null,
    };
}

function firstSentence(text: string) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) {
        return "Current market positioning based on latest available signals.";
    }
    const sentenceMatch = normalized.match(/^(.+?[.!?])\s/);
    if (sentenceMatch?.[1]) {
        return sentenceMatch[1];
    }
    return normalized.length > 140
        ? `${normalized.slice(0, 140).trimEnd()}...`
        : normalized;
}

function getMetric(metrics: Metric[] | null | undefined, metricKey: string) {
    return (metrics ?? []).find((metric) => metric.metricKey === metricKey);
}

function getMetricSourceLabel(metric: Metric | null | undefined) {
    if (!metric) return null;
    if (metric.source === "gvr_market_watch") {
        return "GVR Market Watch";
    }
    return metric.sourceLabel;
}

function compactMetricLabel(label: string) {
    return label
        .replace(/^GVR\s+/i, "")
        .replace(/^MLS\s+/i, "")
        .replace(/\s+Mortgage$/i, " Mortgage");
}

function formatChange(metric: Metric | null | undefined) {
    if (!metric) return null;
    if (metric.changeFormatted?.trim()) {
        return metric.changeFormatted.trim();
    }
    if (typeof metric.changePercent === "number") {
        const sign = metric.changePercent > 0 ? "+" : "";
        return `${sign}${metric.changePercent.toFixed(1)}%`;
    }
    return null;
}

function getTopMovers(metrics: Metric[] | null | undefined, limit = 2) {
    return (metrics ?? [])
        .filter(
            (metric) =>
                metric.source === "gvr_market_watch" &&
                typeof metric.changePercent === "number" &&
                Number.isFinite(metric.changePercent),
        )
        .sort(
            (a, b) =>
                Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0),
        )
        .slice(0, limit);
}

function SnapshotStatCard({
    title,
    value,
    description,
    metric,
    subtitle,
    hint,
}: {
    title: string;
    value: string;
    description: string;
    metric?: Metric | null;
    subtitle?: string;
    hint?: string;
}) {
    const sourceLabel = getMetricSourceLabel(metric);
    const referenceMonth = formatReferenceMonth(metric?.referenceDate ?? null);
    const change = formatChange(metric);
    const tone =
        metric?.trend === "up"
            ? "text-emerald-600 dark:text-emerald-300"
            : metric?.trend === "down"
              ? "text-rose-600 dark:text-rose-300"
              : "text-slate-600 dark:text-slate-300";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="rounded-md border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-300/80">
                            {title}
                        </p>
                        {change ? (
                            <span
                                className={`text-[10px] font-semibold tabular-nums ${tone}`}
                            >
                                {change}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                        {value}
                    </p>
                    {subtitle ? (
                        <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300/80">
                            {subtitle}
                        </p>
                    ) : null}
                    {hint ? (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300/70">
                            {hint}
                        </p>
                    ) : null}
                    {sourceLabel || referenceMonth ? (
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                            <span>{sourceLabel ?? "Derived"}</span>
                            <span>{referenceMonth ?? "-"}</span>
                        </div>
                    ) : null}
                </div>
            </TooltipTrigger>
            <TooltipContent
                side="bottom"
                className="max-w-xs border-slate-700 bg-slate-900 text-xs leading-relaxed text-slate-100 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900"
            >
                <p>{description}</p>
                {sourceLabel || referenceMonth ? (
                    <p className="mt-1.5 text-[11px] text-slate-300 dark:text-slate-600">
                        {sourceLabel ? `Source: ${sourceLabel}` : "Source: Derived"}
                        {referenceMonth ? ` · Reference: ${referenceMonth}` : ""}
                    </p>
                ) : null}
            </TooltipContent>
        </Tooltip>
    );
}

function formatConditionLabel(condition: MarketSummary["marketCondition"]) {
    if (condition === "buyers") return "Buyer's Market";
    if (condition === "sellers") return "Seller's Market";
    return "Balanced Market";
}

function resolveWhyThisGuidance({
    summary,
    conditionLabel,
    bocPolicyRate,
}: {
    summary: MarketSummaryView;
    conditionLabel: string;
    bocPolicyRate?: Metric;
}): WhyThisGuidanceView {
    const aiWhy = summary.whyThisGuidance;

    const aiEvidence = Array.isArray(aiWhy?.evidence)
        ? aiWhy.evidence
              .filter(
                  (item): item is string =>
                      typeof item === "string" && item.trim().length > 0,
              )
              .map((item) => item.trim())
              .slice(0, 5)
        : [];

    const rationale =
        typeof aiWhy?.rationale === "string" && aiWhy.rationale.trim().length > 0
            ? aiWhy.rationale.trim()
            : `${firstSentence(summary.summary)} Current label is ${conditionLabel}, and the guidance is weighted toward the latest pricing, absorption, and demand signals for this region.`;

    const rateImpact =
        typeof aiWhy?.rateImpact === "string" &&
        aiWhy.rateImpact.trim().length > 0
            ? aiWhy.rateImpact.trim()
            : bocPolicyRate
              ? `${bocPolicyRate.label} is ${bocPolicyRate.formattedValue}, which changes mortgage qualification and monthly payment pressure. That directly affects how quickly buyers act and how much pricing leverage sellers keep.`
              : "Financing conditions are included because they change qualification and monthly carrying costs, which then shifts demand speed, negotiation leverage, and pricing tolerance.";

    const rateTranslation =
        typeof aiWhy?.rateTranslation === "string" &&
        aiWhy.rateTranslation.trim().length > 0
            ? aiWhy.rateTranslation.trim()
            : undefined;

    // Only fall back to stock metric-dump bullets when AI returned nothing.
    const evidence =
        aiEvidence.length > 0
            ? aiEvidence
            : [
                  "Live metrics and recent news were used to anchor the market read.",
                  "Pricing, supply, and rate signals shape both the sentiment label and the coaching lines above.",
              ];

    return {
        rationale: rationale.slice(0, 520),
        rateImpact: rateImpact.slice(0, 360),
        rateTranslation: rateTranslation?.slice(0, 260),
        evidence: evidence.map((item) => item.slice(0, 220)),
    };
}

function detectDirection(text: string | undefined): "up" | "down" | "flat" {
    if (!text) return "flat";
    const lower = text.toLowerCase();
    if (/\b(jump|jumped|rose|rising|up|higher|climb|climbed|gain|gained|increase|increased|surge)/.test(lower)) {
        return "up";
    }
    if (/\b(drop|dropped|fell|falling|down|lower|ease|eased|easing|decline|declined|dip|dipped|cool)/.test(lower)) {
        return "down";
    }
    return "flat";
}

function DirectionIcon({ direction }: { direction: "up" | "down" | "flat" }) {
    if (direction === "up") {
        return <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-300" />;
    }
    if (direction === "down") {
        return <TrendingDown className="size-3.5 text-rose-600 dark:text-rose-300" />;
    }
    return <Minus className="size-3.5 text-slate-600 dark:text-slate-300" />;
}

function ConfidenceBadge({ confidence }: { confidence: MarketConfidence }) {
    const config = confidenceConfig[confidence.level];
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${config.className}`}
                    >
                        <span
                            className={`inline-block size-1.5 rounded-full ${config.dotClassName}`}
                        />
                        {config.label}
                    </span>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    className="max-w-xs border-slate-700 bg-slate-900 text-slate-100 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900"
                >
                    {confidence.reason}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

function ObjectionPopover({
    handler,
}: {
    handler: ObjectionHandler;
}) {
    return (
        <Popover>
            <PopoverTrigger
                className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[11px] leading-snug text-slate-600 underline decoration-slate-400/60 underline-offset-2 transition hover:text-slate-900 hover:decoration-slate-700/70 dark:text-slate-300/90 dark:decoration-slate-500/50 dark:hover:text-slate-100 dark:hover:decoration-slate-300/60"
            >
                <Info className="size-3 shrink-0" />
                If they push back
            </PopoverTrigger>
            <PopoverContent
                side="left"
                align="start"
                sideOffset={8}
                className="w-80 border-slate-700 bg-slate-900 text-slate-100 shadow-xl [&>svg]:fill-slate-900 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:[&>svg]:fill-slate-100"
            >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                    They say
                </p>
                <p className="mt-1 text-xs italic text-slate-100 dark:text-slate-800">
                    &ldquo;{handler.objection}&rdquo;
                </p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                    You respond
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-100 dark:text-slate-800">
                    {handler.response}
                </p>
            </PopoverContent>
        </Popover>
    );
}

export function MarketSnapshot({
    summary,
    metrics,
}: {
    summary: MarketSummaryView;
    metrics?: Metric[] | null;
}) {
    const condition = conditionConfig[summary.marketCondition];
    const sourceDetails = getSnapshotSourceDetails(metrics ?? undefined);
    const referenceMonth = formatReferenceMonth(sourceDetails.referenceDate);
    const benchmarkPrice = getMetric(metrics, "gvr_mls_benchmark_price");
    const salesMetric = getMetric(metrics, "gvr_mls_sales");
    const newListingsMetric = getMetric(metrics, "gvr_new_listings");
    const activeListingsMetric = getMetric(metrics, "gvr_active_listings");
    const salesToActiveRatio = getMetric(metrics, "gvr_sales_to_active_ratio");
    const topMovers = getTopMovers(metrics, 2);
    const monthsInventory =
        typeof salesToActiveRatio?.value === "number" &&
        salesToActiveRatio.value > 0
            ? `${(100 / salesToActiveRatio.value).toFixed(1)} mo`
            : null;
    const conditionLabel = formatConditionLabel(summary.marketCondition);
    const ratioValue =
        typeof salesToActiveRatio?.value === "number"
            ? `${salesToActiveRatio.value.toFixed(1)}%`
            : null;
    const meterPosition = getSentimentMeterPosition(
        summary.marketCondition,
        salesToActiveRatio?.value,
    );
    const whyGuidance = resolveWhyThisGuidance({
        summary,
        conditionLabel,
        bocPolicyRate: getMetric(metrics, "boc_policy_rate") ?? undefined,
    });

    const confidence = summary.confidence;
    const whatChanged = summary.whatChanged?.trim();
    const whatChangedDirection = detectDirection(whatChanged);
    const sellerIntel = summary.actionableIntel?.seller?.trim() || null;
    const buyerIntel = summary.actionableIntel?.buyer?.trim() || null;
    const sellerObjection = summary.actionableIntel?.sellerObjection;
    const buyerObjection = summary.actionableIntel?.buyerObjection;

    return (
        <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr] lg:items-stretch">
            <Card className="flex h-full flex-col border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-50">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Sparkles className="size-5 text-cyan-600 dark:text-cyan-300" />
                                Market Sentiment
                            </CardTitle>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300/90">
                                {firstSentence(summary.summary)}
                            </p>
                        </div>
                        <Badge className={condition.className}>
                            {condition.label}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="flex h-full flex-col justify-center gap-4 pt-0">
                    <div className="space-y-2">
                        <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-red-500">
                            <div
                                className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-slate-300 bg-white shadow-[0_0_0_2px_rgba(148,163,184,0.2)] dark:border-white/80 dark:bg-slate-900 dark:shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
                                style={{
                                    left: `calc(${meterPosition}% - 7px)`,
                                }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300/80">
                            <span>Strong Buyers</span>
                            <span>Balanced</span>
                            <span>Strong Sellers</span>
                        </div>
                    </div>

                    <TooltipProvider delayDuration={250}>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <SnapshotStatCard
                                title="Benchmark Price"
                                value={benchmarkPrice?.formattedValue ?? "-"}
                                metric={benchmarkPrice}
                                description={
                                    metricDescriptions.gvr_mls_benchmark_price
                                }
                            />
                            <SnapshotStatCard
                                title="Monthly Sales"
                                value={salesMetric?.formattedValue ?? "-"}
                                metric={salesMetric}
                                description={metricDescriptions.gvr_mls_sales}
                                hint="Homes sold in the latest report month."
                            />
                            <SnapshotStatCard
                                title="Months Inventory"
                                value={monthsInventory ?? "-"}
                                metric={salesToActiveRatio}
                                description="Estimated months to clear current active inventory at the current sales pace (computed as 100 / sales-to-active ratio). Lower months means faster market velocity."
                                hint="At current pace, this is how long listings take to clear."
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <SnapshotStatCard
                                title="Sales-to-Active"
                                value={ratioValue ?? "-"}
                                metric={salesToActiveRatio}
                                description={
                                    metricDescriptions.gvr_sales_to_active_ratio
                                }
                                hint="<12% buyer-leaning · 12-20% balanced · >20% seller-leaning"
                            />
                            <SnapshotStatCard
                                title="Largest Change"
                                value={formatChange(topMovers[0]) ?? "-"}
                                metric={topMovers[0]}
                                description={
                                    topMovers[0]
                                        ? `${compactMetricLabel(topMovers[0].label)} had the largest month-over-month move in this snapshot.`
                                        : "No recent month-over-month change data available."
                                }
                                subtitle={
                                    topMovers[0]
                                        ? compactMetricLabel(topMovers[0].label)
                                        : "No mover available"
                                }
                            />
                            <SnapshotStatCard
                                title="Second Change"
                                value={formatChange(topMovers[1]) ?? "-"}
                                metric={topMovers[1]}
                                description={
                                    topMovers[1]
                                        ? `${compactMetricLabel(topMovers[1].label)} had the second largest monthly move in this snapshot.`
                                        : "No second mover available for this period."
                                }
                                subtitle={
                                    topMovers[1]
                                        ? compactMetricLabel(topMovers[1].label)
                                        : "No mover available"
                                }
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <SnapshotStatCard
                                title="New Listings"
                                value={newListingsMetric?.formattedValue ?? "-"}
                                metric={newListingsMetric}
                                description={metricDescriptions.gvr_new_listings}
                                hint="Fresh supply entering the market."
                            />
                            <SnapshotStatCard
                                title="Active Listings"
                                value={activeListingsMetric?.formattedValue ?? "-"}
                                metric={activeListingsMetric}
                                description={
                                    metricDescriptions.gvr_active_listings
                                }
                                hint="Total homes currently available."
                            />
                        </div>
                    </TooltipProvider>
                </CardContent>
            </Card>

            <Card className="flex h-full flex-col border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900 dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-50">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base font-semibold">
                            Actionable Intel
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant="outline"
                                className="border-slate-300 bg-white/80 text-slate-700 dark:border-white/20 dark:bg-white/5 dark:text-slate-200"
                            >
                                Realsy
                            </Badge>
                            {confidence ? (
                                <ConfidenceBadge confidence={confidence} />
                            ) : null}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-center gap-3 pt-0">
                    {whatChanged ? (
                        <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                            <DirectionIcon direction={whatChangedDirection} />
                            <div className="flex-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300/80">
                                    What changed
                                </p>
                                <p className="mt-0.5 text-xs italic leading-relaxed text-slate-700 dark:text-slate-200/90">
                                    {whatChanged}
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {sellerIntel ? (
                        <div className="space-y-2 rounded-md border border-slate-200 bg-white/80 px-3 py-3 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                To Your Seller
                            </p>
                            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                                {sellerIntel}
                            </p>
                            {sellerObjection ? (
                                <ObjectionPopover
                                    handler={sellerObjection}
                                />
                            ) : null}
                        </div>
                    ) : null}

                    {buyerIntel ? (
                        <div className="space-y-2 rounded-md border border-slate-200 bg-white/80 px-3 py-3 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                                To Your Buyer
                            </p>
                            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                                {buyerIntel}
                            </p>
                            {buyerObjection ? (
                                <ObjectionPopover
                                    handler={buyerObjection}
                                />
                            ) : null}
                        </div>
                    ) : null}

                    <Popover>
                        <PopoverTrigger className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 underline decoration-slate-400/60 underline-offset-2 transition hover:text-slate-900 hover:decoration-slate-700/70 dark:text-slate-300/90 dark:decoration-slate-500/50 dark:hover:text-slate-100 dark:hover:decoration-slate-300/60">
                            <Info className="size-3.5" />
                            Why this guidance
                        </PopoverTrigger>
                        <PopoverContent
                            side="left"
                            align="start"
                            sideOffset={8}
                            className="w-96 max-h-[70vh] overflow-y-auto border-slate-700 bg-slate-900 text-slate-100 shadow-xl [&>svg]:fill-slate-900 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:[&>svg]:fill-slate-100"
                        >
                            <div className="space-y-3 text-xs leading-relaxed">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                                        Rationale
                                    </p>
                                    <p className="mt-1 text-slate-100 dark:text-slate-800">
                                        {whyGuidance.rationale}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                                        Rate Impact
                                    </p>
                                    <p className="mt-1 text-slate-100 dark:text-slate-800">
                                        {whyGuidance.rateImpact}
                                    </p>
                                </div>
                                {whyGuidance.rateTranslation ? (
                                    <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200 dark:text-cyan-700">
                                            Rate Translation
                                        </p>
                                        <p className="mt-1 text-cyan-50 dark:text-cyan-900">
                                            {whyGuidance.rateTranslation}
                                        </p>
                                    </div>
                                ) : null}
                                {whyGuidance.evidence.length > 0 ? (
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                                            Evidence
                                        </p>
                                        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-100 dark:text-slate-800">
                                            {whyGuidance.evidence.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300/80">
                        Realsy summary &middot; Source:{" "}
                        {sourceDetails.sourceLabel}
                        {referenceMonth
                            ? ` · Reference month: ${referenceMonth}`
                            : ""}
                        {" · "}
                        Updated {formatTimeAgo(summary.generatedAt)}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

export function MarketSnapshotSkeleton() {
    return (
        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-5 w-28" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                    <Skeleton className="h-2.5 w-full rounded-full" />
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Skeleton className="h-16 w-full rounded-md" />
                        <Skeleton className="h-16 w-full rounded-md" />
                        <Skeleton className="h-16 w-full rounded-md" />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-24 w-full rounded-md" />
                    <Skeleton className="h-24 w-full rounded-md" />
                    <Skeleton className="h-8 w-full rounded-md" />
                    <Skeleton className="h-3 w-3/4" />
                </CardContent>
            </Card>
        </div>
    );
}
