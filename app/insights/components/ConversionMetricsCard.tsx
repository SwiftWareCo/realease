'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import {
    ArrowUpRight,
    ArrowDownRight,
    Target,
    AlertTriangle,
    Snowflake,
    Flame,
    Users,
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
    leadsGoneCold: number;
    leadsAtRisk: number; // contacted but stalled
    hotLeads: number; // high engagement recently
    avgDaysToClose: number;
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
    leadsGoneCold: 23,
    leadsAtRisk: 15,
    hotLeads: 31,
    avgDaysToClose: 45,
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
        <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            {/* Decorative gradient border */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-chart-1/20 via-transparent to-chart-4/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-[1px] rounded-xl bg-card" />

            <CardContent className="relative p-0">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg">
                                <Target className="size-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold tracking-tight">Conversion Metrics</h3>
                                <p className="text-xs text-muted-foreground">Lead performance</p>
                            </div>
                        </div>
                        <Badge
                            className={cn(
                                'border-0 shadow-sm',
                                isPositive
                                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                                    : 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
                            )}
                        >
                            {isPositive ? '+' : ''}{rateChange.toFixed(1)}%
                        </Badge>
                    </div>
                </div>

                <div className="p-5 space-y-5">
                    {/* Main conversion rate with sparkline */}
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <p className="text-4xl font-bold tabular-nums tracking-tight">
                                {metrics.conversionRate.toFixed(1)}%
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Overall conversion rate
                            </p>
                        </div>
                        <div className="h-14 w-24">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metrics.weeklyTrend}>
                                    <defs>
                                        <linearGradient id="convGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
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
                                        fill="url(#convGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Attention-requiring metrics */}
                    <div className="grid grid-cols-3 gap-2">
                        {/* Leads gone cold */}
                        <div className="group/item rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-3 transition-colors hover:from-blue-500/15 hover:to-cyan-500/15">
                            <div className="flex items-center gap-2">
                                <Snowflake className="size-4 text-blue-500" />
                                <span className="text-xl font-bold tabular-nums">{metrics.leadsGoneCold}</span>
                            </div>
                            <p className="mt-1 text-[10px] font-medium text-muted-foreground">Gone Cold</p>
                            <p className="text-[9px] text-muted-foreground/70">No contact 14+ days</p>
                        </div>

                        {/* At risk */}
                        <div className="group/item rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-3 transition-colors hover:from-amber-500/15 hover:to-orange-500/15">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="size-4 text-amber-500" />
                                <span className="text-xl font-bold tabular-nums">{metrics.leadsAtRisk}</span>
                            </div>
                            <p className="mt-1 text-[10px] font-medium text-muted-foreground">At Risk</p>
                            <p className="text-[9px] text-muted-foreground/70">Stalled pipeline</p>
                        </div>

                        {/* Hot leads */}
                        <div className="group/item rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 p-3 transition-colors hover:from-emerald-500/15 hover:to-green-500/15">
                            <div className="flex items-center gap-2">
                                <Flame className="size-4 text-emerald-500" />
                                <span className="text-xl font-bold tabular-nums">{metrics.hotLeads}</span>
                            </div>
                            <p className="mt-1 text-[10px] font-medium text-muted-foreground">Hot Leads</p>
                            <p className="text-[9px] text-muted-foreground/70">High engagement</p>
                        </div>
                    </div>

                    {/* Funnel visualization */}
                    <div className="space-y-2 border-t pt-4">
                        <p className="text-xs font-medium text-muted-foreground">Lead Funnel</p>
                        <div className="flex items-center gap-2">
                            <FunnelStep
                                label="New"
                                count={metrics.newLeads}
                                percentage={100}
                                color="from-slate-400 to-slate-500"
                            />
                            <div className="text-muted-foreground/30">→</div>
                            <FunnelStep
                                label="Contacted"
                                count={metrics.contactedLeads}
                                percentage={(metrics.contactedLeads / metrics.newLeads) * 100}
                                color="from-blue-400 to-blue-500"
                            />
                            <div className="text-muted-foreground/30">→</div>
                            <FunnelStep
                                label="Qualified"
                                count={metrics.qualifiedLeads}
                                percentage={(metrics.qualifiedLeads / metrics.newLeads) * 100}
                                color="from-emerald-400 to-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Summary stat */}
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Users className="size-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Total pipeline</span>
                        </div>
                        <span className="text-lg font-bold tabular-nums">{metrics.totalLeads}</span>
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
                className={cn('mx-auto h-2 rounded-full bg-gradient-to-r', color)}
                style={{ width: `${Math.max(percentage, 30)}%`, opacity: Math.max(percentage / 100, 0.4) }}
            />
            <p className="mt-1.5 text-sm font-bold tabular-nums">{count}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
    );
}

function ConversionMetricsCardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <div className="bg-muted/30 p-5">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-xl" />
                    <div>
                        <Skeleton className="h-5 w-36" />
                        <Skeleton className="mt-1 h-3 w-24" />
                    </div>
                </div>
            </div>
            <div className="p-5 space-y-5">
                <div className="flex items-end gap-4">
                    <div className="flex-1">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="mt-1 h-4 w-32" />
                    </div>
                    <Skeleton className="h-14 w-24" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-16 w-full" />
            </div>
        </Card>
    );
}
