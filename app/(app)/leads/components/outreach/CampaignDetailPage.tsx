"use client";

import { startTransition, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    ArrowLeft,
    CalendarDays,
    Clock3,
    MessageSquare,
    Pause,
    Pencil,
    PhoneCall,
    Play,
    Plus,
    Sparkles,
} from "lucide-react";
import type { CampaignCallsData } from "./types";
import { getOutreachOutcomeLabel } from "@/lib/outreach/outcomes";
import {
    formatDateTimeHumanReadable,
    formatMinutesFromMidnightTo12Hour,
} from "@/utils/dateandtimes";
import { CampaignStatusBadge } from "./campaign-ui";
import { CampaignLeadAssignmentDialog } from "./CampaignLeadAssignmentDialog";
import { getEndMinutes, getStartMinutes } from "./time-utils";
import { cn } from "@/lib/utils";

function DetailSkeleton() {
    return (
        <div className="min-h-full bg-background p-6 md:p-8">
            <div className="mx-auto max-w-[1260px] space-y-5">
                <Skeleton className="h-20 rounded-2xl bg-muted" />
                <div className="grid gap-4 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-32 rounded-2xl bg-muted" />
                    ))}
                </div>
                <Skeleton className="h-[640px] rounded-2xl bg-muted" />
            </div>
        </div>
    );
}

function formatCompactNumber(value: number) {
    return new Intl.NumberFormat("en-US", {
        notation: value >= 1000 ? "compact" : "standard",
        maximumFractionDigits: value >= 1000 ? 1 : 0,
    }).format(value);
}

function formatDuration(seconds: number | null | undefined) {
    if (!seconds || seconds <= 0) {
        return "0m";
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) {
        return `${remainingSeconds}s`;
    }
    return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function formatCallType(status: string) {
    if (status === "queued") return "Queued";
    if (status === "ringing") return "Voice AI";
    if (status === "in_progress") return "Voice AI";
    if (status === "failed") return "System";
    return "Voice AI";
}

function leadStateTone(state: string) {
    if (state === "eligible" || state === "cooldown") return "text-[color:var(--status-good)]";
    if (state === "queued" || state === "in_progress") return "text-[color:var(--status-attention)]";
    if (state === "paused_for_realtor") return "text-[color:var(--status-special)]";
    if (state === "done" || state === "terminal_blocked") return "text-muted-foreground";
    return "text-foreground/70";
}

function formatStateLabel(state: string) {
    return state.replaceAll("_", " ");
}

function outcomeTone(outcome: string | null | undefined) {
    switch (outcome) {
        case "connected_interested":
        case "callback_requested":
            return "text-primary";
        case "connected_not_interested":
        case "do_not_call":
        case "wrong_number":
        case "failed":
            return "text-[color:var(--status-urgent)]";
        case "voicemail_left":
        case "no_answer":
            return "text-foreground/70";
        default:
            return "text-muted-foreground";
    }
}

function RuntimeFact({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
            <div className="mt-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <span className="text-primary">{icon}</span>
                <span className="truncate">{value}</span>
            </div>
        </div>
    );
}

function MetricTile({ label, value, hint, accent = "good" }: { label: string; value: string; hint: string; accent?: "good" | "primary" | "muted" }) {
    return (
        <Card className="rounded-2xl border border-border bg-card shadow-none">
            <CardContent className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
                <div className="mt-5 flex items-baseline gap-2">
                    <p className={cn("text-3xl font-semibold tracking-[-0.04em]", accent === "primary" ? "text-primary" : "text-foreground")}>{value}</p>
                    <span className={cn("text-[11px] font-semibold", accent === "good" ? "text-[color:var(--status-good)]" : accent === "primary" ? "text-primary" : "text-muted-foreground")}>{hint}</span>
                </div>
                <div className="mt-5 h-1 rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", accent === "primary" ? "w-2/5 bg-primary" : accent === "good" ? "w-3/4 bg-[color:var(--status-good)]" : "w-1/2 bg-muted-foreground")} />
                </div>
            </CardContent>
        </Card>
    );
}

export function CampaignDetailPage({ campaignId }: { campaignId: string }) {
    const router = useRouter();
    const dataRaw = useQuery(api.outreach.queries.getCampaignCallAttempts, {
        campaignId: campaignId as Id<"outreachCampaigns">,
        limit: 200,
    });
    const updateCampaign = useMutation(api.outreach.mutations.updateCampaignSettings);
    const startOutreach = useAction(api.outreach.actions.startCampaignOutreach);

    const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(null);
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [isAssigningLeads, setIsAssigningLeads] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    if (dataRaw === undefined) {
        return <DetailSkeleton />;
    }

    const data = dataRaw as CampaignCallsData;
    const selectedLead =
        data.campaignLeads.find((lead) => lead.leadId === selectedLeadId) ??
        data.campaignLeads[0] ??
        null;
    const selectedLeadCalls = selectedLead
        ? data.calls.filter((call) => call.leadId === selectedLead.leadId)
        : [];
    const connectedCount = data.calls.filter(
        (call) => call.outcome === "connected_interested",
    ).length;
    const meetingsBooked = data.calls.filter(
        (call) =>
            call.outcome === "connected_interested" ||
            call.outcome === "callback_requested",
    ).length;
    const totalCalls = data.summary.total;
    const successRate =
        totalCalls > 0 ? Math.round((connectedCount / totalCalls) * 1000) / 10 : 0;
    const callDurations = data.calls
        .map((call) => call.durationSeconds)
        .filter((value): value is number => Boolean(value && value > 0));
    const averageDuration =
        callDurations.length === 0
            ? 0
            : Math.round(
                  callDurations.reduce((sum, value) => sum + value, 0) /
                      callDurations.length,
              );
    const runtime = data.campaign.runtimeSummary;
    const callingWindow = runtime?.callingWindow;
    const windowLabel = callingWindow
        ? `${formatMinutesFromMidnightTo12Hour(getStartMinutes(callingWindow))} - ${formatMinutesFromMidnightTo12Hour(getEndMinutes(callingWindow))}`
        : "Not configured";
    const handleToggleStatus = async () => {
        const nextStatus = data.campaign.status === "active" ? "paused" : "active";
        setIsUpdatingStatus(true);
        try {
            await updateCampaign({
                campaignId: data.campaign._id,
                status: nextStatus,
            });
            toast.success(
                nextStatus === "active" ? "Campaign resumed." : "Campaign paused.",
            );
        } catch (error) {
            console.error(error);
            toast.error("Failed to update campaign status.");
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleAssignLeads = async (leadIds: Id<"leads">[]) => {
        setIsAssigningLeads(true);
        try {
            await startOutreach({ campaignId: data.campaign._id, leadIds });
            toast.success(`Added ${leadIds.length} lead(s) to the campaign.`);
            setIsAssignDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to add leads to campaign.");
        } finally {
            setIsAssigningLeads(false);
        }
    };

    return (
        <div className="min-h-full bg-background px-4 py-5 text-foreground md:px-7 md:py-6">
            <div className="mx-auto max-w-[1260px] space-y-5">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <Link
                            href="/leads/outreach"
                            className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to Dashboard
                        </Link>
                        <div className="mt-5 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                            <CampaignStatusBadge status={data.campaign.status} />
                            <span>Started {formatDateTimeHumanReadable(data.campaign.createdAt)}</span>
                        </div>
                        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-foreground md:text-5xl">
                            {data.campaign.name}
                        </h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {data.campaign.description ?? data.campaign.campaignFocus?.goal ?? "Targeting high-intent leads for timely AI-assisted outreach and follow-up handoffs."}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-12 rounded-lg border-border bg-muted px-7 text-foreground hover:bg-accent"
                            onClick={handleToggleStatus}
                            disabled={isUpdatingStatus}
                        >
                            {data.campaign.status === "active" ? (
                                <>
                                    <Pause className="h-4 w-4" />
                                    Pause Campaign
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4" />
                                    Resume Campaign
                                </>
                            )}
                        </Button>
                        <Button asChild className="h-12 rounded-lg bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/90">
                            <Link href={`/leads/outreach/${data.campaign._id}/edit`}>
                                <Pencil className="h-4 w-4" />
                                Edit Workflow
                            </Link>
                        </Button>
                    </div>
                </header>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricTile label="Total Calls Made" value={formatCompactNumber(totalCalls)} hint={`${data.summary.queued + data.summary.in_progress} active`} />
                    <MetricTile label="Successful Connections" value={formatCompactNumber(connectedCount)} hint={`${successRate}% rate`} />
                    <MetricTile label="Meetings Booked" value={formatCompactNumber(meetingsBooked)} hint="High" accent="primary" />
                    <MetricTile label="Avg. Call Duration" value={formatDuration(averageDuration)} hint="" accent="muted" />
                </section>

                <Card className="rounded-2xl border border-border bg-card shadow-none">
                    <CardContent className="p-5 md:p-6">
                        <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                                <Sparkles className="h-4 w-4" />
                            </span>
                            <h2 className="text-sm font-semibold text-foreground">Campaign Runtime Rules</h2>
                        </div>
                        <div className="mt-6 grid gap-5 md:grid-cols-4">
                            <RuntimeFact label="Calling Window" value={windowLabel} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                            <RuntimeFact label="Next Window" value={data.campaign.status === "active" ? "Active now" : "Paused"} icon={<Clock3 className="h-3.5 w-3.5" />} />
                            <RuntimeFact label="Cadence" value={`${runtime?.maxAttempts ?? 0} attempts, ${runtime?.cooldownMinutes ?? 0} minutes between`} icon={<PhoneCall className="h-3.5 w-3.5" />} />
                            <RuntimeFact label="Follow Up SMS" value={runtime?.followUpSms.enabled ? "Enabled" : "Disabled"} icon={<MessageSquare className="h-3.5 w-3.5" />} />
                        </div>
                    </CardContent>
                </Card>

                <section className="grid gap-5 xl:grid-cols-[315px_minmax(0,1fr)]">
                    <Card className="rounded-2xl border border-border bg-card shadow-none">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-foreground/80">Contacted Leads</h2>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 rounded-md bg-primary px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground hover:bg-primary/90"
                                    onClick={() => setIsAssignDialogOpen(true)}
                                >
                                    Add
                                </Button>
                            </div>
                            <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Search leads...</div>
                            <div className="mt-3 space-y-1.5">
                                {data.campaignLeads.length > 0 ? (
                                    data.campaignLeads.slice(0, 12).map((lead) => {
                                        const selected = selectedLead?.leadId === lead.leadId;
                                        return (
                                            <button
                                                key={lead.leadId}
                                                type="button"
                                                onClick={() => setSelectedLeadId(lead.leadId)}
                                                className={cn(
                                                    "w-full rounded-xl px-3 py-2.5 text-left transition",
                                                    selected ? "bg-accent" : "hover:bg-muted/60",
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-foreground">{lead.leadName}</p>
                                                        <p className="mt-1 truncate text-[11px] text-muted-foreground">{lead.leadPhone}</p>
                                                    </div>
                                                    <span className={cn("text-[9px] font-bold uppercase tracking-[0.14em]", leadStateTone(lead.campaignState))}>
                                                        {lead.campaignState.replaceAll("_", " ")}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">No leads assigned yet.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-border bg-card shadow-none">
                        <CardContent className="p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <h2 className="text-sm font-semibold text-foreground">
                                        Log: {selectedLead?.leadName ?? "No lead selected"}
                                    </h2>
                                    <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                        Viewing interactions for selected lead
                                    </p>
                                </div>
                                <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground md:grid-cols-[70px_minmax(150px,1.15fr)_minmax(120px,0.8fr)_minmax(140px,1fr)] lg:min-w-[560px]">
                                    <div className="min-w-0">
                                        <p>Attempts</p>
                                        <strong className="mt-2 block text-sm text-foreground">
                                            {selectedLead?.attempts ?? 0}
                                        </strong>
                                    </div>
                                    <div className="min-w-0">
                                        <p>State</p>
                                        <strong
                                            className={cn(
                                                "mt-2 block max-w-[180px] whitespace-normal break-words text-sm leading-4 tracking-[0.14em]",
                                                selectedLead
                                                    ? leadStateTone(selectedLead.campaignState)
                                                    : "text-muted-foreground",
                                            )}
                                        >
                                            {selectedLead
                                                ? formatStateLabel(
                                                      selectedLead.campaignState,
                                                  )
                                                : "-"}
                                        </strong>
                                    </div>
                                    <div className="min-w-0">
                                        <p>Last Status</p>
                                        <strong className="mt-2 block truncate text-sm tracking-[0.12em] text-foreground">
                                            {selectedLead?.latestCallStatus ?? "-"}
                                        </strong>
                                    </div>
                                    <div className="min-w-0">
                                        <p>Last Outcome</p>
                                        <strong className="mt-2 block max-w-[170px] whitespace-normal break-words text-sm leading-4 tracking-[0.14em] text-primary">
                                            {selectedLead?.latestOutcome
                                                ? getOutreachOutcomeLabel(
                                                      selectedLead.latestOutcome,
                                                  )
                                                : "-"}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-[110px_90px_110px_minmax(150px,0.8fr)_minmax(220px,1.4fr)] gap-5 border-b border-border pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground max-lg:hidden">
                                <span>Date/Time</span>
                                <span>Type</span>
                                <span>Status</span>
                                <span>Outcome</span>
                                <span>AI Summary</span>
                            </div>
                            <div className="divide-y divide-border/60">
                                {selectedLeadCalls.length > 0 ? (
                                    selectedLeadCalls.map((call) => (
                                        <button
                                            key={call.callId}
                                            type="button"
                                            onClick={() =>
                                                startTransition(() => {
                                                    router.push(`/leads/outreach/${data.campaign._id}/calls/${call.callId}`);
                                                })
                                            }
                                            className="grid w-full gap-3 py-4 text-left transition hover:bg-muted/60 lg:grid-cols-[110px_90px_110px_minmax(150px,0.8fr)_minmax(220px,1.4fr)] lg:gap-5 lg:px-2"
                                        >
                                            <div className="whitespace-normal text-xs leading-5 text-muted-foreground">
                                                {formatDateTimeHumanReadable(
                                                    call.initiatedAt,
                                                )}
                                            </div>
                                            <div className="text-xs leading-5 text-foreground/70">
                                                {formatCallType(call.callStatus)}
                                            </div>
                                            <div>
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full border-[color:var(--status-good)]/30 bg-[color:var(--status-good)]/10 px-2 py-0 text-[9px] uppercase tracking-[0.14em] text-[color:var(--status-good)]"
                                                >
                                                    {call.callStatus}
                                                </Badge>
                                            </div>
                                            <div
                                                className={cn(
                                                    "whitespace-normal break-words text-xs font-semibold leading-5",
                                                    outcomeTone(call.outcome),
                                                )}
                                            >
                                                {call.outcome
                                                    ? getOutreachOutcomeLabel(
                                                          call.outcome,
                                                      )
                                                    : "-"}
                                            </div>
                                            <div className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                                                {call.summary ??
                                                    call.errorMessage ??
                                                    "Open report for details."}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-14 text-center text-sm text-muted-foreground">No interaction log for this lead yet.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </section>

            </div>

            <button
                type="button"
                aria-label="Add leads"
                onClick={() => setIsAssignDialogOpen(true)}
                className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-black/40 transition hover:bg-primary/90"
            >
                <Plus className="h-6 w-6" />
            </button>

            <CampaignLeadAssignmentDialog
                open={isAssignDialogOpen}
                onOpenChange={setIsAssignDialogOpen}
                campaignId={data.campaign._id}
                campaignName={data.campaign.name}
                isSubmitting={isAssigningLeads}
                onSubmit={handleAssignLeads}
            />
        </div>
    );
}
