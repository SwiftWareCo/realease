'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeartPulse, CheckCircle2, AlertTriangle, XCircle, Thermometer } from "lucide-react";

const healthData = [
    { status: "Hot", count: 12, reason: "Multiple showings booked, responsive", icon: Thermometer, color: "text-red-500", bg: "bg-red-500/10" },
    { status: "Warm", count: 28, reason: "Attended open house, sporadic replies", icon: CheckCircle2, color: "text-orange-500", bg: "bg-orange-500/10" },
    { status: "At Risk", count: 8, reason: "No response > 7 days", icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { status: "Cold", count: 45, reason: "Unresponsive > 30 days", icon: XCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
];

export function LeadHealthWidget() {
    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <HeartPulse className="size-5 text-primary" />
                    Lead Health
                </CardTitle>
                <CardDescription>
                    Pipeline health status and breakdown
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {healthData.map((item) => (
                        <div key={item.status} className="flex items-start gap-3 rounded-lg border p-3">
                            <div className={`mt-0.5 rounded-md p-2 ${item.bg} ${item.color}`}>
                                <item.icon className="size-4" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{item.status}</span>
                                    <span className="font-bold">{item.count}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{item.reason}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
