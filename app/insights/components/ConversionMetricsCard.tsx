'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    Tooltip,
    XAxis,
} from 'recharts';
import {
    ArrowUpRight,
    ArrowDownRight,
    Users,
    Target,
    Clock,
    TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Interface for conversion metrics
export interface ConversionMetrics {
    totalLeads: number;
    newLeads: number;
    contactedLeads: number;
    qualifiedLeads: number;
    conversionRate: number;
    previousConversionRate: number;
    avgTimeToContact: number; // hours
    avgTimeToQualify: number; // days
    weeklyTrend: { week: string; rate: number }[];
}

// Mock data for UI demonstration
const mockMetrics: ConversionMetrics = {
    totalLeads: 387,
    newLeads: 124,
    contactedLeads: 168,
    qualifiedLeads: 95,
    conversionRate: 24.5,
    previousConversionRate: 21.2,
    avgTimeToContact: 4.2,
    avgTimeToQualify: 12.5,
    weeklyTrend: [
        { week: 'W1', rate: 18 },
        { week: 'W2', rate: 22 },
        { week: 'W3', rate: 20 },
        { week: 'W4', rate: 25 },
        { week: 'W5', rate: 28 },
        { week: 'W6', rate: 24 },
    ],
};

interface ConversionMetricsCardProps {
    metrics?: ConversionMetrics;
    isLoading?: boolean;
}

export function ConversionMetricsCard({
    metrics = mockMetrics,
    isLoading = false,
}: ConversionMetricsCardProps) {
    const rateChange = useMemo(() => {
        return metrics.conversionRate - metrics.previousConversionRate;
    }, [metrics.conversionRate, metrics.previousConversionRate]);

    const isPositive = rateChange >= 0;

    if (isLoading) {
        return <ConversionMetricsCardSkeleton />;
    }

    return (
        <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-chart-1 via-chart-4 to-chart-5 opacity-0 transition-opacity group-hover:opacity-100" />
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Target className="size-4 text-muted-foreground" />
                        Conversion Metrics
                    </CardTitle>
                    <Badge
                        variant="outline"
                        className={cn(
                            'text-xs font-normal',
                            isPositive
                                ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
                                : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
                        )}
                    >
                        {isPositive ? '+' : ''}
                        {rateChange.toFixed(1)}% vs prev
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Main conversion rate */}
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-3xl font-bold tabular-nums tracking-tight">
                            {metrics.conversionRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Overall conversion rate
                        </p>
                    </div>
                    <div
                        className={cn(
                            'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                            isPositive
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        )}
                    >
                        {isPositive ? (
                            <ArrowUpRight className="size-3" />
                        ) : (
                            <ArrowDownRight className="size-3" />
                        )}
                        {Math.abs(rateChange).toFixed(1)}%
                    </div>
                </div>

                {/* Sparkline */}
                <div className="h-12">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metrics.weeklyTrend}>
                            <defs>
                                <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="rounded-lg border bg-popover px-2 py-1 text-xs shadow-md">
                                                <span className="font-medium">{payload[0].value}%</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="rate"
                                stroke="hsl(var(--chart-1))"
                                strokeWidth={2}
                                fill="url(#conversionGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Funnel visualization */}
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                        Lead Funnel
                    </p>
                    <div className="flex items-center gap-1">
                        <FunnelStep
                            label="New"
                            count={metrics.newLeads}
                            percentage={100}
                            color="bg-chart-3"
                        />
                        <span className="text-muted-foreground/50">→</span>
                        <FunnelStep
                            label="Contacted"
                            count={metrics.contactedLeads}
                            percentage={(metrics.contactedLeads / metrics.newLeads) * 100}
                            color="bg-chart-2"
                        />
                        <span className="text-muted-foreground/50">→</span>
                        <FunnelStep
                            label="Qualified"
                            count={metrics.qualifiedLeads}
                            percentage={(metrics.qualifiedLeads / metrics.newLeads) * 100}
                            color="bg-chart-1"
                        />
                    </div>
                </div>

                {/* Quick metrics */}
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                    <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                            <Clock className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold tabular-nums">
                                {metrics.avgTimeToContact.toFixed(1)}h
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                Avg time to contact
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                            <Users className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold tabular-nums">
                                {metrics.totalLeads}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Total leads</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function FunnelStep({
    label,
    count,
    percentage,
    color,
}: {
    label: string;
    count: number;
    percentage: number;
    color: string;
}) {
    return (
        <div className="flex-1 text-center">
            <div
                className={cn('mx-auto h-1.5 rounded-full', color)}
                style={{ width: `${Math.max(percentage, 20)}%`, opacity: percentage / 100 + 0.3 }}
            />
            <p className="mt-1 text-xs font-medium tabular-nums">{count}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
    );
}

function ConversionMetricsCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-24" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-end justify-between">
                    <div>
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="mt-1 h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-12 w-full" />
                <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-full" />
                </div>
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
    );
}
