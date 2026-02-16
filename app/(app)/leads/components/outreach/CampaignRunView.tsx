"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { OUTCOME_LABELS, getCampaignStatusBadge } from "./constants";
import type { CampaignCallsData } from "./types";
import { formatDateHumanReadable, formatHourTo12Hour } from "@/utils/dateandtimes";

function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${formatDateHumanReadable(date)} • ${formatHourTo12Hour(
        date.getHours(),
    )}`;
}

export function CampaignRunView({
    data,
    onBack,
}: {
    data: CampaignCallsData;
    onBack: () => void;
}) {
    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="flex flex-col gap-3 pt-5 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 h-8"
                            onClick={onBack}
                        >
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back to Campaigns
                        </Button>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold">
                                {data.campaign.name}
                            </h2>
                            {getCampaignStatusBadge(data.campaign.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Live view of call attempts for this started
                            campaign.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <Badge variant="outline" className="justify-center py-1.5">
                            Total: {data.summary.total}
                        </Badge>
                        <Badge variant="outline" className="justify-center py-1.5">
                            Active:{" "}
                            {data.summary.queued +
                                data.summary.ringing +
                                data.summary.in_progress}
                        </Badge>
                        <Badge variant="outline" className="justify-center py-1.5">
                            Completed: {data.summary.completed}
                        </Badge>
                        <Badge variant="outline" className="justify-center py-1.5">
                            Failed: {data.summary.failed}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Call Attempts</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[520px] rounded-md border">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead>Lead</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Outcome</TableHead>
                                    <TableHead>Retell Call ID</TableHead>
                                    <TableHead>Initiated</TableHead>
                                    <TableHead>Error</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.calls.map((call) => (
                                    <TableRow key={call.callId}>
                                        <TableCell>
                                            <div className="font-medium">
                                                {call.leadName}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {call.leadPhone}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {call.callStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {call.outcome ? (
                                                <Badge variant="secondary">
                                                    {OUTCOME_LABELS[call.outcome] ??
                                                        call.outcome}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[220px] truncate text-xs">
                                            {call.retellCallId ?? "-"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(call.initiatedAt)}
                                        </TableCell>
                                        <TableCell className="max-w-[260px] text-xs text-destructive">
                                            {call.errorMessage ?? "-"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {data.calls.length === 0 && (
                            <div className="p-10 text-center text-sm text-muted-foreground">
                                No call attempts recorded for this campaign yet.
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
