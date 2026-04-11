"use client";

import { Button } from "@/components/ui/button";

export function OutreachPageHeader({
    onStartOutreach,
}: {
    onStartOutreach: () => void;
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-primary to-primary/60" />
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Outreach Campaigns
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Launch outreach from one flow, then manage campaign runs
                        from the table below.
                    </p>
                </div>
            </div>
            <Button onClick={onStartOutreach}>Start Outreach</Button>
        </div>
    );
}
