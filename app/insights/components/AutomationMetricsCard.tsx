'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    BarChart,
    Bar,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Bot, Zap, Sparkles, MessageSquare, FileSearch, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Interface for automation metrics
export interface AutomationAction {
    category: 'lead-analysis' | 'follow-up' | 'scheduling' | 'messaging' | 'other';
    actionName: string;
    count: number;
    lastUsed: Date;
    timeSavedMinutes?: number;
}

export interface AutomationMetrics {
    totalActions: number;
    actionsThisMonth: number;
    previousMonthActions: number;
    estimatedTimeSaved: number; // hours
    actionsByCategory: { category: string; count: number }[];
    topActions: AutomationAction[];
}

// Mock data for UI demonstration
const mockMetrics: AutomationMetrics = {
    totalActions: 1247,
    actionsThisMonth: 189,
    previousMonthActions: 156,
    estimatedTimeSaved: 42.5,
    actionsByCategory: [
        { category: 'Lead Analysis', count: 423 },
        { category: 'Follow-up', count: 312 },
        { category: 'Scheduling', count: 245 },
        { category: 'Messaging', count: 187 },
        { category: 'Other', count: 80 },
    ],
    topActions: [
        {
            category: 'lead-analysis',
            actionName: 'Lead Scoring',
            count: 234,
            lastUsed: new Date('2026-01-19'),
            timeSavedMinutes: 15,
        },
        {
            category: 'follow-up',
            actionName: 'Auto Follow-up',
            count: 189,
            lastUsed: new Date('2026-01-20'),
            timeSavedMinutes: 10,
        },
        {
            category: 'messaging',
            actionName: 'Smart Responses',
            count: 156,
            lastUsed: new Date('2026-01-18'),
            timeSavedMinutes: 8,
        },
    ],
};

const categoryIcons = {
    'lead-analysis': FileSearch,
    'follow-up': Zap,
    scheduling: Clock,
    messaging: MessageSquare,
    other: Sparkles,
};

const chartColors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
];

interface AutomationMetricsCardProps {
    metrics?: AutomationMetrics;
    isLoading?: boolean;
}

export function AutomationMetricsCard({
    metrics = mockMetrics,
    isLoading = false,
}: AutomationMetricsCardProps) {
    const monthlyChange = useMemo(() => {
        if (metrics.previousMonthActions === 0) return 0;
        return (
            ((metrics.actionsThisMonth - metrics.previousMonthActions) /
                metrics.previousMonthActions) *
            100
        );
    }, [metrics.actionsThisMonth, metrics.previousMonthActions]);

    if (isLoading) {
        return <AutomationMetricsCardSkeleton />;
    }

    return (
        <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg md:col-span-2">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-chart-4 via-chart-5 to-chart-1 opacity-0 transition-opacity group-hover:opacity-100" />
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Bot className="size-4 text-muted-foreground" />
                        Automation Overview
                    </CardTitle>
                    <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/10 text-xs font-normal text-primary"
                    >
                        {metrics.actionsThisMonth} this month
                        {monthlyChange !== 0 && (
                            <span
                                className={cn(
                                    'ml-1',
                                    monthlyChange > 0 ? 'text-green-600' : 'text-red-600'
                                )}
                            >
                                ({monthlyChange > 0 ? '+' : ''}
                                {monthlyChange.toFixed(0)}%)
                            </span>
                        )}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Left side - Stats and chart */}
                    <div className="space-y-4">
                        {/* Key metrics */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-lg border bg-muted/30 p-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                                        <Zap className="size-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold tabular-nums">
                                            {metrics.totalActions.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Total actions
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-green-500/10">
                                        <Clock className="size-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold tabular-nums">
                                            {metrics.estimatedTimeSaved.toFixed(1)}h
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Time saved
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Category breakdown chart */}
                        <div className="h-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={metrics.actionsByCategory}
                                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                >
                                    <XAxis
                                        dataKey="category"
                                        tick={{ fontSize: 9 }}
                                        axisLine={false}
                                        tickLine={false}
                                        interval={0}
                                        angle={-20}
                                        textAnchor="end"
                                        height={40}
                                    />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                                                        <p className="font-medium">{data.category}</p>
                                                        <p className="text-muted-foreground">
                                                            {data.count} actions
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                        {metrics.actionsByCategory.map((_, index) => (
                                            <rect
                                                key={`bar-${index}`}
                                                fill={chartColors[index % chartColors.length]}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right side - Top actions */}
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">
                            Most Used Automations
                        </p>
                        <div className="space-y-2">
                            {metrics.topActions.map((action, index) => {
                                const Icon =
                                    categoryIcons[action.category] || Sparkles;
                                return (
                                    <div
                                        key={action.actionName}
                                        className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/50"
                                    >
                                        <div
                                            className="flex size-8 items-center justify-center rounded-lg"
                                            style={{
                                                backgroundColor: `color-mix(in oklch, ${chartColors[index]} 15%, transparent)`,
                                            }}
                                        >
                                            <Icon
                                                className="size-4"
                                                style={{ color: chartColors[index] }}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {action.actionName}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {action.count} uses · Saves ~{action.timeSavedMinutes}min
                                                each
                                            </p>
                                        </div>
                                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                                            #{index + 1}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Coming soon placeholder */}
                        <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-center">
                            <Sparkles className="mx-auto mb-1 size-5 text-muted-foreground/50" />
                            <p className="text-xs font-medium text-muted-foreground">
                                More automations coming soon
                            </p>
                            <p className="text-[10px] text-muted-foreground/70">
                                AI-powered features in development
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AutomationMetricsCardSkeleton() {
    return (
        <Card className="md:col-span-2">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-32" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                        <Skeleton className="h-[120px] w-full" />
                    </div>
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
