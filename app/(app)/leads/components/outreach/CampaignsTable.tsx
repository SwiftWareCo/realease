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
import { Archive, Edit3, Eye, Pause, Play, Trash2 } from "lucide-react";
import { WEEKDAYS, getCampaignStatusBadge } from "./constants";
import type { CampaignRow } from "./types";
import {
    formatDateTimeHumanReadable,
    formatHourTo12Hour,
} from "@/utils/dateandtimes";

function formatUpdatedAt(timestamp: number): string {
    return formatDateTimeHumanReadable(timestamp);
}

export function CampaignsTable({
    campaigns,
    onEditCampaign,
    onToggleCampaignStatus,
    onDeleteCampaign,
    onOpenCampaign,
    isDeletingCampaign,
}: {
    campaigns: CampaignRow[];
    onEditCampaign: (campaign: CampaignRow) => void;
    onToggleCampaignStatus: (campaign: CampaignRow) => void;
    onDeleteCampaign: (campaign: CampaignRow) => void;
    onOpenCampaign: (campaign: CampaignRow) => void;
    isDeletingCampaign: boolean;
}) {
    if (campaigns.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">No Campaigns Yet</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Start outreach from the header to create a campaign and enroll leads.
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
                            <TableRow
                                key={campaign._id}
                                className="cursor-pointer hover:bg-muted/40"
                                onClick={() => onOpenCampaign(campaign)}
                            >
                                <TableCell>
                                    <div className="font-medium">{campaign.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {campaign.templateLabel
                                            ? `${campaign.templateLabel}${campaign.description ? ` | ${campaign.description}` : ""}`
                                            : campaign.description || "No description"}
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
                                        {campaign.retryPolicy.min_minutes_between_attempts}m cooldown
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
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onOpenCampaign(campaign);
                                            }}
                                            disabled={isDeletingCampaign}
                                            aria-label={`Open ${campaign.name}`}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onEditCampaign(campaign);
                                            }}
                                            disabled={
                                                isDeletingCampaign ||
                                                campaign.status === "active"
                                            }
                                            aria-label={
                                                campaign.status === "active"
                                                    ? `Pause ${campaign.name} before editing`
                                                    : `Edit ${campaign.name}`
                                            }
                                        >
                                            <Edit3 className="h-4 w-4" />
                                        </Button>
                                        {(campaign.status === "active" ||
                                            campaign.status === "paused") && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onToggleCampaignStatus(campaign);
                                                }}
                                                disabled={isDeletingCampaign}
                                            >
                                                {campaign.status === "active" ? (
                                                    <>
                                                        <Pause className="mr-1.5 h-4 w-4" />
                                                        Pause
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="mr-1.5 h-4 w-4" />
                                                        Resume
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className={
                                                campaign.hasCallHistory
                                                    ? "text-muted-foreground hover:text-foreground"
                                                    : "text-destructive hover:text-destructive"
                                            }
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onDeleteCampaign(campaign);
                                            }}
                                            disabled={isDeletingCampaign}
                                            aria-label={
                                                campaign.hasCallHistory
                                                    ? `Archive ${campaign.name}`
                                                    : `Delete ${campaign.name}`
                                            }
                                        >
                                            {campaign.hasCallHistory ? (
                                                <Archive className="h-4 w-4" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
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
