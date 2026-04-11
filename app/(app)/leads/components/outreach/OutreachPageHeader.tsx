"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function OutreachPageHeader({
    onStartOutreach,
    onCreateCampaign,
}: {
    onStartOutreach: () => void;
    onCreateCampaign: () => void;
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
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onCreateCampaign}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                </Button>
                <Button onClick={onStartOutreach}>Start Outreach</Button>
            </div>
        </div>
    );
}
