"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ArrowLeft,
    Bot,
    CheckCircle2,
    Circle,
    Copy,
    FileText,
    PhoneCall,
    Settings,
    User2,
    Zap,
} from "lucide-react";
import { getOutreachOutcomeLabel } from "@/lib/outreach/outcomes";
import { formatDateTimeHumanReadable } from "@/utils/dateandtimes";
import { RecordingPlayer } from "./RecordingPlayer";
import type { CampaignCallAttemptDetails } from "./types";
import {
    CampaignStatusBadge,
    VerticalTimeline,
    VerticalTimelineItem,
} from "./campaign-ui";
import { cn } from "@/lib/utils";

function ReportSkeleton() {
    return (
        <div className="min-h-full bg-background p-6 md:p-8">
            <div className="mx-auto max-w-[1350px] space-y-5">
                <Skeleton className="h-20 rounded-2xl bg-muted" />
                <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
                    <Skeleton className="h-[760px] rounded-2xl bg-muted" />
                    <Skeleton className="h-[760px] rounded-2xl bg-muted" />
                </div>
            </div>
        </div>
    );
}

function deriveSentiment(outcome: string | null | undefined): { label: string; tone: string } {
    switch (outcome) {
        case "connected_interested":
        case "callback_requested":
            return { label: "Positive", tone: "text-[color:var(--status-good)]" };
        case "connected_not_interested":
        case "do_not_call":
        case "wrong_number":
        case "failed":
            return { label: "Negative", tone: "text-[color:var(--status-urgent)]" };
        case "no_answer":
        case "voicemail_left":
            return { label: "Neutral", tone: "text-muted-foreground" };
        default:
            return { label: "Unknown", tone: "text-muted-foreground" };
    }
}

function formatDuration(seconds: number | null | undefined) {
    if (!seconds || seconds <= 0) return "Unknown";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function formatEstimatedCost(seconds: number | null | undefined) {
    if (!seconds || seconds <= 0) return "$0.000";
    return `$${(seconds * 0.006).toFixed(3)}`;
}

function formatEventName(value: string) {
    return value
        .replaceAll("_", " ")
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

interface TranscriptMessage {
    speaker: "agent" | "lead";
    text: string;
}

function parseTranscript(transcript: string | null): TranscriptMessage[] {
    if (!transcript) return [];

    return transcript
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const agentMatch = line.match(/^(Agent|AI|Assistant|Architect AI):\s*/i);
            if (agentMatch) {
                return {
                    speaker: "agent" as const,
                    text: line.slice(agentMatch[0].length),
                };
            }
            const leadMatch = line.match(/^[A-Z][a-zA-Z\s'-]{1,40}:\s*/);
            if (leadMatch) {
                return {
                    speaker: "lead" as const,
                    text: line.slice(leadMatch[0].length),
                };
            }
            return { speaker: "lead" as const, text: line };
        });
}

function TranscriptThread({ transcript }: { transcript: string | null }) {
    const messages = parseTranscript(transcript);

    if (messages.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
                Transcript not available for this call.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {messages.map((message, index) => {
                const agent = message.speaker === "agent";
                return (
                    <div key={`${index}-${message.text.slice(0, 24)}`} className="flex gap-3">
                        <div
                            className={cn(
                                "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                agent ? "bg-[color:var(--status-good)]/10 text-[color:var(--status-good)]" : "bg-muted text-foreground/70",
                            )}
                        >
                            {agent ? <Bot className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-foreground">
                                    {agent ? "Architect AI (Agent)" : "Lead"}
                                </p>
                                <span className="text-[10px] text-muted-foreground">{index + 1}s</span>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{message.text}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Timeline({ data }: { data: CampaignCallAttemptDetails }) {
    const events = [
        {
            label: data.call.outcome ? "Inbound AI Analysis" : "Call Analysis Pending",
            time: data.call.updatedAt,
            active: true,
        },
        ...data.webhookEvents.slice(0, 5).map((event) => ({
            label: formatEventName(event.eventType),
            time: event.eventTimestamp ?? event.receivedAt,
            active: false,
        })),
        {
            label: "Lead Created",
            time: data.call.createdAt,
            active: false,
        },
    ];

    return (
        <VerticalTimeline className="ml-2">
            {events.map((event, index) => (
                <VerticalTimelineItem
                    key={`${event.label}-${index}`}
                    className="pb-5 last:pb-0"
                    markerClassName={cn(
                        event.active
                            ? "border-[color:var(--status-good)] bg-background"
                            : "border-border bg-card",
                    )}
                    markerInner={
                        event.active ? (
                            <Circle className="h-2 w-2 fill-[color:var(--status-good)] text-[color:var(--status-good)]" />
                        ) : undefined
                    }
                    markerInnerClassName={event.active ? undefined : "bg-muted-foreground"}
                >
                    {event.active ? (
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--status-good)]">Current Action</p>
                    ) : null}
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{event.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTimeHumanReadable(event.time)}</p>
                </VerticalTimelineItem>
            ))}
        </VerticalTimeline>
    );
}

export function CampaignCallReportPage({ campaignId, callId }: { campaignId: string; callId: string }) {
    const dataRaw = useQuery(api.outreach.queries.getCampaignCallAttemptDetails, {
        campaignId: campaignId as Id<"outreachCampaigns">,
        callId: callId as Id<"outreachCalls">,
    });

    if (dataRaw === undefined) {
        return <ReportSkeleton />;
    }

    const data = dataRaw as CampaignCallAttemptDetails;
    const extracted = data.call.extractedData as Record<string, unknown> | null;
    const sentiment = deriveSentiment(data.call.outcome);
    const outcomeLabel = data.call.outcome
        ? getOutreachOutcomeLabel(data.call.outcome) ?? data.call.outcome
        : "No Outcome";

    return (
        <div className="min-h-full bg-background px-4 py-5 text-foreground md:px-8 md:py-6">
            <div className="mx-auto max-w-[1350px] space-y-6">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground md:text-4xl">
                            Call Report: {data.call.leadName}
                        </h1>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Recorded {formatDateTimeHumanReadable(data.call.initiatedAt)}
                        </p>
                    </div>
                    <Button asChild variant="outline" className="rounded-lg border-border bg-muted text-primary hover:bg-accent">
                        <Link href={`/leads/outreach/${data.campaign._id}`}>
                            <ArrowLeft className="h-4 w-4" />
                            Back to Log
                        </Link>
                    </Button>
                </header>

                <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
                    <div className="space-y-5">
                        <Card className="rounded-2xl border border-border bg-card shadow-none">
                            <CardContent className="p-6">
                                <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto] md:items-start">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Lead Name</p>
                                        <p className="mt-2 text-xl font-semibold text-foreground">{data.call.leadName}</p>
                                        <div className="mt-6">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">AI Sentiment</p>
                                            <p className={cn("mt-2 text-sm font-semibold", sentiment.tone)}>{sentiment.label}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Outcome</p>
                                        <p className="mt-2 text-xl font-semibold text-primary">{outcomeLabel}</p>
                                        <div className="mt-6">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Cost & Duration</p>
                                            <p className="mt-2 text-sm font-semibold text-foreground">
                                                {formatDuration(data.call.durationSeconds)} <span className="text-muted-foreground">/</span> {formatEstimatedCost(data.call.durationSeconds)}
                                            </p>
                                        </div>
                                    </div>
                                    <CampaignStatusBadge status={data.call.callStatus} />
                                </div>
                                <div className="mt-8">
                                    {data.call.recordingUrl ? (
                                        <RecordingPlayer src={data.call.recordingUrl} />
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                                            Recording not available for this call.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border border-border bg-card shadow-none">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 text-primary">
                                    <Zap className="h-4 w-4" />
                                    <h2 className="text-sm font-bold uppercase tracking-[0.18em]">AI Executive Summary</h2>
                                </div>
                                <p className="mt-5 text-base leading-8 text-foreground/80">
                                    {data.call.summary ?? data.call.outcomeReason ?? data.call.errorMessage ?? "No AI summary available for this call."}
                                </p>
                            </CardContent>
                        </Card>

                        <div>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h2 className="text-lg font-semibold text-foreground">Full Transcript</h2>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 rounded-lg text-xs text-primary hover:bg-muted hover:text-primary/90"
                                    onClick={() => navigator.clipboard.writeText(data.call.transcript ?? "")}
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy Transcript
                                </Button>
                            </div>
                            <Card className="rounded-2xl border border-border bg-card shadow-none">
                                <CardContent className="p-6">
                                    <TranscriptThread transcript={data.call.transcript} />
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <aside className="space-y-5">
                        <Card className="rounded-2xl border border-border bg-card shadow-none">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2">
                                    <PhoneCall className="h-4 w-4 text-primary" />
                                    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-foreground">Interaction Timeline</h2>
                                </div>
                                <div className="mt-8">
                                    <Timeline data={data} />
                                </div>
                                <Button asChild className="mt-8 w-full rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
                                    <Link href={`/leads/${data.call.leadId}`}>
                                        <User2 className="h-4 w-4" />
                                        View Full Lead Profile
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <div>
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                                <FileText className="h-4 w-4 text-primary" />
                                System Events
                            </h2>
                            <div className="space-y-3">
                                {(data.webhookEvents.length > 0 ? data.webhookEvents : []).slice(0, 5).map((event) => (
                                    <Card key={String(event.eventId)} className="rounded-xl border border-border bg-card shadow-none">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--status-good)]" />
                                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">{formatEventName(event.eventType)}</p>
                                            </div>
                                            <p className="mt-2 text-[11px] text-muted-foreground">{formatDateTimeHumanReadable(event.eventTimestamp ?? event.receivedAt)}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                                {data.webhookEvents.length === 0 ? (
                                    <Card className="rounded-xl border border-dashed border-border bg-card shadow-none">
                                        <CardContent className="p-4 text-sm text-muted-foreground">No webhook events were stored for this call.</CardContent>
                                    </Card>
                                ) : null}
                            </div>
                        </div>

                        <Card className="rounded-2xl border border-border bg-muted shadow-none">
                            <CardContent className="space-y-4 p-5">
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Settings className="h-4 w-4 text-primary" />
                                    Metadata
                                </h2>
                                <div className="grid grid-cols-[92px_1fr] gap-y-2 text-xs">
                                    <span className="text-muted-foreground">Provider</span>
                                    <span className="truncate text-right text-foreground">retell / twilio</span>
                                    <span className="text-muted-foreground">Call ID</span>
                                    <span className="truncate text-right text-foreground">{data.call.retellCallId ?? "n/a"}</span>
                                    <span className="text-muted-foreground">Conversation</span>
                                    <span className="truncate text-right text-foreground">{data.call.retellConversationId ?? "n/a"}</span>
                                    <span className="text-muted-foreground">Duration</span>
                                    <span className="text-right text-[color:var(--status-good)]">{formatDuration(data.call.durationSeconds)}</span>
                                </div>
                                {extracted ? (
                                    <pre className="max-h-48 overflow-auto rounded-xl bg-card p-3 text-[11px] leading-5 text-foreground/80">
                                        {JSON.stringify(extracted, null, 2)}
                                    </pre>
                                ) : null}
                            </CardContent>
                        </Card>
                    </aside>
                </section>
            </div>
        </div>
    );
}
