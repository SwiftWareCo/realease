'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge, TrendingUp, TrendingDown, Clock, Activity, ArrowDown } from "lucide-react";

export function MarketMomentumIndex() {
    // Dummy data - ideally this would come from a prop or API
    const momentumScore = 7.5; // 1-10, >5 Seller's Market, <5 Buyer's Market
    const isSellersMarket = momentumScore > 5;

    return (
        <Card className="col-span-full h-full flex flex-col">
            <CardHeader className="pb-2 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Gauge className="size-5 text-primary" />
                        <CardTitle>Market Momentum Index</CardTitle>
                    </div>
                    <span className="text-xs text-muted-foreground">Updated today</span>
                </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pb-4">
                <div className="flex h-full items-center gap-8">
                    {/* Main Gauge - Compact */}
                    <div className="flex shrink-0 flex-col items-center justify-center pl-4">
                        <div className="relative flex aspect-square w-32 items-center justify-center rounded-full border-[8px] border-muted border-t-primary shadow-lg">
                            <div className="flex flex-col items-center">
                                <span className="text-3xl font-bold tracking-tighter">{momentumScore}</span>
                            </div>
                            <Badge variant={isSellersMarket ? "default" : "secondary"} className="absolute -bottom-3 text-[10px] px-2 h-5">
                                {isSellersMarket ? "Seller's Market" : "Buyer's Market"}
                            </Badge>
                        </div>
                        <p className="mt-5 text-xs font-semibold text-muted-foreground">Top 15% Activity</p>
                    </div>

                    {/* Metrics - Compact Horizontal List */}
                    <div className="flex flex-1 items-center justify-between gap-4 pr-4">
                        {/* Metric 1 */}
                        <div className="flex flex-1 flex-col justify-center rounded-lg border bg-muted/10 p-3">
                            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                                <TrendingUp className="size-4 text-green-600" />
                                <span className="text-xs font-medium uppercase tracking-wider">Speed</span>
                            </div>
                            <div className="text-2xl font-bold">14 Days</div>
                            <div className="flex items-center gap-1 text-[10px] text-green-600">
                                <ArrowDown className="size-3" />
                                12% vs avg
                            </div>
                        </div>

                        {/* Metric 2 */}
                        <div className="flex flex-1 flex-col justify-center rounded-lg border bg-muted/10 p-3">
                            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                                <Activity className="size-4 text-blue-600" />
                                <span className="text-xs font-medium uppercase tracking-wider">Absorption</span>
                            </div>
                            <div className="text-2xl font-bold">2.4 Mo</div>
                            <div className="flex items-center gap-1 text-[10px] text-blue-600">
                                High Demand
                            </div>
                        </div>

                        {/* Metric 3 */}
                        <div className="flex flex-1 flex-col justify-center rounded-lg border bg-muted/10 p-3">
                            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                                <Clock className="size-4 text-orange-600" />
                                <span className="text-xs font-medium uppercase tracking-wider">Pricing</span>
                            </div>
                            <div className="text-2xl font-bold">+3.2%</div>
                            <div className="flex items-center gap-1 text-[10px] text-green-600">
                                <TrendingUp className="size-3" />
                                Power Rising
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
