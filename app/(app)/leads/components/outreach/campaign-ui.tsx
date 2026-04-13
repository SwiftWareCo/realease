"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { ReactNode } from "react";

export function formatCampaignCategory(value?: string | null) {
    switch (value) {
        case "acquisition":
            return "Acquisition";
        case "reactivation":
            return "Reactivation";
        case "listing":
            return "Listing";
        case "retention":
            return "Retention";
        default:
            return value ?? "Campaign";
    }
}

export function formatCampaignChannel(value?: string | null) {
    switch (value) {
        case "voice_ai":
            return "Voice AI";
        case "sms_ai":
            return "SMS AI";
        case "voice_and_sms":
            return "Voice + SMS";
        default:
            return value ?? "Configured";
    }
}

export function formatRelativeTimestamp(value?: number | null) {
    if (!value) {
        return "No recent activity";
    }
    return formatDistanceToNow(value, { addSuffix: true });
}

export function CampaignStatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const tone = {
        active: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        paused: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-200",
        draft: "border-border bg-muted text-muted-foreground",
        completed: "border-primary/30 bg-primary/10 text-primary",
        archived: "border-border bg-muted/60 text-muted-foreground",
    }[status] ?? "border-border bg-muted/60 text-muted-foreground";

    return (
        <Badge
            variant="outline"
            className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                tone,
                className,
            )}
        >
            {status}
        </Badge>
    );
}

export function CampaignFocusBadge({
    label,
    className,
}: {
    label: string;
    className?: string;
}) {
    return (
        <Badge
            variant="outline"
            className={cn(
                "rounded-full border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-primary",
                className,
            )}
        >
            {label}
        </Badge>
    );
}

export function CampaignMetricTile({
    label,
    value,
    hint,
    accent = "default",
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    accent?: "default" | "primary" | "success";
}) {
    return (
        <div
            className={cn(
                "rounded-[1.4rem] border px-5 py-4 shadow-sm backdrop-blur-sm",
                accent === "primary" &&
                    "border-primary/25 bg-primary/10",
                accent === "success" &&
                    "border-emerald-500/20 bg-emerald-500/10",
                accent === "default" && "border-border/60 bg-card",
            )}
        >
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {label}
            </p>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {value}
            </div>
            {hint ? (
                <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

export function CampaignBottomBar({
    left,
    center,
    right,
    className,
}: {
    left?: ReactNode;
    center?: ReactNode;
    right?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "sticky bottom-0 z-30 -mb-6 -mx-6 mt-6 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/90 md:-mb-8 md:-mx-8 md:px-8",
                className,
            )}
        >
            <div className="mx-auto flex max-w-[1400px] flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 xl:gap-6">
                <div className="min-w-0 flex items-center gap-3 overflow-hidden">
                    {left ? <div className="shrink-0">{left}</div> : null}
                    {center ? (
                        <div className="min-w-0 max-w-full overflow-hidden text-left">
                            {center}
                        </div>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 md:flex-nowrap md:justify-end md:gap-3 md:pl-2">
                    {right}
                </div>
            </div>
        </div>
    );
}

const WIZARD_STEPS = [
    { key: 1, label: "Identity" },
    { key: 2, label: "Scheduling" },
    { key: 3, label: "AI Script" },
    { key: 4, label: "Audience" },
] as const;

export function WizardStepIndicator({
    currentStep,
    maxStep = 4,
}: {
    currentStep: 1 | 2 | 3 | 4;
    maxStep?: 3 | 4;
}) {
    const visibleSteps = WIZARD_STEPS.filter((step) => step.key <= maxStep);

    return (
        <div className="flex items-center gap-1">
            {visibleSteps.map((step, index) => {
                const isDone = step.key < currentStep;
                const isActive = step.key === currentStep;
                return (
                    <div key={step.key} className="flex items-center gap-1">
                        {index > 0 && (
                            <div
                                className={cn(
                                    "h-px w-5",
                                    isDone ? "bg-primary" : "bg-border",
                                )}
                            />
                        )}
                        <div className="flex items-center gap-1.5">
                            <div
                                className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                                    isDone && "bg-primary text-primary-foreground",
                                    isActive &&
                                        "border-2 border-primary bg-primary/20 text-primary",
                                    !isDone &&
                                        !isActive &&
                                        "border border-border text-muted-foreground",
                                )}
                            >
                                {isDone ? "✓" : step.key}
                            </div>
                            <span
                                className={cn(
                                    "hidden text-xs 2xl:inline",
                                    isActive
                                        ? "font-medium text-foreground"
                                        : "text-muted-foreground",
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function CampaignSectionHeading({
    eyebrow,
    title,
    description,
    action,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
                {eyebrow ? (
                    <p className="text-[11px] uppercase tracking-[0.28em] text-primary/90">
                        {eyebrow}
                    </p>
                ) : null}
                <div className="space-y-1">
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                        {title}
                    </h1>
                    {description ? (
                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                            {description}
                        </p>
                    ) : null}
                </div>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}
