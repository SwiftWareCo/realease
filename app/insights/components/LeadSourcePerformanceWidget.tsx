'use client';

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Crown, Users, TrendingUp, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadSource {
    source: string;
    volume: number;
    conversion: number;
    avgDaysToClose: number;
    revenue: number;
}

const leadSources: LeadSource[] = [
    { source: "Referral", volume: 67, conversion: 41.8, avgDaysToClose: 28, revenue: 125000 },
    { source: "Website", volume: 145, conversion: 26.2, avgDaysToClose: 45, revenue: 89000 },
    { source: "Open House", volume: 34, conversion: 35.3, avgDaysToClose: 32, revenue: 68000 },
    { source: "Social Media", volume: 52, conversion: 21.2, avgDaysToClose: 52, revenue: 42000 },
    { source: "Zillow", volume: 89, conversion: 16.9, avgDaysToClose: 58, revenue: 35000 },
];

type Category = 'volume' | 'conversion' | 'avgDaysToClose' | 'revenue';

const categoryConfig: Record<Category, { label: string; icon: typeof Users; color: string; bgColor: string }> = {
    volume: { label: "Most Leads", icon: Users, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    conversion: { label: "Best Conversion", icon: TrendingUp, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    avgDaysToClose: { label: "Fastest Close", icon: Clock, color: "text-violet-500", bgColor: "bg-violet-500/10" },
    revenue: { label: "Top Revenue", icon: DollarSign, color: "text-amber-500", bgColor: "bg-amber-500/10" },
};

export function LeadSourcePerformanceWidget() {
    const winners = useMemo(() => {
        return {
            volume: leadSources.reduce((a, b) => a.volume > b.volume ? a : b),
            conversion: leadSources.reduce((a, b) => a.conversion > b.conversion ? a : b),
            avgDaysToClose: leadSources.reduce((a, b) => a.avgDaysToClose < b.avgDaysToClose ? a : b),
            revenue: leadSources.reduce((a, b) => a.revenue > b.revenue ? a : b),
        };
    }, []);

    const isWinner = (source: LeadSource, category: Category) => {
        if (category === 'avgDaysToClose') {
            return source.avgDaysToClose === winners.avgDaysToClose.avgDaysToClose;
        }
        return source[category] === winners[category][category];
    };

    const totalLeads = leadSources.reduce((sum, s) => sum + s.volume, 0);
    const totalRevenue = leadSources.reduce((sum, s) => sum + s.revenue, 0);

    return (
        <Card className="h-full flex flex-col py-3">
            <CardContent className="flex-1 flex flex-col px-4 py-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <BarChart3 className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Lead Source Performance</h3>
                    <span className="text-sm text-muted-foreground ml-1">Compare performance across channels</span>
                </div>

                {/* Crown Winners Row */}
                <div className="grid grid-cols-4 gap-3 mt-2">
                    {(Object.keys(categoryConfig) as Category[]).map((cat) => {
                        const config = categoryConfig[cat];
                        const winner = winners[cat];
                        const Icon = config.icon;
                        return (
                            <div key={cat} className={cn("rounded-xl p-3 text-center border", config.bgColor)}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                    <Crown className={cn("size-4", config.color)} />
                                    <Icon className={cn("size-4", config.color)} />
                                </div>
                                <div className="text-sm font-bold">{winner.source}</div>
                                <div className="text-xs text-muted-foreground">{config.label}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Sources Table - flex-1 to fill remaining space */}
                <div className="flex-1 rounded-lg border mt-2 overflow-hidden">
                    <table className="w-full text-sm h-full">
                        <thead className="bg-muted/50">
                            <tr className="border-b">
                                <th className="text-left py-2.5 px-3 font-medium">Source</th>
                                <th className="text-center py-2.5 px-3 font-medium">Volume</th>
                                <th className="text-center py-2.5 px-3 font-medium">Conv %</th>
                                <th className="text-center py-2.5 px-3 font-medium">Days to Close</th>
                                <th className="text-right py-2.5 px-3 font-medium">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leadSources.map((source, idx) => (
                                <tr key={source.source} className={cn("border-b border-border/50 last:border-0", idx % 2 === 0 && "bg-muted/20")}>
                                    <td className="py-2.5 px-3 font-medium">{source.source}</td>
                                    <td className={cn("text-center py-2.5 px-3", isWinner(source, 'volume') && "font-bold text-blue-500")}>
                                        <div className="flex items-center justify-center gap-1">
                                            {source.volume}
                                            {isWinner(source, 'volume') && <Crown className="size-3 text-blue-500" />}
                                        </div>
                                    </td>
                                    <td className={cn("text-center py-2.5 px-3", isWinner(source, 'conversion') && "font-bold text-emerald-500")}>
                                        <div className="flex items-center justify-center gap-1">
                                            {source.conversion}%
                                            {isWinner(source, 'conversion') && <Crown className="size-3 text-emerald-500" />}
                                        </div>
                                    </td>
                                    <td className={cn("text-center py-2.5 px-3", isWinner(source, 'avgDaysToClose') && "font-bold text-violet-500")}>
                                        <div className="flex items-center justify-center gap-1">
                                            {source.avgDaysToClose}d
                                            {isWinner(source, 'avgDaysToClose') && <Crown className="size-3 text-violet-500" />}
                                        </div>
                                    </td>
                                    <td className={cn("text-right py-2.5 px-3", isWinner(source, 'revenue') && "font-bold text-amber-500")}>
                                        <div className="flex items-center justify-end gap-1">
                                            ${(source.revenue / 1000).toFixed(0)}k
                                            {isWinner(source, 'revenue') && <Crown className="size-3 text-amber-500" />}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary Footer */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t text-sm text-muted-foreground">
                    <span><strong className="text-foreground">{totalLeads}</strong> total leads across all sources</span>
                    <span><strong className="text-foreground">${(totalRevenue / 1000).toFixed(0)}k</strong> total revenue</span>
                </div>
            </CardContent>
        </Card>
    );
}
