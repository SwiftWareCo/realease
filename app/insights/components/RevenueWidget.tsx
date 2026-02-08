'use client';

import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Target, Sparkles, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const revenueData = [
    { month: "Jan", revenue: 45000 },
    { month: "Feb", revenue: 52000 },
    { month: "Mar", revenue: 48000 },
    { month: "Apr", revenue: 61000 },
    { month: "May", revenue: 55000 },
    { month: "Jun", revenue: 67000 },
];

const yearlyTarget = 500000;
const currentRevenue = 328000;
const progressPercent = Math.round((currentRevenue / yearlyTarget) * 100);
const expectedPercent = 50;

const getStatus = () => {
    const diff = progressPercent - expectedPercent;
    if (diff >= 10) return {
        label: "You're excelling!",
        sublabel: "Keep up the momentum",
        color: "text-emerald-600",
        bgColor: "bg-emerald-500/10",
        icon: Sparkles
    };
    if (diff >= -5) return {
        label: "You're on track",
        sublabel: "Steady progress",
        color: "text-blue-600",
        bgColor: "bg-blue-500/10",
        icon: Target
    };
    return {
        label: "Room to grow",
        sublabel: "A strong Q3 helps",
        color: "text-amber-600",
        bgColor: "bg-amber-500/10",
        icon: ArrowUpRight
    };
};

const status = getStatus();
const StatusIcon = status.icon;

export function RevenueWidget() {
    return (
        <Card className="h-full flex flex-col py-3">
            <CardContent className="flex-1 flex flex-col px-4 py-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <DollarSign className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Revenue & Performance</h3>
                    <span className="text-sm text-muted-foreground ml-auto">Year to Date</span>
                </div>

                {/* Main Content - Horizontal Flow */}
                <div className="flex-1 flex items-stretch gap-3 mt-2 min-h-0">
                    {/* Stats Column */}
                    <div className="flex flex-col justify-center gap-2 w-[180px] shrink-0">
                        <div className="rounded-lg bg-muted/30 p-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">Deals Closed</span>
                                <Badge variant="outline" className="gap-0.5 text-xs text-green-600 bg-green-500/10 border-0 px-1.5 py-0">
                                    <TrendingUp className="size-3" />+2
                                </Badge>
                            </div>
                            <div className="text-2xl font-bold">12</div>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">Revenue</span>
                                <Badge variant="outline" className="gap-0.5 text-xs text-green-600 bg-green-500/10 border-0 px-1.5 py-0">
                                    <TrendingUp className="size-3" />+15%
                                </Badge>
                            </div>
                            <div className="text-2xl font-bold">$328k</div>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">GCI</span>
                                <span className="text-xs font-semibold text-green-600">Target Met</span>
                            </div>
                            <div className="text-2xl font-bold">$82k</div>
                        </div>
                    </div>

                    {/* Chart - Takes available space */}
                    <div className="flex-1 min-h-0 rounded-lg border bg-muted/10 p-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                    formatter={(value) => [`$${value}`, 'Revenue']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Goal Progress Column */}
                    <div className="flex flex-col gap-2 w-[200px] shrink-0">
                        <div className="flex-1 rounded-lg border bg-muted/10 p-3 flex flex-col justify-center">
                            <span className="text-sm font-medium text-muted-foreground">Annual Goal</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-2xl font-bold">${(currentRevenue / 1000).toFixed(0)}k</span>
                                <span className="text-sm text-muted-foreground">/ $500k</span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted mt-2 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                                <span>{progressPercent}% done</span>
                                <span>{expectedPercent}% expected</span>
                            </div>
                        </div>

                        {/* Status */}
                        <div className={cn("rounded-lg p-2.5 flex items-center gap-2", status.bgColor)}>
                            <StatusIcon className={cn("size-4", status.color)} />
                            <div>
                                <div className={cn("text-sm font-semibold", status.color)}>{status.label}</div>
                                <div className="text-xs text-muted-foreground">{status.sublabel}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
