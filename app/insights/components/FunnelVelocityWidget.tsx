'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Timer, ArrowRight, TrendingUp, Clock, CheckCircle } from "lucide-react";

export function FunnelVelocityWidget() {
    const totalLeads = 142;
    const contacted = 98;
    const qualified = 34;
    const conversionRate = ((qualified / totalLeads) * 100).toFixed(1);
    const contactRate = ((contacted / totalLeads) * 100).toFixed(0);
    const qualifyRate = ((qualified / contacted) * 100).toFixed(0);

    return (
        <Card className="h-full flex flex-col py-3">
            <CardContent className="flex-1 flex flex-col px-4 py-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <Timer className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Funnel Velocity</h3>
                    <span className="text-sm text-muted-foreground ml-1">Lead progression through your pipeline</span>
                </div>

                {/* Horizontal Funnel Flow - takes all available space */}
                <div className="flex items-stretch justify-between gap-2 flex-1 mt-2">
                    {/* Stage 1: New Leads */}
                    <div className="flex-1 flex flex-col rounded-xl border bg-gradient-to-b from-blue-500/15 to-blue-500/5 p-4">
                        <div className="text-4xl font-bold text-blue-600">{totalLeads}</div>
                        <div className="text-sm font-medium mt-1">New Leads</div>
                        <div className="text-xs text-muted-foreground mt-auto">This month</div>
                    </div>

                    {/* Arrow 1 */}
                    <div className="flex flex-col items-center justify-center px-2">
                        <ArrowRight className="size-6 text-muted-foreground/40" />
                        <div className="mt-1 rounded-full bg-blue-500/10 px-2 py-0.5">
                            <span className="text-xs font-medium text-blue-600">4h avg</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">{contactRate}% contacted</span>
                    </div>

                    {/* Stage 2: Contacted */}
                    <div className="flex-1 flex flex-col rounded-xl border bg-gradient-to-b from-indigo-500/15 to-indigo-500/5 p-4">
                        <div className="text-4xl font-bold text-indigo-600">{contacted}</div>
                        <div className="text-sm font-medium mt-1">Contacted</div>
                        <div className="text-xs text-muted-foreground mt-auto">Responded</div>
                    </div>

                    {/* Arrow 2 */}
                    <div className="flex flex-col items-center justify-center px-2">
                        <ArrowRight className="size-6 text-muted-foreground/40" />
                        <div className="mt-1 rounded-full bg-indigo-500/10 px-2 py-0.5">
                            <span className="text-xs font-medium text-indigo-600">2.5 days</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">{qualifyRate}% qualified</span>
                    </div>

                    {/* Stage 3: Qualified */}
                    <div className="flex-1 flex flex-col rounded-xl border bg-gradient-to-b from-purple-500/15 to-purple-500/5 p-4">
                        <div className="text-4xl font-bold text-purple-600">{qualified}</div>
                        <div className="text-sm font-medium mt-1">Qualified</div>
                        <div className="text-xs text-muted-foreground mt-auto">Ready to close</div>
                    </div>
                </div>

                {/* Stats Footer */}
                <div className="flex items-center gap-4 mt-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                            <TrendingUp className="size-4 text-emerald-500" />
                        </div>
                        <div>
                            <div className="text-lg font-bold">{conversionRate}%</div>
                            <div className="text-xs text-muted-foreground">Overall Conversion</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
                            <Clock className="size-4 text-blue-500" />
                        </div>
                        <div>
                            <div className="text-lg font-bold">6.5 days</div>
                            <div className="text-xs text-muted-foreground">Avg. Time to Qualify</div>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                        <CheckCircle className="size-4 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-600">Strong velocity - 4h beats 24h avg</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
