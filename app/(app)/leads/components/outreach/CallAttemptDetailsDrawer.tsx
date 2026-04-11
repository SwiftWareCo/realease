"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import type { CampaignCallAttemptDetails } from "./types";
import { getOutreachOutcomeLabel } from "@/lib/outreach/outcomes";
import { formatDateTimeHumanReadable } from "@/utils/dateandtimes";
import { RecordingPlayer } from "./RecordingPlayer";

const EXPECTED_MVP_EVENTS = ["call_started", "call_ended", "call_analyzed"];
const FOLLOW_UP_SMS_STATUS_LABELS: Record<string, string> = {
    not_needed: "Not needed",
    pending: "Pending",
    sent: "Sent",
    failed: "Failed",
    opted_out: "Opted out",
};

function formatDateTime(timestamp: number | null): string {
    if (!timestamp) {
        return "-";
    }
    return formatDateTimeHumanReadable(timestamp);
}

function formatDuration(durationSeconds: number | null): string {
    if (durationSeconds === null) {
        return "-";
    }
    if (durationSeconds < 60) {
        return `${durationSeconds}s`;
    }
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim();
    return normalized ? normalized : null;
}

function asNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value !== "string") {
        return null;
    }
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
}

export function CallAttemptDetailsDrawer({
    campaignId,
    callId,
    open,
    onOpenChange,
    onSelectCall,
}: {
    campaignId: Id<"outreachCampaigns">;
    callId: Id<"outreachCalls"> | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectCall: (callId: Id<"outreachCalls">) => void;
}) {
    const detailsRaw = useQuery(
        api.outreach.queries.getCampaignCallAttemptDetails,
        open && callId ? { campaignId, callId } : "skip",
    );
    const details = detailsRaw as CampaignCallAttemptDetails | undefined;

    const observedEventTypes = useMemo(() => {
        const eventTypes = new Set<string>();
        if (!details) {
            return eventTypes;
        }
        for (const event of details.webhookEvents) {
            eventTypes.add(event.eventType);
        }
        return eventTypes;
    }, [details]);

    const extractedData = useMemo(
        () => asRecord(details?.call.extractedData),
        [details],
    );
    const callAnalysis = useMemo(
        () => asRecord(extractedData?.call_analysis),
        [extractedData],
    );
    const customAnalysisData = useMemo(
        () =>
            asRecord(extractedData?.custom_analysis_data) ??
            asRecord(callAnalysis?.custom_analysis_data),
        [callAnalysis, extractedData],
    );
    const sentiment = asString(callAnalysis?.user_sentiment);
    const disconnectionReason = asString(extractedData?.disconnection_reason);
    const qualificationNotes = asString(
        customAnalysisData?.qualification_notes,
    );
    const e2eLatencyP50 = asNumber(
        asRecord(extractedData?.latency)?.e2e &&
            asRecord(asRecord(extractedData?.latency)?.e2e)?.p50,
    );
    const llmAvgTokens = asNumber(
        asRecord(extractedData?.llm_token_usage)?.average,
    );
    const combinedCostRaw = asNumber(
        asRecord(extractedData?.call_cost)?.combined_cost,
    );
    const combinedCost =
        combinedCostRaw !== null ? combinedCostRaw / 100 : null;
    const timelineEntries = useMemo(() => {
        const rawTimeline =
            asArray(extractedData?.transcript_with_tool_calls).length > 0
                ? asArray(extractedData?.transcript_with_tool_calls)
                : asArray(extractedData?.transcript_object);
        return rawTimeline
            .map((entry) => asRecord(entry))
            .filter((entry): entry is Record<string, unknown> => Boolean(entry))
            .map((entry, index) => {
                const role = asString(entry.role) ?? "event";
                const content = asString(entry.content);
                const nodeTransition =
                    role === "node_transition"
                        ? `${asString(entry.former_node_name) ?? "Node"} -> ${asString(entry.new_node_name) ?? "Node"}`
                        : null;
                const timeSec =
                    asNumber(entry.time_sec) ??
                    asNumber(asRecord(asArray(entry.words)[0])?.start);
                return {
                    key: `${role}-${index}-${timeSec ?? "na"}`,
                    role,
                    content: content ?? nodeTransition ?? "-",
                    timeSec,
                };
            });
    }, [extractedData]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
                <SheetHeader className="px-6 pt-6 pb-4">
                    <SheetTitle>Call Attempt Details</SheetTitle>
                    <SheetDescription>
                        Call trace, webhook timeline, and lead history for this
                        attempt.
                    </SheetDescription>
                </SheetHeader>
                <Separator />
                {open && details === undefined ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : details ? (
                    <ScrollArea className="h-[calc(100vh-120px)]">
                        <div className="space-y-4 py-4 pl-6 pr-8 sm:pr-6">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">
                                        Overview
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    {(() => {
                                        const showFollowUpSmsError =
                                            details.call.followUpSmsStatus ===
                                                "failed" &&
                                            Boolean(
                                                details.call.followUpSmsError,
                                            );
                                        const showFollowUpSmsDetails =
                                            Boolean(
                                                details.call.followUpSmsSentAt,
                                            ) ||
                                            Boolean(
                                                details.call.followUpSmsSid,
                                            ) ||
                                            showFollowUpSmsError;
                                        return (
                                            <>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline">
                                                        Lead:{" "}
                                                        {details.call.leadName}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        {details.call.leadPhone}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        Status:{" "}
                                                        {
                                                            details.call
                                                                .callStatus
                                                        }
                                                    </Badge>
                                                    <Badge variant="secondary">
                                                        Outcome:{" "}
                                                        {details.call.outcome
                                                            ? (getOutreachOutcomeLabel(
                                                                  details.call
                                                                      .outcome,
                                                              ) ??
                                                              details.call
                                                                  .outcome)
                                                            : "-"}
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                                    <div>
                                                        Initiated:{" "}
                                                        {formatDateTime(
                                                            details.call
                                                                .initiatedAt,
                                                        )}
                                                    </div>
                                                    <div>
                                                        Started:{" "}
                                                        {formatDateTime(
                                                            details.call
                                                                .startedAt,
                                                        )}
                                                    </div>
                                                    <div>
                                                        Ended:{" "}
                                                        {formatDateTime(
                                                            details.call
                                                                .endedAt,
                                                        )}
                                                    </div>
                                                    <div>
                                                        Duration:{" "}
                                                        {formatDuration(
                                                            details.call
                                                                .durationSeconds,
                                                        )}
                                                    </div>
                                                    <div>
                                                        Retell Call ID:{" "}
                                                        {details.call
                                                            .retellCallId ??
                                                            "-"}
                                                    </div>
                                                    <div>
                                                        Conversation ID:{" "}
                                                        {details.call
                                                            .retellConversationId ??
                                                            "-"}
                                                    </div>
                                                </div>
                                                {details.call.errorMessage && (
                                                    <p className="text-xs text-destructive">
                                                        Error:{" "}
                                                        {
                                                            details.call
                                                                .errorMessage
                                                        }
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="outline">
                                                        Sentiment:{" "}
                                                        {sentiment ?? "-"}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        Disconnect:{" "}
                                                        {disconnectionReason ??
                                                            "-"}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        E2E Latency p50:{" "}
                                                        {e2eLatencyP50 !== null
                                                            ? `${Math.round(e2eLatencyP50)}ms`
                                                            : "-"}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        LLM Avg Tokens:{" "}
                                                        {llmAvgTokens !== null
                                                            ? Math.round(
                                                                  llmAvgTokens,
                                                              )
                                                            : "-"}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        Cost:{" "}
                                                        {combinedCost !== null
                                                            ? `$${combinedCost.toFixed(3)}`
                                                            : "-"}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        Follow-up SMS:{" "}
                                                        {details.call
                                                            .followUpSmsStatus
                                                            ? (FOLLOW_UP_SMS_STATUS_LABELS[
                                                                  details.call
                                                                      .followUpSmsStatus
                                                              ] ??
                                                              details.call
                                                                  .followUpSmsStatus)
                                                            : "-"}
                                                    </Badge>
                                                </div>
                                                {showFollowUpSmsDetails && (
                                                    <div className="space-y-1 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                                                        <div>
                                                            SMS Sent At:{" "}
                                                            {formatDateTime(
                                                                details.call
                                                                    .followUpSmsSentAt,
                                                            )}
                                                        </div>
                                                        <div>
                                                            SMS SID:{" "}
                                                            {details.call
                                                                .followUpSmsSid ??
                                                                "-"}
                                                        </div>
                                                        {showFollowUpSmsError && (
                                                            <p className="text-destructive">
                                                                SMS Error:{" "}
                                                                {
                                                                    details.call
                                                                        .followUpSmsError
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                    {details.call.recordingUrl && (
                                        <RecordingPlayer
                                            key={details.call.recordingUrl}
                                            src={details.call.recordingUrl}
                                        />
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">
                                        AI Output
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Summary
                                        </p>
                                        <p className="max-h-[170px] overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm leading-relaxed text-foreground/90">
                                            {details.call.summary ??
                                                "No AI summary available yet."}
                                        </p>
                                    </div>
                                    {qualificationNotes && (
                                        <div className="rounded-md border p-2">
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Qualification Notes
                                            </p>
                                            <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
                                                {qualificationNotes}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">
                                        Activity
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm">
                                    <Tabs
                                        defaultValue="webhook"
                                        className="gap-3"
                                    >
                                        <TabsList className="grid h-9 w-full grid-cols-3">
                                            <TabsTrigger value="webhook">
                                                Webhooks
                                            </TabsTrigger>
                                            <TabsTrigger value="transcript">
                                                Transcript
                                            </TabsTrigger>
                                            <TabsTrigger value="history">
                                                History
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="webhook">
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {EXPECTED_MVP_EVENTS.map(
                                                        (eventType) => (
                                                            <Badge
                                                                key={eventType}
                                                                variant={
                                                                    observedEventTypes.has(
                                                                        eventType,
                                                                    )
                                                                        ? "secondary"
                                                                        : "outline"
                                                                }
                                                            >
                                                                {eventType}
                                                            </Badge>
                                                        ),
                                                    )}
                                                </div>
                                                {details.webhookEvents
                                                    .length === 0 && (
                                                    <p className="text-xs text-muted-foreground">
                                                        No webhook events stored
                                                        for this call yet.
                                                    </p>
                                                )}
                                                {details.webhookEvents.map(
                                                    (event) => (
                                                        <div
                                                            key={event.eventId}
                                                            className="space-y-2 rounded-md border p-3"
                                                        >
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline">
                                                                    {
                                                                        event.eventType
                                                                    }
                                                                </Badge>
                                                                <Badge variant="secondary">
                                                                    {
                                                                        event.processingStatus
                                                                    }
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatDateTime(
                                                                        event.eventTimestamp ??
                                                                            event.receivedAt,
                                                                    )}
                                                                </span>
                                                            </div>
                                                            {event.processingError && (
                                                                <p className="text-xs text-destructive">
                                                                    {
                                                                        event.processingError
                                                                    }
                                                                </p>
                                                            )}
                                                            <details className="text-xs">
                                                                <summary className="cursor-pointer text-muted-foreground">
                                                                    Raw payload
                                                                </summary>
                                                                <pre className="mt-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-2 text-[11px] leading-5 text-muted-foreground">
                                                                    {JSON.stringify(
                                                                        event.payload,
                                                                        null,
                                                                        2,
                                                                    )}
                                                                </pre>
                                                            </details>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="transcript">
                                            <div className="space-y-2">
                                                {timelineEntries.length ===
                                                0 ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        No structured timeline
                                                        available yet.
                                                    </p>
                                                ) : (
                                                    timelineEntries.map(
                                                        (entry) => (
                                                            <div
                                                                key={entry.key}
                                                                className="space-y-1 rounded-md border p-2"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline">
                                                                        {
                                                                            entry.role
                                                                        }
                                                                    </Badge>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {entry.timeSec !==
                                                                        null
                                                                            ? `${entry.timeSec.toFixed(2)}s`
                                                                            : "-"}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {
                                                                        entry.content
                                                                    }
                                                                </p>
                                                            </div>
                                                        ),
                                                    )
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="history">
                                            <div className="space-y-2">
                                                {details.leadHistory.length ===
                                                0 ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        No prior calls for this
                                                        lead.
                                                    </p>
                                                ) : (
                                                    details.leadHistory.map(
                                                        (historyCall) => (
                                                            <div
                                                                key={
                                                                    historyCall.callId
                                                                }
                                                                className="flex items-center justify-between rounded-md border p-2"
                                                            >
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline">
                                                                            {
                                                                                historyCall.callStatus
                                                                            }
                                                                        </Badge>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {formatDateTime(
                                                                                historyCall.initiatedAt,
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {historyCall.campaignName ??
                                                                            "No campaign"}{" "}
                                                                        •{" "}
                                                                        {historyCall.outcome
                                                                            ? (getOutreachOutcomeLabel(
                                                                                  historyCall
                                                                                      .outcome,
                                                                              ) ??
                                                                              historyCall.outcome)
                                                                            : "No outcome"}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        onSelectCall(
                                                                            historyCall.callId,
                                                                        )
                                                                    }
                                                                >
                                                                    Open
                                                                </Button>
                                                            </div>
                                                        ),
                                                    )
                                                )}
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="p-6 text-sm text-muted-foreground">
                        Call detail unavailable.
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
