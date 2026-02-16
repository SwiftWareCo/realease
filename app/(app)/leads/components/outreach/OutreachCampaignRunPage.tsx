"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { CampaignCallsData, CampaignRow } from "./types";
import { CampaignRunView } from "./CampaignRunView";

export function OutreachCampaignRunPage({
    campaignId,
}: {
    campaignId: string;
}) {
    const router = useRouter();

    const campaignsRaw = useQuery(api.outreach.queries.getCampaignsForPicker, {
        includeInactive: true,
    });
    const campaigns = campaignsRaw as CampaignRow[] | undefined;

    const selectedCampaign =
        campaigns?.find((campaign) => campaign._id === campaignId) ?? null;

    const runDataRaw = useQuery(
        api.outreach.queries.getCampaignCallAttempts,
        selectedCampaign
            ? {
                  campaignId: selectedCampaign._id,
                  limit: 250,
              }
            : "skip",
    );
    const runData = runDataRaw as CampaignCallsData | undefined;

    if (campaigns === undefined || (selectedCampaign && runData === undefined)) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-[640px]" />
            </div>
        );
    }

    if (!selectedCampaign) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Campaign Not Found</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        The campaign ID does not match any existing outreach
                        campaign.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => router.push("/leads/outreach")}
                    >
                        Back to Campaigns
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!runData) {
        return null;
    }

    return (
        <CampaignRunView
            data={runData}
            onBack={() => router.push("/leads/outreach")}
        />
    );
}
