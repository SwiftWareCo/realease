"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOutreachOutcomeLabel } from "@/lib/outreach/outcomes";
import {
    formatDateTimeHumanReadable,
    formatHourTo12Hour,
} from "@/utils/dateandtimes";
import { WEEKDAYS } from "./constants";
import type { CampaignRuntimeSummary } from "./types";

function formatWeekdays(days: number[]): string {
    if (days.length === 7) {
        return "Every day";
    }
    return days
        .map((day) => WEEKDAYS.find((weekday) => weekday.value === day)?.label)
        .filter(Boolean)
        .join(", ");
}

function formatOutcome(value: string | null | undefined): string {
    return getOutreachOutcomeLabel(value) ?? value ?? "Unknown";
}

function formatRoutingAction(
    rule: NonNullable<CampaignRuntimeSummary>["outcomeRouting"][number],
): string {
    const actions = [
        rule.campaignLeadAction === "continue"
            ? "continues campaign calls"
            : null,
        rule.campaignLeadAction === "stop_calling"
            ? "stops campaign calls"
            : null,
        rule.campaignLeadAction === "pause_for_realtor"
            ? "pauses for realtor review"
            : null,
        rule.nextLeadStatus ? `status: ${rule.nextLeadStatus}` : null,
        rule.nextBuyerPipelineStage
            ? `buyer stage: ${rule.nextBuyerPipelineStage}`
            : null,
        rule.nextSellerPipelineStage
            ? `seller stage: ${rule.nextSellerPipelineStage}`
            : null,
        rule.sendFollowUpSms === true ? "SMS on" : null,
        rule.sendFollowUpSms === false ? "SMS off" : null,
        rule.hasCustomSmsTemplate ? "custom SMS" : null,
    ].filter(Boolean);

    return actions.length > 0 ? actions.join("; ") : "No visible update";
}

export function RuntimeSummaryCard({
    summary,
    title = "How This Campaign Runs",
    compact = false,
    embedded = false,
}: {
    summary: CampaignRuntimeSummary | null | undefined;
    title?: string;
    compact?: boolean;
    embedded?: boolean;
}) {
    if (!summary) {
        return null;
    }

    const followUpOutcomes = summary.followUpSms.enabled
        ? summary.followUpSms.outcomes
        : [];
    const visibleRoutingRules = summary.outcomeRouting.filter((rule) => {
        return (
            rule.nextLeadStatus ||
            rule.nextBuyerPipelineStage ||
            rule.nextSellerPipelineStage ||
            rule.sendFollowUpSms !== null ||
            rule.hasCustomSmsTemplate
        );
    });

    const Root = embedded ? "div" : Card;

    return (
        <Root
            className={
                embedded
                    ? "space-y-3 border-t pt-4"
                    : "border-primary/20 bg-primary/[0.03] shadow-sm"
            }
        >
            <CardHeader
                className={`${embedded ? "px-0" : ""} ${
                    compact ? "pb-2" : "space-y-2 pb-3"
                }`}
            >
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {summary.templateLabel} template v{summary.templateVersion}
                        </p>
                    </div>
                    <Badge
                        variant={
                            summary.dispatchMode === "immediate"
                                ? "secondary"
                                : "outline"
                        }
                    >
                        {summary.dispatchMode === "immediate"
                            ? "Can start now"
                            : "Queues for next window"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent
                className={`${embedded ? "px-0" : ""} space-y-3 text-sm`}
            >
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Calling Window
                        </p>
                        <p className="mt-1 font-medium">
                            {formatWeekdays(
                                summary.callingWindow.allowed_weekdays,
                            )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {formatHourTo12Hour(
                                summary.callingWindow.start_hour_local,
                            )}{" "}
                            -{" "}
                            {formatHourTo12Hour(
                                summary.callingWindow.end_hour_local,
                            )}
                        </p>
                    </div>
                    <div className="rounded-md border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Cadence
                        </p>
                        <p className="mt-1 font-medium">
                            {summary.maxAttempts} attempts max
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {summary.cooldownMinutes} minutes between attempts
                        </p>
                    </div>
                    <div className="rounded-md border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Next Window
                        </p>
                        <p className="mt-1 font-medium">
                            {summary.nextCallableAt
                                ? formatDateTimeHumanReadable(summary.nextCallableAt)
                                : "Ready now"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {summary.nextCallableAt
                                ? "Queued for next calling window"
                                : "Inside active calling window"}
                        </p>
                    </div>
                    <div className="rounded-md border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Follow-up SMS
                        </p>
                        <p className="mt-1 font-medium">
                            {summary.followUpSms.enabled ? "Enabled" : "Disabled"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {summary.followUpSms.enabled
                                ? `${summary.followUpSms.delayMinutes} minutes after final outcome`
                                : "No SMS will be queued"}
                        </p>
                    </div>
                </div>

                {!compact && (
                    <div className="grid gap-3 lg:grid-cols-3">
                        <div className="space-y-2 rounded-md border bg-background/70 p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                                Sends Follow-up SMS
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {followUpOutcomes.length > 0 ? (
                                    followUpOutcomes.map((outcome) => (
                                        <Badge key={outcome} variant="secondary">
                                            {formatOutcome(outcome)}
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-xs text-muted-foreground">
                                        No outcomes
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2 rounded-md border bg-background/70 p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                                Stops Outreach
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {summary.stopOutcomes.map((outcome) => (
                                    <Badge key={outcome} variant="outline">
                                        {formatOutcome(outcome)}
                                    </Badge>
                                ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Reaching max attempts also stops retries.
                            </p>
                        </div>
                        <div className="space-y-2 rounded-md border bg-background/70 p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                                Updates Lead Status Or Stage
                            </p>
                            <div className="space-y-1">
                                {visibleRoutingRules.length > 0 ? (
                                    visibleRoutingRules.map((rule) => (
                                        <p
                                            key={rule.outcome}
                                            className="text-xs text-muted-foreground"
                                        >
                                            <span className="font-medium text-foreground">
                                                {formatOutcome(rule.outcome)}:
                                            </span>{" "}
                                            {formatRoutingAction(rule)}
                                        </p>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        No visible status or stage updates.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Root>
    );
}
