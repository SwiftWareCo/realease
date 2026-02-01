'use client';

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge, DollarSign, Calendar, Home, ArrowUp, ArrowDown } from "lucide-react";

export function MarketMomentumIndex() {
    const momentumScore = 7.5;
    const isSellersMarket = momentumScore > 5;

    return (
        <Card className="flex h-full flex-col p-0 overflow-hidden">
            {/* Header with breathing room */}
            <div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
                <Gauge className="size-5 text-primary" />
                <span className="text-base font-semibold">Market Momentum</span>
            </div>

            {/* Top: Score Circle with Badge */}
            <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2 min-h-0">
                <Badge variant={isSellersMarket ? "default" : "secondary"} className="text-xs px-3 h-6 shrink-0">
                    {isSellersMarket ? "Seller's Market" : "Buyer's Market"}
                </Badge>
                <div className="flex w-28 h-28 shrink-0 items-center justify-center rounded-full border-[10px] border-muted border-t-primary bg-muted/10 shadow-sm">
                    <div className="flex flex-col items-center">
                        <span className="text-4xl font-bold tracking-tighter leading-none">{momentumScore}</span>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Score</span>
                    </div>
                </div>
            </div>

            {/* Bottom: 3 Metric Cards - horizontal content inside rectangles */}
            <div className="grid grid-cols-3 gap-1.5 border-t px-2 py-2 shrink-0">
                {/* Median Price */}
                <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 px-2 py-2">
                    <div className="rounded bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-900/20 shrink-0">
                        <DollarSign className="size-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight truncate">$485k</span>
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground truncate">Median</span>
                            <span className="flex items-center text-[9px] text-emerald-600 shrink-0">
                                <ArrowUp className="size-2" />3%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Days on Market */}
                <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 px-2 py-2">
                    <div className="rounded bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-900/20 shrink-0">
                        <Calendar className="size-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight truncate">28 Days</span>
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground truncate">DOM</span>
                            <span className="flex items-center text-[9px] text-emerald-600 shrink-0">
                                <ArrowDown className="size-2" />-5
                            </span>
                        </div>
                    </div>
                </div>

                {/* Total Listings */}
                <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 px-2 py-2">
                    <div className="rounded bg-purple-100 p-1.5 text-purple-600 dark:bg-purple-900/20 shrink-0">
                        <Home className="size-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight truncate">1,847</span>
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground truncate">Listings</span>
                            <span className="flex items-center text-[9px] text-red-500 shrink-0">
                                <ArrowDown className="size-2" />-12%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
