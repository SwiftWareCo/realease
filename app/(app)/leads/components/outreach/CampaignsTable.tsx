"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Edit3, Play } from "lucide-react";
import { WEEKDAYS, getCampaignStatusBadge } from "./constants";
import type { CampaignRow } from "./types";
import { formatDateHumanReadable, formatHourTo12Hour } from "@/utils/dateandtimes";

function formatUpdatedAt(timestamp: number): string {
    const date = new Date(timestamp);
    return `${formatDateHumanReadable(date)} • ${formatHourTo12Hour(
        date.getHours(),
    )}`;
}

export function CampaignsTable({
    campaigns,
    onEditCampaign,
    onStartOutreach,
}: {
    campaigns: CampaignRow[];
    onEditCampaign: (campaign: CampaignRow) => void;
    onStartOutreach: (campaign: CampaignRow) => void;
}) {
    if (campaigns.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">No Campaigns Yet</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Create a campaign to start outbound qualification.
                    </p>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Calling Window</TableHead>
                            <TableHead>Retry</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {campaigns.map((campaign) => (
                            <TableRow key={campaign._id}>
                                <TableCell>
                                    <div className="font-medium">{campaign.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {campaign.description || campaign.timezone}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {getCampaignStatusBadge(campaign.status)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {formatHourTo12Hour(
                                        campaign.callingWindow.start_hour_local,
                                    )}
                                    {" - "}
                                    {formatHourTo12Hour(
                                        campaign.callingWindow.end_hour_local,
                                    )}
                                    {" | "}
                                    {campaign.callingWindow.allowed_weekdays
                                        .map(
                                            (weekday) =>
                                                WEEKDAYS.find(
                                                    (item) => item.value === weekday,
                                                )?.label,
                                        )
                                        .filter(Boolean)
                                        .join(", ")}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    <Badge variant="outline">
                                        {campaign.retryPolicy.max_attempts} max
                                    </Badge>{" "}
                                    <Badge variant="outline">
                                        {
                                            campaign.retryPolicy
                                                .min_minutes_between_attempts
                                        }
                                        m cooldown
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {formatUpdatedAt(campaign.updatedAt)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => onEditCampaign(campaign)}
                                        >
                                            <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => onStartOutreach(campaign)}
                                        >
                                            <Play className="mr-1.5 h-4 w-4" />
                                            Start Outreach
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
