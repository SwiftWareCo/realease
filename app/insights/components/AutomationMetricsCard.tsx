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
        <Card className="group relative col-span-full h-full overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            {/* Decorative gradient border */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-chart-4/20 via-transparent to-chart-5/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-[1px] rounded-xl bg-card" />

            <CardContent className="relative flex h-full flex-col p-0">
                {/* Compact Header */}
                <div className="flex shrink-0 items-center justify-between border-b bg-gradient-to-r from-indigo-500/10 to-violet-500/10 px-4 py-2">
                    <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg">
                            <Bot className="size-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold tracking-tight">Automation Impact</h3>
                        </div>
                    </div>
                    <Badge className="gap-1 border-0 bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm">
                        <TrendingUp className="size-3" />
                        {hoursSavedChange > 0 ? '+' : ''}{hoursSavedChange.toFixed(0)}%
                    </Badge>
                </div>

                <div className="flex min-h-0 flex-1 gap-4 p-4">
                    {/* Left: Hero Metric */}
                    <div className="flex w-1/4 flex-col justify-center rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
                        <div className="text-center">
                            <p className="text-4xl font-bold tabular-nums tracking-tight text-primary">
                                {metrics.impact.hoursSaved.toFixed(1)}
                            </p>
                            <p className="mt-1 text-sm font-medium">Hours Saved</p>
                            <div className="mt-4 flex justify-center">
                                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20">
                                    <Clock className="size-5 text-primary" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle: Chart */}
                    <div className="flex-1 flex-col justify-between">
                        <div className="mb-1 flex items-center justify-between">
                            <p className="text-[10px] font-medium text-muted-foreground">Leads Contacted (7 Days)</p>
                            <span className="text-[10px] font-bold tabular-nums">{metrics.impact.leadsContacted} total</span>
                        </div>
                        <div className="h-full max-h-[120px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metrics.dailyLeadsContacted} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.5} />
                                            <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="day" hide />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '10px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Area type="monotone" dataKey="leads" stroke="#a78bfa" strokeWidth={2} fill="url(#leadsGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border bg-muted/30 p-2">
                                <p className="text-lg font-bold tabular-nums leading-none">{metrics.impact.followUpsSent}</p>
                                <p className="text-[10px] text-muted-foreground">Follow-ups</p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-2">
                                <p className="text-lg font-bold tabular-nums leading-none">{metrics.impact.appointmentsScheduled}</p>
                                <p className="text-[10px] text-muted-foreground">Booked</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Top Automations (Compact List) */}
                    <div className="w-1/3 min-w-0 space-y-2 overflow-y-auto">
                        <p className="text-xs font-medium text-muted-foreground">Top Performing</p>
                        {metrics.topAutomations.map((automation, index) => {
                            const Icon = impactIcons[automation.icon] || Sparkles;
                            return (
                                <div key={automation.name} className="flex items-center gap-2 rounded-lg border bg-muted/10 p-2">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Icon className="size-4 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold">{automation.name}</p>
                                        <p className="truncate text-[10px] text-muted-foreground">{automation.impact}</p>
                                    </div>
                                </div>
                            );
                        })}
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
