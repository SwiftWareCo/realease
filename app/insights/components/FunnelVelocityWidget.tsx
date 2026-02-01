'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function FunnelVelocityWidget() {
    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <Timer className="size-4 text-primary" />
                    Funnel Velocity
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pb-2">
                <div className="flex flex-col h-full justify-between gap-1">
                    {/* Stage 1: Leads */}
                    <div className="relative flex items-center justify-between rounded-lg border bg-gradient-to-r from-blue-500/10 to-transparent p-3">
                        <div>
                            <span className="text-sm font-semibold">Total Leads</span>
                            <div className="text-2xl font-bold">142</div>
                        </div>
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-300">New</Badge>
                    </div>

                    {/* Connector 1 */}
                    <div className="flex justify-center py-1">
                        <div className="flex flex-col items-center">
                            <div className="h-4 w-0.5 bg-border" />
                            <span className="text-[10px] font-medium text-muted-foreground bg-background px-1 z-10">4h avg response</span>
                            <div className="h-4 w-0.5 bg-border" />
                        </div>
                    </div>

                    {/* Stage 2: Contacted */}
                    <div className="relative flex items-center justify-between rounded-lg border bg-gradient-to-r from-indigo-500/10 to-transparent p-3 mx-2">
                        <div>
                            <span className="text-sm font-semibold">Contacted</span>
                            <div className="text-2xl font-bold">98</div>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">69% conv</span>
                    </div>

                    {/* Connector 2 */}
                    <div className="flex justify-center py-1">
                        <div className="flex flex-col items-center">
                            <div className="h-4 w-0.5 bg-border" />
                            <span className="text-[10px] font-medium text-muted-foreground bg-background px-1 z-10">2.5 days</span>
                            <div className="h-4 w-0.5 bg-border" />
                        </div>
                    </div>

                    {/* Stage 3: Qualified */}
                    <div className="relative flex items-center justify-between rounded-lg border bg-gradient-to-r from-purple-500/10 to-transparent p-3 mx-4">
                        <div>
                            <span className="text-sm font-semibold">Qualified</span>
                            <div className="text-2xl font-bold">34</div>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">35% conv</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
