'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Award, AlertTriangle } from "lucide-react";

export function CoverageWidget() {
    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <PlayCircle className="size-5 text-primary" />
                    AI Coverage
                </CardTitle>
                <CardDescription>
                    Campaign reach and performance analysis
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span>Leads with AI Campaigns Active</span>
                        <span className="font-bold">78%</span>
                    </div>
                    {/* <Progress value={78} className="h-2" /> */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary" style={{ width: '78%' }} />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-lg bg-green-500/10 p-3 dark:bg-green-500/5">
                        <div className="mb-1 flex items-center gap-2 text-green-700 dark:text-green-400">
                            <Award className="size-4" />
                            <span className="text-sm font-semibold">Top Performer</span>
                        </div>
                        <p className="text-sm font-medium">"Buyer Nurture - Long Term"</p>
                        <p className="text-xs text-muted-foreground">Highest response rate (45%) for Cold Leads</p>
                    </div>

                    <div className="rounded-lg bg-red-500/10 p-3 dark:bg-red-500/5">
                        <div className="mb-1 flex items-center gap-2 text-red-700 dark:text-red-400">
                            <AlertTriangle className="size-4" />
                            <span className="text-sm font-semibold">Needs Attention</span>
                        </div>
                        <p className="text-sm font-medium">"Open House Follow-up"</p>
                        <p className="text-xs text-muted-foreground">High unsubscribe rate (12%) for Warm Leads</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
