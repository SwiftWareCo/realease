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
        <div className="min-h-full bg-[#091121] p-6 md:p-8">
            <div className="mx-auto max-w-[1350px] space-y-5">
                <Skeleton className="h-20 rounded-2xl bg-slate-800/70" />
                <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
                    <Skeleton className="h-[760px] rounded-2xl bg-slate-800/70" />
                    <Skeleton className="h-[760px] rounded-2xl bg-slate-800/70" />
                </div>
            </div>
        </div>
    );
}

function deriveSentiment(outcome: string | null | undefined): { label: string; tone: string } {
    switch (outcome) {
        case "connected_interested":
        case "callback_requested":
            return { label: "Positive", tone: "text-emerald-300" };
        case "connected_not_interested":
        case "do_not_call":
        case "wrong_number":
        case "failed":
            return { label: "Negative", tone: "text-rose-300" };
        case "no_answer":
        case "voicemail_left":
            return { label: "Neutral", tone: "text-slate-400" };
        default:
            return { label: "Unknown", tone: "text-slate-400" };
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
            <div className="rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center text-sm text-slate-500">
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
                                agent ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700/60 text-slate-300",
                            )}
                        >
                            {agent ? <Bot className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-slate-200">
                                    {agent ? "Architect AI (Agent)" : "Lead"}
                                </p>
                                <span className="text-[10px] text-slate-600">{index + 1}s</span>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-400">{message.text}</p>
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
                            ? "border-emerald-300 bg-[#091121]"
                            : "border-slate-700 bg-[#111a2e]",
                    )}
                    markerInner={
                        event.active ? (
                            <Circle className="h-2 w-2 fill-emerald-300 text-emerald-300" />
                        ) : undefined
                    }
                    markerInnerClassName={event.active ? undefined : "bg-slate-500"}
                >
                    {event.active ? (
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Current Action</p>
                    ) : null}
                    <p className="mt-0.5 text-sm font-semibold text-slate-100">{event.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTimeHumanReadable(event.time)}</p>
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
        <div className="min-h-full bg-[#091121] px-4 py-5 text-slate-100 md:px-8 md:py-6">
            <div className="mx-auto max-w-[1350px] space-y-6">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
                            Call Report: {data.call.leadName}
                        </h1>
                        <p className="mt-1 text-xs text-slate-500">
                            Recorded {formatDateTimeHumanReadable(data.call.initiatedAt)}
                        </p>
                    </div>
                    <Button asChild variant="outline" className="rounded-lg border-slate-700 bg-[#172033] text-[#ffad86] hover:bg-[#1d2940]">
                        <Link href={`/leads/outreach/${data.campaign._id}`}>
                            <ArrowLeft className="h-4 w-4" />
                            Back to Log
                        </Link>
                    </Button>
                </header>

                <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
                    <div className="space-y-5">
                        <Card className="rounded-2xl border border-slate-800 bg-[#111a2e] shadow-none">
                            <CardContent className="p-6">
                                <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto] md:items-start">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Lead Name</p>
                                        <p className="mt-2 text-xl font-semibold text-white">{data.call.leadName}</p>
                                        <div className="mt-6">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">AI Sentiment</p>
                                            <p className={cn("mt-2 text-sm font-semibold", sentiment.tone)}>{sentiment.label}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Outcome</p>
                                        <p className="mt-2 text-xl font-semibold text-[#ffad86]">{outcomeLabel}</p>
                                        <div className="mt-6">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Cost & Duration</p>
                                            <p className="mt-2 text-sm font-semibold text-white">
                                                {formatDuration(data.call.durationSeconds)} <span className="text-slate-600">/</span> {formatEstimatedCost(data.call.durationSeconds)}
                                            </p>
                                        </div>
                                    </div>
                                    <CampaignStatusBadge status={data.call.callStatus} />
                                </div>
                                <div className="mt-8">
                                    {data.call.recordingUrl ? (
                                        <RecordingPlayer src={data.call.recordingUrl} />
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-700 px-5 py-8 text-center text-sm text-slate-500">
                                            Recording not available for this call.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border border-slate-800 bg-[#111a2e] shadow-none">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 text-[#ffad86]">
                                    <Zap className="h-4 w-4" />
                                    <h2 className="text-sm font-bold uppercase tracking-[0.18em]">AI Executive Summary</h2>
                                </div>
                                <p className="mt-5 text-base leading-8 text-slate-300">
                                    {data.call.summary ?? data.call.outcomeReason ?? data.call.errorMessage ?? "No AI summary available for this call."}
                                </p>
                            </CardContent>
                        </Card>

                        <div>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h2 className="text-lg font-semibold text-white">Full Transcript</h2>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 rounded-lg text-xs text-[#ffad86] hover:bg-[#172033] hover:text-[#ffbd9d]"
                                    onClick={() => navigator.clipboard.writeText(data.call.transcript ?? "")}
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy Transcript
                                </Button>
                            </div>
                            <Card className="rounded-2xl border border-slate-800 bg-[#111a2e] shadow-none">
                                <CardContent className="p-6">
                                    <TranscriptThread transcript={data.call.transcript} />
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <aside className="space-y-5">
                        <Card className="rounded-2xl border border-slate-800 bg-[#111a2e] shadow-none">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2">
                                    <PhoneCall className="h-4 w-4 text-[#ffad86]" />
                                    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-100">Interaction Timeline</h2>
                                </div>
                                <div className="mt-8">
                                    <Timeline data={data} />
                                </div>
                                <Button asChild className="mt-8 w-full rounded-lg bg-[#ffad86] font-semibold text-[#24140d] hover:bg-[#ffbd9d]">
                                    <Link href={`/leads/${data.call.leadId}`}>
                                        <User2 className="h-4 w-4" />
                                        View Full Lead Profile
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <div>
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                                <FileText className="h-4 w-4 text-[#ffad86]" />
                                System Events
                            </h2>
                            <div className="space-y-3">
                                {(data.webhookEvents.length > 0 ? data.webhookEvents : []).slice(0, 5).map((event) => (
                                    <Card key={String(event.eventId)} className="rounded-xl border border-slate-800 bg-[#111a2e] shadow-none">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-100">{formatEventName(event.eventType)}</p>
                                            </div>
                                            <p className="mt-2 text-[11px] text-slate-500">{formatDateTimeHumanReadable(event.eventTimestamp ?? event.receivedAt)}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                                {data.webhookEvents.length === 0 ? (
                                    <Card className="rounded-xl border border-dashed border-slate-800 bg-[#111a2e] shadow-none">
                                        <CardContent className="p-4 text-sm text-slate-500">No webhook events were stored for this call.</CardContent>
                                    </Card>
                                ) : null}
                            </div>
                        </div>

                        <Card className="rounded-2xl border border-slate-700 bg-[#2b354d] shadow-none">
                            <CardContent className="space-y-4 p-5">
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <Settings className="h-4 w-4 text-[#ffad86]" />
                                    Metadata
                                </h2>
                                <div className="grid grid-cols-[92px_1fr] gap-y-2 text-xs">
                                    <span className="text-slate-400">Provider</span>
                                    <span className="truncate text-right text-slate-100">retell / twilio</span>
                                    <span className="text-slate-400">Call ID</span>
                                    <span className="truncate text-right text-slate-100">{data.call.retellCallId ?? "n/a"}</span>
                                    <span className="text-slate-400">Conversation</span>
                                    <span className="truncate text-right text-slate-100">{data.call.retellConversationId ?? "n/a"}</span>
                                    <span className="text-slate-400">Duration</span>
                                    <span className="text-right text-emerald-300">{formatDuration(data.call.durationSeconds)}</span>
                                </div>
                                {extracted ? (
                                    <pre className="max-h-48 overflow-auto rounded-xl bg-[#111a2e] p-3 text-[11px] leading-5 text-slate-300">
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
