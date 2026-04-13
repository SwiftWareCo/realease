"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
    Clock3,
    Handshake,
    Loader2,
    Pencil,
    Phone,
    Plus,
    Radio,
    Trash2,
    Users,
} from "lucide-react";
import type { CampaignDashboardCampaign, CampaignDashboardData } from "./types";
import {
    CampaignStatusBadge,
    formatCampaignCategory,
    formatCampaignChannel,
    formatRelativeTimestamp,
} from "./campaign-ui";

function CampaignsDashboardSkeleton() {
    return (
        <div className="space-y-5 p-4 md:p-5">
            <Skeleton className="h-16 rounded-2xl" />
            <div className="grid gap-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                ))}
            </div>
            <div className="grid gap-3 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-[220px] rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

function formatMetricValue(value: number, suffix?: string) {
    const formatted = new Intl.NumberFormat("en-US").format(value);
    return suffix ? `${formatted}${suffix}` : formatted;
}

function deriveCampaignFrequency(campaign: CampaignDashboardCampaign) {
    const minutes = campaign.runtimeSummary?.cooldownMinutes;
    if (!minutes || minutes <= 0) {
        return "Manual";
    }
    if (minutes < 60 * 24) {
        return "Daily";
    }
    if (minutes < 60 * 24 * 7) {
        return "Weekly";
    }
    return "Long-cycle";
}

function deriveCampaignType(campaign: CampaignDashboardCampaign) {
    if (campaign.campaignFocus?.channel) {
        return formatCampaignChannel(campaign.campaignFocus.channel);
    }
    return campaign.templateLabel ?? "Configured";
}

function deriveCampaignSubtitle(campaign: CampaignDashboardCampaign) {
    if (campaign.campaignFocus?.goal) {
        return campaign.campaignFocus.goal;
    }
    if (campaign.description) {
        return campaign.description;
    }
    return "Persistent AI outreach campaign";
}

function getLeadChipLabel(campaign: CampaignDashboardCampaign) {
    if (campaign.leadPreview.length === 0) {
        return "No leads assigned";
    }
    if (campaign.leadPreview.length === 1) {
        return campaign.leadPreview[0]?.name ?? "Assigned lead";
    }
    return `${campaign.leadPreview[0]?.name ?? "Lead"} +${campaign.leadPreview.length - 1}`;
}

function CampaignMetricCard({
    label,
    value,
    hint,
    accent = false,
}: {
    label: string;
    value: string;
    hint: string;
    accent?: boolean;
}) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-xl border px-4 py-3",
                accent
                    ? "border-primary/60 bg-gradient-to-b from-card to-muted/50 shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                    : "border-border/60 bg-gradient-to-b from-card to-muted/40",
            )}
        >
            <p className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                {label}
            </p>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
                {value}
            </div>
            <div className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-primary">
                {hint}
            </div>
        </div>
    );
}

function PauseSwitch({
    checked,
    disabled,
    onToggle,
}: {
    checked: boolean;
    disabled: boolean;
    onToggle: () => void;
}) {
    return (
        <Switch
            checked={checked}
            aria-label={checked ? "Pause campaign" : "Resume campaign"}
            disabled={disabled}
            onCheckedChange={() => {
                if (disabled) return;
                onToggle();
            }}
            className={cn(
                "h-7 w-12 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
                "cursor-pointer disabled:cursor-not-allowed",
            )}
        />
    );
}

function CampaignCard({
    campaign,
    isUpdating,
    isDeleting,
    onTogglePause,
    onDelete,
}: {
    campaign: CampaignDashboardCampaign;
    isUpdating: boolean;
    isDeleting: boolean;
    onTogglePause: (campaign: CampaignDashboardCampaign) => void;
    onDelete: (campaign: CampaignDashboardCampaign) => void;
}) {
    const isActive = campaign.status === "active";
    const canDelete = campaign.counts.calls === 0;
    const handoffSignalCount =
        campaign.counts.pausedForReview + campaign.counts.callbacks;
    const hasHandoffSignals = handoffSignalCount > 0;

    return (
        <div
            className={cn(
                "flex h-full min-h-[290px] flex-col rounded-2xl border bg-gradient-to-b from-card to-muted/30 p-4 shadow-lg",
                hasHandoffSignals ? "border-amber-500/35" : "border-border/60",
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        {campaign.campaignFocus?.channel === "voice_ai" ? (
                            <Phone className="h-4 w-4" />
                        ) : (
                            <Radio className="h-4 w-4" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-[15px] font-semibold text-foreground">
                                {campaign.name}
                            </h3>
                            <CampaignStatusBadge
                                status={campaign.status}
                                className="border-border/70 bg-muted/40"
                            />
                            {hasHandoffSignals ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                                    <Handshake className="h-3 w-3" />
                                    Handoff
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 max-w-xl truncate text-[13px] leading-5 text-muted-foreground">
                            {deriveCampaignSubtitle(campaign)}
                        </p>
                    </div>
                </div>
                <PauseSwitch
                    checked={isActive}
                    disabled={isUpdating}
                    onToggle={() => onTogglePause(campaign)}
                />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-muted/40 px-3.5 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Frequency
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                        {deriveCampaignFrequency(campaign)}
                    </p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3.5 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Clients
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatMetricValue(campaign.counts.enrolled)}
                    </p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3.5 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Type
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                        {deriveCampaignType(campaign)}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{getLeadChipLabel(campaign)}</span>
                </div>
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1.5">
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{formatRelativeTimestamp(campaign.lastActivityAt)}</span>
                </div>
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1.5 text-foreground/80">
                    <span className="truncate">{formatCampaignCategory(campaign.campaignFocus?.category)}</span>
                </div>
            </div>

            {hasHandoffSignals ? (
                <Link
                    href={`/leads/outreach/${campaign._id}`}
                    className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-left transition hover:border-amber-500/40 hover:bg-amber-500/15"
                >
                    <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200" />
                    <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">
                            Human handoff needed
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            {formatMetricValue(campaign.counts.pausedForReview)} paused
                            for realtor review,{" "}
                            {formatMetricValue(campaign.counts.callbacks)} callback
                            signal{campaign.counts.callbacks === 1 ? "" : "s"}.
                        </span>
                    </span>
                </Link>
            ) : null}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 sm:flex-nowrap">
                <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-border/70 bg-transparent whitespace-nowrap"
                >
                    <Link href={`/leads/outreach/${campaign._id}/edit`} onClick={(event) => event.stopPropagation()}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </Button>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isDeleting}
                            className="rounded-full border-border/70 bg-transparent whitespace-nowrap disabled:opacity-40"
                        >
                            {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                            Delete
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-border/70 bg-card text-foreground">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                                {canDelete
                                    ? `This removes ${campaign.name}. Campaigns with call history must be kept and paused or archived instead.`
                                    : `${campaign.name} already has call history, so deletion is blocked. Pause it or keep it for reporting.`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="border-border/70 bg-transparent">
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                disabled={!canDelete || isDeleting}
                                onClick={(event) => {
                                    event.preventDefault();
                                    onDelete(campaign);
                                }}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Button
                    asChild
                    className="rounded-full bg-primary text-primary-foreground whitespace-nowrap hover:bg-primary/90"
                >
                    <Link href={`/leads/outreach/${campaign._id}`} onClick={(event) => event.stopPropagation()}>
                        View Campaign
                    </Link>
                </Button>
            </div>
        </div>
    );
}

function CreateCampaignCard() {
    return (
        <Link
            href="/leads/outreach/new"
            className="group flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-center transition-colors hover:border-primary/45 hover:bg-card/80"
        >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-muted/80 group-hover:text-primary">
                <Plus className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
                Create Campaign
            </h3>
            <p className="mt-1.5 max-w-xs text-xs leading-5 text-muted-foreground">
                Launch a new outreach flow with your existing templates, lead pool, and runtime settings.
            </p>
        </Link>
    );
}

export function CampaignsHomePage() {
    const router = useRouter();
    const dashboard = useQuery(api.outreach.queries.getCampaignDashboard, {});
    const updateCampaign = useMutation(api.outreach.mutations.updateCampaignSettings);
    const deleteCampaign = useMutation(api.outreach.mutations.deleteCampaign);
    const [busyCampaignId, setBusyCampaignId] = useState<Id<"outreachCampaigns"> | null>(null);
    const [deletingCampaignId, setDeletingCampaignId] = useState<Id<"outreachCampaigns"> | null>(null);

    if (dashboard === undefined) {
        return <CampaignsDashboardSkeleton />;
    }

    const data = dashboard as CampaignDashboardData;
    const campaigns = data.campaigns;

    const engagementRate =
        data.metrics.totalAssignedLeads > 0
            ? Math.round(
                  (data.metrics.interestedLeads /
                      data.metrics.totalAssignedLeads) *
                      1000,
              ) / 10
            : 0;
    const pausedForReview = campaigns.reduce(
        (sum, campaign) => sum + campaign.counts.pausedForReview,
        0,
    );
    const needsReview = pausedForReview + data.metrics.callbacksRequired;

    const metrics = [
        {
            label: "In sequence",
            value: formatMetricValue(data.metrics.liveLeads),
            hint: `${formatMetricValue(data.metrics.activeCampaigns)} active campaigns`,
            accent: false,
        },
        {
            label: "Interested",
            value: formatMetricValue(data.metrics.interestedLeads),
            hint: `${engagementRate.toFixed(1)}% engagement rate`,
            accent: true,
        },
        {
            label: "Human handoff",
            value: formatMetricValue(needsReview),
            hint: `${formatMetricValue(pausedForReview)} paused, ${formatMetricValue(data.metrics.callbacksRequired)} callback signals`,
            accent: false,
        },
    ];

    const handleTogglePause = async (campaign: CampaignDashboardCampaign) => {
        const nextStatus = campaign.status === "active" ? "paused" : "active";
        setBusyCampaignId(campaign._id);
        try {
            await updateCampaign({
                campaignId: campaign._id,
                status: nextStatus,
            });
            toast.success(
                nextStatus === "paused"
                    ? `${campaign.name} paused.`
                    : `${campaign.name} resumed.`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to update campaign status.";
            toast.error(message);
        } finally {
            setBusyCampaignId(null);
        }
    };

    const handleDelete = async (campaign: CampaignDashboardCampaign) => {
        setDeletingCampaignId(campaign._id);
        try {
            await deleteCampaign({ campaignId: campaign._id });
            toast.success(`${campaign.name} deleted.`);
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to delete campaign.";
            toast.error(message);
        } finally {
            setDeletingCampaignId(null);
        }
    };

    return (
        <div className="min-h-full bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_26%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))] px-4 py-3 text-foreground md:px-5 md:py-4">
            <div className="mx-auto max-w-[1400px]">
                <section className="rounded-2xl border border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_24%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)/0.45))] px-4 py-4 md:px-5 md:py-5">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="max-w-2xl">
                            <p className="text-[10px] uppercase tracking-[0.28em] text-primary">
                                Campaign intelligence
                            </p>
                            <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-foreground md:text-2xl">
                                Strategic Outreach
                            </h1>
                            <p className="mt-1 max-w-lg text-[13px] leading-6 text-muted-foreground">
                                Manage your campaigns, pause them when needed, and adjust strategy.
                            </p>
                            </div>

                            <div className="flex items-center justify-start lg:justify-end">
                                <Button
                                    asChild
                                    className="h-9 rounded-full bg-primary px-4 text-xs font-semibold uppercase tracking-[0.1em] text-primary-foreground hover:bg-primary/90"
                                >
                                    <Link href="/leads/outreach/new">
                                        <Plus className="h-3.5 w-3.5" />
                                        Create Campaign
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-3">
                            {metrics.map((metric) => (
                                <CampaignMetricCard
                                    key={metric.label}
                                    label={metric.label}
                                    value={metric.value}
                                    hint={metric.hint}
                                    accent={metric.accent}
                                />
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mt-5">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                                Operating campaigns
                            </p>
                            <h2 className="mt-1 text-lg font-semibold text-foreground">
                                Outreach portfolio
                            </h2>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                        {campaigns.map((campaign) => (
                            <CampaignCard
                                key={campaign._id}
                                campaign={campaign}
                                isUpdating={busyCampaignId === campaign._id}
                                isDeleting={deletingCampaignId === campaign._id}
                                onTogglePause={handleTogglePause}
                                onDelete={handleDelete}
                            />
                        ))}
                        <CreateCampaignCard />
                    </div>
                </section>
            </div>
        </div>
    );
}
