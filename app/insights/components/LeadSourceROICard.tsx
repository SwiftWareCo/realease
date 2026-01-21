'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Interface for lead source ROI data
export interface LeadSourceROI {
    source: string;
    totalLeads: number;
    qualifiedLeads: number;
    activeLeads: number;
    conversionRate: number;
    trend: 'up' | 'down' | 'stable';
}

// Mock data based on typical lead sources
const mockROIData: LeadSourceROI[] = [
    {
        source: 'Website',
        totalLeads: 145,
        qualifiedLeads: 38,
        activeLeads: 24,
        conversionRate: 26.2,
        trend: 'up',
    },
    {
        source: 'Referral',
        totalLeads: 67,
        qualifiedLeads: 28,
        activeLeads: 15,
        conversionRate: 41.8,
        trend: 'up',
    },
    {
        source: 'Zillow',
        totalLeads: 89,
        qualifiedLeads: 15,
        activeLeads: 8,
        conversionRate: 16.9,
        trend: 'down',
    },
    {
        source: 'Open House',
        totalLeads: 34,
        qualifiedLeads: 12,
        activeLeads: 9,
        conversionRate: 35.3,
        trend: 'stable',
    },
    {
        source: 'Social Media',
        totalLeads: 52,
        qualifiedLeads: 11,
        activeLeads: 5,
        conversionRate: 21.2,
        trend: 'up',
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

    if (isLoading) {
        return <LeadSourceROICardSkeleton />;
    }

    if (data.length === 0) {
        return <LeadSourceROICardEmpty />;
    }

    return (
        <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-chart-3 via-chart-1 to-chart-2 opacity-0 transition-opacity group-hover:opacity-100" />
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <DollarSign className="size-4 text-muted-foreground" />
                        Lead Source ROI
                    </CardTitle>
                    <Badge
                        variant="outline"
                        className="border-chart-2/30 bg-chart-2/10 text-xs font-normal text-chart-2"
                    >
                        Top: {topPerformer.source}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Chart */}
                <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
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
                                        const data = payload[0].payload;
                                        return (
                                            <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                                                <p className="font-medium">{data.name}</p>
                                                <p className="text-muted-foreground">
                                                    Conversion: {data.rate.toFixed(1)}%
                                                </p>
                                                <p className="text-muted-foreground">
                                                    Total leads: {data.leads}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={20}>
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

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 border-t pt-3">
                    {data.slice(0, 3).map((item) => (
                        <div key={item.source} className="text-center">
                            <div className="flex items-center justify-center gap-1">
                                <span className="text-sm font-semibold tabular-nums">
                                    {item.conversionRate.toFixed(1)}%
                                </span>
                                <TrendIcon trend={item.trend} />
                            </div>
                            <p className="truncate text-[10px] text-muted-foreground">
                                {item.source}
                            </p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
    if (trend === 'up') {
        return <TrendingUp className="size-3 text-green-500" />;
    }
    if (trend === 'down') {
        return <TrendingDown className="size-3 text-red-500" />;
    }
    return <Minus className="size-3 text-muted-foreground" />;
}

function LeadSourceROICardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-24" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-[140px] w-full" />
                <div className="grid grid-cols-3 gap-2 border-t pt-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="text-center">
                            <Skeleton className="mx-auto h-5 w-12" />
                            <Skeleton className="mx-auto mt-1 h-3 w-16" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function LeadSourceROICardEmpty() {
    return (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="mb-4 size-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
                No lead source data
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
                Add leads with source tags to see ROI metrics
            </p>
        </Card>
    );
}
