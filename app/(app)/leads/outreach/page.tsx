"use client";

import { useState } from "react";
import { OutreachLeadPicker } from "../components/OutreachLeadPicker";
import { OutreachPageHeader } from "../components/outreach/OutreachPageHeader";

export default function LeadsOutreachPage() {
    const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
    const [isStartOutreachOpen, setIsStartOutreachOpen] = useState(false);

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-y-auto bg-gradient-to-br from-background via-background to-muted/20">
            <div className="flex-shrink-0 px-6 pt-5 pb-3">
                <OutreachPageHeader
                    onStartOutreach={() => setIsStartOutreachOpen(true)}
                    onCreateCampaign={() => setIsCreateCampaignOpen(true)}
                />
            </div>
            <div className="flex-1 min-h-0 px-6 pb-5">
                <OutreachLeadPicker
                    startDialogOpen={isStartOutreachOpen}
                    onStartDialogOpenChange={setIsStartOutreachOpen}
                    createDialogOpen={isCreateCampaignOpen}
                    onCreateDialogOpenChange={setIsCreateCampaignOpen}
                />
            </div>
        </div>
    );
}
