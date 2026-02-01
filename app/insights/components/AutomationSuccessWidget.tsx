'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Calendar, MessageSquare, Handshake } from "lucide-react";

export function AutomationSuccessWidget() {
    return (
        <Card className="col-span-full lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="size-5 text-primary" />
                    AI Success Rate
                </CardTitle>
                <CardDescription>
                    Outcomes driven by AI interactions
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="text-sm font-medium">Appointments Booked</div>
                            <Calendar className="size-4 text-muted-foreground" />
                        </div>
                        <div className="text-2xl font-bold">24</div>
                        <p className="text-xs text-muted-foreground">+18% from last month</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="text-sm font-medium">Events Attended</div>
                            <MessageSquare className="size-4 text-muted-foreground" />
                        </div>
                        <div className="text-2xl font-bold">15</div>
                        <p className="text-xs text-muted-foreground">85% attendance rate</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="text-sm font-medium">Deals Converted</div>
                            <Handshake className="size-4 text-muted-foreground" />
                        </div>
                        <div className="text-2xl font-bold">3</div>
                        <p className="text-xs text-muted-foreground">$1.2M volume generated</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
