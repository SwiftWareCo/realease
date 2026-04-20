"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createElement } from "react";
import {
    deriveTier,
    formatOrigin,
    getOriginIcon,
    getTierColor,
    parseMarket,
} from "./leads-ui";

function OriginIconSlot({ source }: { source: string | undefined }) {
    return createElement(getOriginIcon(source), {
        className: "h-3.5 w-3.5 text-muted-foreground",
    });
}

interface LeadsEngineRowProps {
    lead: Doc<"leads">;
    onClick: () => void;
}

const intentConfig = {
    buyer: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    seller: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    investor: "border-violet-500/30 bg-violet-500/10 text-violet-200",
} as const;

const statusConfig = {
    new: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    contacted: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    qualified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
} as const;

const labelize = (value: string) =>
    value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

const formatCreatedAt = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

export function LeadsEngineRow({ lead, onClick }: LeadsEngineRowProps) {
    const tier = deriveTier(lead);
    const tierColor = getTierColor(tier);
    const score = Math.max(0, Math.min(100, lead.urgency_score ?? 0));
    const market = parseMarket(lead);
    const origin = formatOrigin(lead.source);
    const initial = (lead.name?.trim()?.[0] ?? "?").toUpperCase();
    const tags = lead.tags ?? [];

    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] px-4 py-4 text-left transition-all hover:border-orange-500/40 hover:bg-card"
        >
            <div
                className={cn(
                    "absolute left-0 top-0 h-full w-1 rounded-full",
                    tierColor.accent,
                )}
                aria-hidden
            />

            <div className="space-y-3 pl-3 lg:hidden">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div
                            className={cn(
                                "flex h-10 w-10 flex-none items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground ring-1 ring-border",
                                tierColor.glow,
                            )}
                        >
                            {initial}
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">
                                {lead.name}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[10px]",
                                        intentConfig[lead.intent],
                                    )}
                                >
                                    {labelize(lead.intent)}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[10px]",
                                        statusConfig[lead.status],
                                    )}
                                >
                                    {labelize(lead.status)}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                            AI Score
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                            {score}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                            Source
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-foreground/90">
                            <OriginIconSlot source={lead.source} />
                            <span className="truncate">{origin}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                            Date Added
                        </div>
                        <div className="mt-1 text-foreground/90">
                            {formatCreatedAt(lead.created_at ?? lead._creationTime)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                            Market
                        </div>
                        <div className="mt-1 truncate text-foreground/90">
                            {market}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                            Tier
                        </div>
                        <div className="mt-1">
                            <span
                                className={cn(
                                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                                    tierColor.badgeBg,
                                    tierColor.badgeText,
                                    tierColor.badgeBorder,
                                )}
                            >
                                {tier}
                            </span>
                        </div>
                    </div>
                </div>

                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {tags.slice(0, 3).map((tag) => (
                            <Badge
                                key={tag}
                                variant="secondary"
                                className="bg-muted/70 text-[10px]"
                            >
                                {tag}
                            </Badge>
                        ))}
                        {tags.length > 3 && (
                            <Badge
                                variant="secondary"
                                className="bg-muted/70 text-[10px]"
                            >
                                +{tags.length - 3}
                            </Badge>
                        )}
                    </div>
                )}
            </div>

        </button>
    );
}
