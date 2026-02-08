'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeartPulse, Thermometer, CheckCircle2, AlertTriangle, XCircle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const healthData = [
    { status: "Hot", count: 12, icon: Thermometer, color: "text-red-500", bg: "bg-red-500" },
    { status: "Warm", count: 28, icon: CheckCircle2, color: "text-orange-500", bg: "bg-orange-500" },
    { status: "At Risk", count: 8, icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500" },
    { status: "Cold", count: 45, icon: XCircle, color: "text-blue-500", bg: "bg-blue-500" },
];

export function LeadHealthWidget() {
    // Calculate health score (weighted average: hot=100, warm=70, at risk=30, cold=0)
    const totalLeads = healthData.reduce((sum, item) => sum + item.count, 0);
    const weightedSum = 12 * 100 + 28 * 70 + 8 * 30 + 45 * 0;
    const healthScore = Math.round(weightedSum / totalLeads);

    // Determine health status
    const getHealthStatus = (score: number) => {
        if (score >= 70) return { label: "Excellent", color: "text-emerald-500", bgColor: "from-emerald-500 to-green-500" };
        if (score >= 50) return { label: "Good", color: "text-blue-500", bgColor: "from-blue-500 to-cyan-500" };
        if (score >= 30) return { label: "Needs Attention", color: "text-amber-500", bgColor: "from-amber-500 to-orange-500" };
        return { label: "Critical", color: "text-red-500", bgColor: "from-red-500 to-rose-500" };
    };

    const status = getHealthStatus(healthScore);

    return (
        <Card className="col-span-full lg:col-span-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    <HeartPulse className="size-4 text-primary" />
                    Lead Health
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between px-4 pb-4">
                {/* Health Score Circle */}
                <div className="flex items-center justify-center py-2">
                    <div className={cn(
                        "relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br shadow-lg",
                        status.bgColor
                    )}>
                        <div className="absolute inset-1 rounded-full bg-card flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-2xl font-bold">{healthScore}</div>
                                <div className="text-[8px] text-muted-foreground">SCORE</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Health Breakdown Bar */}
                <div className="space-y-2">
                    <div className="flex h-3 w-full overflow-hidden rounded-full">
                        {healthData.map((item) => (
                            <div
                                key={item.status}
                                className={cn("h-full", item.bg)}
                                style={{ width: `${(item.count / totalLeads) * 100}%` }}
                            />
                        ))}
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-4 gap-1">
                        {healthData.map((item) => (
                            <div key={item.status} className="text-center">
                                <div className={cn("text-sm font-bold", item.color)}>{item.count}</div>
                                <div className="text-[9px] text-muted-foreground">{item.status}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Conclusion */}
                <div className={cn(
                    "mt-3 rounded-lg p-2 border text-center",
                    status.color === "text-emerald-500" ? "bg-emerald-500/10 border-emerald-500/20" :
                        status.color === "text-blue-500" ? "bg-blue-500/10 border-blue-500/20" :
                            status.color === "text-amber-500" ? "bg-amber-500/10 border-amber-500/20" :
                                "bg-red-500/10 border-red-500/20"
                )}>
                    <div className="flex items-center justify-center gap-1">
                        <Activity className={cn("size-3", status.color)} />
                        <span className={cn("text-xs font-semibold", status.color)}>{status.label}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                        {healthScore >= 50
                            ? "Pipeline is healthy with good engagement levels"
                            : "Focus on re-engaging cold leads to improve score"}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
