"use client";

import type { Doc } from "@/convex/_generated/dataModel";
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

const intentLabel = (intent: string) => {
    switch (intent) {
        case "buyer":
            return "Buyer";
        case "seller":
            return "Seller";
        case "investor":
            return "Investor";
        default:
            return intent;
    }
};

export function LeadsEngineRow({ lead, onClick }: LeadsEngineRowProps) {
    const tier = deriveTier(lead);
    const tierColor = getTierColor(tier);
    const score = Math.max(0, Math.min(100, lead.urgency_score ?? 0));
    const market = parseMarket(lead);
    const origin = formatOrigin(lead.source);
    const initial = (lead.name?.trim()?.[0] ?? "?").toUpperCase();

    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative w-full overflow-hidden rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-left transition-all hover:border-border hover:bg-card"
        >
            {/* Left accent border */}
            <div
                className={`absolute left-0 top-0 h-full w-1 ${tierColor.accent}`}
                aria-hidden
            />

            <div className="grid grid-cols-12 items-center gap-3 pl-3">
                {/* Identity */}
                <div className="col-span-12 sm:col-span-3 flex items-center gap-3 min-w-0">
                    <div
                        className={`flex h-10 w-10 flex-none items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground ring-1 ring-border ${tierColor.glow}`}
                    >
                        {initial}
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                            {lead.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                            {intentLabel(lead.intent)}
                        </div>
                    </div>
                </div>

                {/* Market */}
                <div className="col-span-6 sm:col-span-2 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:hidden">
                        Market
                    </div>
                    <div className="truncate text-sm text-foreground/90">
                        {market}
                    </div>
                </div>

                {/* AI Propensity */}
                <div className="col-span-6 sm:col-span-3 min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                            AI Propensity
                        </span>
                        <span className="text-[11px] font-semibold text-foreground">
                            {score}%
                        </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className={`h-full rounded-full ${tierColor.bar} transition-all`}
                            style={{ width: `${score}%` }}
                        />
                    </div>
                </div>

                {/* Tier badge */}
                <div className="col-span-6 sm:col-span-2 flex sm:justify-center">
                    <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tierColor.badgeBg} ${tierColor.badgeText} ${tierColor.badgeBorder}`}
                    >
                        {tier}
                    </span>
                </div>

                {/* Origin */}
                <div className="col-span-6 sm:col-span-2 flex items-center justify-end gap-2 min-w-0">
                    <OriginIconSlot source={lead.source} />
                    <span className="truncate text-xs text-muted-foreground">
                        {origin}
                    </span>
                </div>
            </div>
        </button>
    );
}
