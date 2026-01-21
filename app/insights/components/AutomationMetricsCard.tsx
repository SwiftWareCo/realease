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
    XAxis,
    CartesianGrid,
} from 'recharts';
import { Bot, Zap, Sparkles, Clock, Mail, Calendar, TrendingUp, CheckCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Interface for automation metrics (focused on impact)
export interface AutomationImpact {
    hoursSaved: number;
    leadsContacted: number;
    followUpsSent: number;
    appointmentsScheduled: number;
    responsesGenerated: number;
    tasksAutomated: number;
}

export interface AutomationMetrics {
    impact: AutomationImpact;
    previousPeriodImpact: AutomationImpact;
    dailyLeadsContacted: { day: string; leads: number }[];
    topAutomations: { name: string; impact: string; icon: string }[];
}

// Mock data for UI demonstration
const mockMetrics: AutomationMetrics = {
    impact: {
        hoursSaved: 47.5,
        leadsContacted: 89,
        followUpsSent: 156,
        appointmentsScheduled: 23,
        responsesGenerated: 312,
        tasksAutomated: 445,
    },
    previousPeriodImpact: {
        hoursSaved: 38.2,
        leadsContacted: 72,
        followUpsSent: 134,
        appointmentsScheduled: 18,
        responsesGenerated: 267,
        tasksAutomated: 389,
    },
    dailyLeadsContacted: [
        { day: 'Mon', leads: 12 },
        { day: 'Tue', leads: 18 },
        { day: 'Wed', leads: 15 },
        { day: 'Thu', leads: 22 },
        { day: 'Fri', leads: 14 },
        { day: 'Sat', leads: 5 },
        { day: 'Sun', leads: 3 },
    ],
    topAutomations: [
        { name: 'Smart Follow-ups', impact: '23 leads re-engaged', icon: 'mail' },
        { name: 'Schedule Assistant', impact: '23 appointments booked', icon: 'calendar' },
        { name: 'Lead Scoring', impact: '15 hot leads identified', icon: 'zap' },
    ],
};

const impactIcons: Record<string, typeof Mail> = {
    mail: Mail,
    calendar: Calendar,
    zap: Zap,
};

interface AutomationMetricsCardProps {
    metrics?: AutomationMetrics;
    isLoading?: boolean;
}

export function AutomationMetricsCard({
    metrics = mockMetrics,
    isLoading = false,
}: AutomationMetricsCardProps) {
    const hoursSavedChange = useMemo(() => {
        if (metrics.previousPeriodImpact.hoursSaved === 0) return 0;
        return (
            ((metrics.impact.hoursSaved - metrics.previousPeriodImpact.hoursSaved) /
                metrics.previousPeriodImpact.hoursSaved) *
            100
        );
    }, [metrics.impact.hoursSaved, metrics.previousPeriodImpact.hoursSaved]);

    if (isLoading) {
        return <AutomationMetricsCardSkeleton />;
    }

    return (
        <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl md:col-span-2">
            {/* Decorative gradient border */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-chart-4/20 via-transparent to-chart-5/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-[1px] rounded-xl bg-card" />

            <CardContent className="relative p-0">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg">
                                <Bot className="size-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold tracking-tight">Your Automations</h3>
                                <p className="text-xs text-muted-foreground">Impact on your business</p>
                            </div>
                        </div>
                        <Badge className="gap-1 border-0 bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm">
                            <TrendingUp className="size-3" />
                            {hoursSavedChange > 0 ? '+' : ''}{hoursSavedChange.toFixed(0)}% efficiency
                        </Badge>
                    </div>
                </div>

                <div className="grid gap-6 p-5 md:grid-cols-2">
                    {/* Left side - Main impact metrics */}
                    <div className="space-y-5">
                        {/* Hero metric: Time saved */}
                        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-5xl font-bold tabular-nums tracking-tight text-primary">
                                        {metrics.impact.hoursSaved.toFixed(1)}
                                    </p>
                                    <p className="mt-1 text-lg font-medium">hours saved this month</p>
                                    <p className="text-sm text-muted-foreground">
                                        That&apos;s {Math.round(metrics.impact.hoursSaved / 8)} extra days for closing deals
                                    </p>
                                </div>
                                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/20">
                                    <Clock className="size-7 text-primary" />
                                </div>
                            </div>
                        </div>

                        {/* Leads contacted chart - meaningful data */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Leads Auto-Contacted This Week
                                </p>
                                <span className="text-xs font-bold tabular-nums">{metrics.impact.leadsContacted} total</span>
                            </div>
                            <div className="h-[110px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={metrics.dailyLeadsContacted}
                                        margin={{ top: 10, right: 15, left: 5, bottom: 5 }}
                                    >
                                        <defs>
                                            <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.5} />
                                                <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={true}
                                            horizontal={false}
                                            stroke="#9ca3af"
                                            opacity={0.2}
                                        />
                                        <XAxis
                                            dataKey="day"
                                            tick={{ fontSize: 12, fill: '#9ca3af' }}
                                            axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                            tickLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                            interval={0}
                                            padding={{ left: 20, right: 20 }}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                                                            <p className="font-semibold">{payload[0].payload.day}</p>
                                                            <p className="text-muted-foreground">
                                                                {payload[0].value} leads contacted
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="leads"
                                            stroke="#a78bfa"
                                            strokeWidth={2}
                                            fill="url(#leadsGradient)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Impact stats grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <ImpactStat
                                icon={Mail}
                                value={metrics.impact.followUpsSent}
                                label="Follow-ups sent"
                                sublabel="Auto-scheduled"
                                gradient="from-blue-500 to-cyan-500"
                            />
                            <ImpactStat
                                icon={Calendar}
                                value={metrics.impact.appointmentsScheduled}
                                label="Appointments"
                                sublabel="Auto-booked"
                                gradient="from-violet-500 to-purple-500"
                            />
                        </div>
                    </div>

                    {/* Right side - Top automations by impact */}
                    <div className="space-y-4">
                        <p className="text-sm font-medium text-muted-foreground">
                            Top Performing Automations
                        </p>

                        <div className="space-y-3">
                            {metrics.topAutomations.map((automation, index) => {
                                const Icon = impactIcons[automation.icon] || Sparkles;
                                return (
                                    <div
                                        key={automation.name}
                                        className="group/item flex items-center gap-4 rounded-xl border bg-gradient-to-r from-muted/30 to-transparent p-4 transition-all hover:from-muted/50 hover:shadow-sm"
                                    >
                                        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                                            <Icon className="size-6 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold">{automation.name}</p>
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <CheckCircle className="size-3 text-emerald-500" />
                                                {automation.impact}
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="shrink-0">
                                            #{index + 1}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Coming soon teaser */}
                        <div className="rounded-xl border border-dashed bg-gradient-to-br from-muted/20 to-transparent p-4 text-center">
                            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted">
                                <Sparkles className="size-5 text-muted-foreground" />
                            </div>
                            <p className="mt-2 text-sm font-medium">More AI features coming</p>
                            <p className="text-xs text-muted-foreground">
                                Smart insights, predictive analytics, and more
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ImpactStat({
    icon: Icon,
    value,
    label,
    sublabel,
    gradient,
}: {
    icon: typeof Mail;
    value: number;
    label: string;
    sublabel: string;
    gradient: string;
}) {
    return (
        <div className="rounded-xl border bg-gradient-to-br from-muted/30 to-transparent p-4">
            <div className="flex items-center gap-3">
                <div className={cn('flex size-10 items-center justify-center rounded-lg bg-gradient-to-br', gradient)}>
                    <Icon className="size-5 text-white" />
                </div>
                <div>
                    <p className="text-2xl font-bold tabular-nums">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground/70">{sublabel}</p>
                </div>
            </div>
        </div>
    );
}

function AutomationMetricsCardSkeleton() {
    return (
        <Card className="overflow-hidden md:col-span-2">
            <div className="bg-muted/30 p-5">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-xl" />
                    <div>
                        <Skeleton className="h-5 w-36" />
                        <Skeleton className="mt-1 h-3 w-28" />
                    </div>
                </div>
            </div>
            <div className="grid gap-6 p-5 md:grid-cols-2">
                <div className="space-y-5">
                    <Skeleton className="h-36 rounded-2xl" />
                    <Skeleton className="h-[100px] w-full" />
                    <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-24 rounded-xl" />
                        <Skeleton className="h-24 rounded-xl" />
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                </div>
            </div>
        </Card>
    );
}
