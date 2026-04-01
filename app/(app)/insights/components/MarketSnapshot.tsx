"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

type MarketSummary = Doc<"marketSummaries">;
type Metric = Doc<"marketMetrics">;
type MarketSummaryView = MarketSummary & {
    focusTopics?: string[];
    focusMetrics?: string;
    regionalHighlights?: string[];
};

const GVR_MVP_METRIC_KEYS = new Set([
    "gvr_mls_benchmark_price",
    "gvr_mls_sales",
    "gvr_new_listings",
    "gvr_active_listings",
    "gvr_sales_to_active_ratio",
]);

const TRUNCATE_LENGTH = 280;

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

function formatTimeAgo(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

function truncateAtBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Try to cut at a sentence boundary within the range
    const sentenceEnd = text.lastIndexOf(". ", maxLength);
    if (sentenceEnd > maxLength * 0.6) {
        return text.slice(0, sentenceEnd + 1);
    }

    // Fall back to word boundary
    const wordEnd = text.lastIndexOf(" ", maxLength);
    if (wordEnd > maxLength * 0.6) {
        return text.slice(0, wordEnd) + "…";
    }

    return text.slice(0, maxLength) + "…";
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

export function MarketSnapshot({
    summary,
    metrics,
}: {
    summary: MarketSummaryView;
    metrics?: Metric[] | null;
}) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const condition = conditionConfig[summary.marketCondition];
    const isTruncated = summary.summary.length > TRUNCATE_LENGTH;
    const displayText = isTruncated
        ? truncateAtBoundary(summary.summary, TRUNCATE_LENGTH)
        : summary.summary;
    const sourceDetails = getSnapshotSourceDetails(metrics ?? undefined);
    const referenceMonth = formatReferenceMonth(sourceDetails.referenceDate);

    return (
        <>
            <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Sparkles
                                className="size-5 text-primary"
                                aria-hidden="true"
                            />
                            Market Snapshot
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {referenceMonth && (
                                <Badge
                                    variant="outline"
                                    className="text-xs font-normal"
                                >
                                    Ref {referenceMonth}
                                </Badge>
                            )}
                            <Badge className={condition.className}>
                                {condition.label}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                    <p className="text-sm text-foreground leading-relaxed">
                        {displayText}
                        {isTruncated && (
                            <>
                                {" "}
                                <button
                                    onClick={() => setDialogOpen(true)}
                                    className="text-primary hover:text-primary/80 font-medium inline cursor-pointer"
                                >
                                    Read more
                                </button>
                            </>
                        )}
                    </p>
                    {(summary.focusTopics?.length || summary.focusMetrics) && (
                        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                                Focus
                            </p>
                            {summary.focusTopics?.length ? (
                                <p className="text-sm text-foreground mt-1">
                                    {summary.focusTopics.join(", ")}
                                </p>
                            ) : null}
                            {summary.focusMetrics ? (
                                <p className="text-sm text-muted-foreground mt-1">
                                    {summary.focusMetrics}
                                </p>
                            ) : null}
                        </div>
                    )}
                    {summary.regionalHighlights &&
                        summary.regionalHighlights.length > 0 && (
                            <div className="rounded-md border px-3 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Regional Highlights
                                </p>
                                <p className="text-sm text-foreground mt-1">
                                    {summary.regionalHighlights.join(" • ")}
                                </p>
                            </div>
                        )}
                    {summary.keyDrivers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {summary.keyDrivers.map((driver) => (
                                <Badge
                                    key={driver}
                                    variant="outline"
                                    className="text-xs font-normal"
                                >
                                    {driver}
                                </Badge>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground pt-1">
                        AI-generated summary &middot; Source:{" "}
                        {sourceDetails.sourceLabel}
                        {referenceMonth
                            ? ` · Reference month: ${referenceMonth}`
                            : ""}
                        {" · "}
                        Updated {formatTimeAgo(summary.generatedAt)}
                    </p>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles
                                className="size-5 text-primary"
                                aria-hidden="true"
                            />
                            Market Snapshot
                            <Badge className={condition.className}>
                                {condition.label}
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                        <p className="text-sm text-foreground leading-relaxed">
                            {summary.summary}
                        </p>
                        {(summary.focusTopics?.length ||
                            summary.focusMetrics) && (
                            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                                    Focus
                                </p>
                                {summary.focusTopics?.length ? (
                                    <p className="text-sm text-foreground mt-1">
                                        {summary.focusTopics.join(", ")}
                                    </p>
                                ) : null}
                                {summary.focusMetrics ? (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {summary.focusMetrics}
                                    </p>
                                ) : null}
                            </div>
                        )}
                        {summary.regionalHighlights &&
                            summary.regionalHighlights.length > 0 && (
                                <div className="rounded-md border px-3 py-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Regional Highlights
                                    </p>
                                    <p className="text-sm text-foreground mt-1">
                                        {summary.regionalHighlights.join(" • ")}
                                    </p>
                                </div>
                            )}
                        {summary.keyDrivers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {summary.keyDrivers.map((driver) => (
                                    <Badge
                                        key={driver}
                                        variant="outline"
                                        className="text-xs font-normal"
                                    >
                                        {driver}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            AI-generated summary &middot; Source:{" "}
                            {sourceDetails.sourceLabel}
                            {referenceMonth
                                ? ` · Reference month: ${referenceMonth}`
                                : ""}
                            {" · "}
                            Updated {formatTimeAgo(summary.generatedAt)}
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function MarketSnapshotSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-28" />
                </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-28" />
                </div>
            </CardContent>
        </Card>
    );
}
