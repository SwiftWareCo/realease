'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Minus, Trophy, Crown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// Interface for lead source ROI data
export interface LeadSourceROI {
    source: string;
    totalLeads: number;
    qualifiedLeads: number;
    activeLeads: number;
    conversionRate: number;
    trend: 'up' | 'down' | 'stable';
    highestCommission?: number;
    avgCommission?: number;
}

// Mock data based on typical lead sources
const mockROIData: LeadSourceROI[] = [
    {
        source: 'Referral',
        totalLeads: 67,
        qualifiedLeads: 28,
        activeLeads: 15,
        conversionRate: 41.8,
        trend: 'up',
        highestCommission: 24500,
        avgCommission: 8200,
    },
    {
        source: 'Website',
        totalLeads: 145,
        qualifiedLeads: 38,
        activeLeads: 24,
        conversionRate: 26.2,
        trend: 'up',
        highestCommission: 18000,
        avgCommission: 6100,
    },
    {
        source: 'Open House',
        totalLeads: 34,
        qualifiedLeads: 12,
        activeLeads: 9,
        conversionRate: 35.3,
        trend: 'stable',
        highestCommission: 15000,
        avgCommission: 7500,
    },
    {
        source: 'Social Media',
        totalLeads: 52,
        qualifiedLeads: 11,
        activeLeads: 5,
        conversionRate: 21.2,
        trend: 'up',
        highestCommission: 12000,
        avgCommission: 4800,
    },
    {
        source: 'Zillow',
        totalLeads: 89,
        qualifiedLeads: 15,
        activeLeads: 8,
        conversionRate: 16.9,
        trend: 'down',
        highestCommission: 9500,
        avgCommission: 3200,
    },
];

const chartColors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
];

interface LeadSourceROICardProps {
    data?: LeadSourceROI[];
    isLoading?: boolean;
}

export function LeadSourceROICard({
    data = mockROIData,
    isLoading = false,
}: LeadSourceROICardProps) {
    const chartData = useMemo(() => {
        return data
            .map((item) => ({
                name: item.source,
                rate: item.conversionRate,
                leads: item.totalLeads,
            }))
            .sort((a, b) => b.rate - a.rate);
    }, [data]);

    const topPerformer = useMemo(() => {
        return data.reduce((prev, current) =>
            prev.conversionRate > current.conversionRate ? prev : current
        );
    }, [data]);

    const highestSingleCommission = useMemo(() => {
        return data.reduce((prev, current) =>
            (prev.highestCommission || 0) > (current.highestCommission || 0) ? prev : current
        );
    }, [data]);

    const mostVolume = useMemo(() => {
        return data.reduce((prev, current) =>
            prev.totalLeads > current.totalLeads ? prev : current
        );
    }, [data]);

    if (isLoading) {
        return <LeadSourceROICardSkeleton />;
    }

    if (data.length === 0) {
        return <LeadSourceROICardEmpty />;
    }

    return (
        <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            {/* Decorative gradient border */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500/20 via-transparent to-chart-1/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-[1px] rounded-xl bg-card" />

            <CardContent className="relative p-0">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                                <DollarSign className="size-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold tracking-tight">Lead Source ROI</h3>
                                <p className="text-xs text-muted-foreground">Conversion by source</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-5">
                    {/* Key insights summary */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 p-3 text-center">
                            <Crown className="mx-auto size-4 text-amber-500" />
                            <p className="mt-1 text-sm font-bold text-foreground">{topPerformer.source}</p>
                            <p className="text-[10px] text-muted-foreground">Best Converter</p>
                        </div>
                        <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 p-3 text-center">
                            <Trophy className="mx-auto size-4 text-emerald-500" />
                            <p className="mt-1 text-sm font-bold text-foreground">
                                ${((highestSingleCommission.highestCommission || 0) / 1000).toFixed(1)}k
                            </p>
                            <p className="text-[10px] text-muted-foreground">Top Commission</p>
                        </div>
                        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-3 text-center">
                            <Star className="mx-auto size-4 text-blue-500" />
                            <p className="mt-1 text-sm font-bold text-foreground">{mostVolume.source}</p>
                            <p className="text-[10px] text-muted-foreground">Most Leads</p>
                        </div>
                    </div>

                    {/* Chart with clear label */}
                    <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Conversion Rate by Source (% of leads that convert to qualified)
                        </p>
                        <div className="h-[130px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chartData}
                                    layout="vertical"
                                    margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                                >
                                    <XAxis
                                        type="number"
                                        domain={[0, 50]}
                                        tickFormatter={(value) => `${value}%`}
                                        tick={{ fontSize: 10 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={70}
                                        tick={{ fontSize: 10 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                                                        <p className="font-semibold">{d.name}</p>
                                                        <p className="text-muted-foreground">
                                                            {d.rate.toFixed(1)}% conversion rate
                                                        </p>
                                                        <p className="text-muted-foreground">
                                                            {d.leads} total leads
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={18}>
                                        {chartData.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={chartColors[index % chartColors.length]}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Detail stats row */}
                    <div className="grid grid-cols-5 gap-1 border-t pt-3">
                        {data.slice(0, 5).map((item) => (
                            <div key={item.source} className="text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                    <span className="text-xs font-bold tabular-nums">
                                        {item.conversionRate.toFixed(0)}%
                                    </span>
                                    <TrendIcon trend={item.trend} />
                                </div>
                                <p className="truncate text-[9px] text-muted-foreground">
                                    {item.source}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
    if (trend === 'up') {
        return <TrendingUp className="size-3 text-emerald-500" />;
    }
    if (trend === 'down') {
        return <TrendingDown className="size-3 text-red-500" />;
    }
    return <Minus className="size-3 text-muted-foreground" />;
}

function LeadSourceROICardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <div className="bg-muted/30 p-5">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-xl" />
                    <div>
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="mt-1 h-3 w-24" />
                    </div>
                </div>
            </div>
            <div className="p-5 space-y-5">
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-[130px] w-full" />
            </div>
        </Card>
    );
}

function LeadSourceROICardEmpty() {
    return (
        <Card className="flex flex-col items-center justify-center py-16 text-center bg-gradient-to-br from-card to-muted/20">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                <DollarSign className="size-8 text-muted-foreground/50" />
            </div>
            <p className="mt-4 font-medium text-muted-foreground">
                No lead source data
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
                Add leads with source tags to track ROI
            </p>
        </Card>
    );
}
