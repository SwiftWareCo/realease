"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
    formatDateHumanReadable,
    formatDateTimeHumanReadable,
    formatTimeTo12HourWithMinutes,
} from "@/utils/dateandtimes";
import {
    AlertTriangle,
    ArrowUpRight,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock3,
    Handshake,
    ListChecks,
    Loader2,
    MapPin,
    Phone,
    Quote,
    Radio,
    Route,
    UserRound,
    type LucideIcon,
} from "lucide-react";

type DashboardData = FunctionReturnType<
    typeof api.dashboard.queries.getDashboardHome
>;
type WorkItem = DashboardData["workQueue"][number];
type ScheduleItem = DashboardData["schedule"][number];
type CampaignRollup = DashboardData["outreach"]["campaigns"][number];

const DAILY_QUOTE = {
    text: "The best time to buy a home was 10 years ago. The second best time is now.",
    author: "Real Estate Wisdom",
};

function useClock() {
    const [time, setTime] = useState(() => new Date());

    useEffect(() => {
        const id = window.setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => window.clearInterval(id);
    }, []);

    return time;
}

function normalizeLabel(value: string) {
    return value.replace(/_/g, " ");
}

function formatDue(timestamp: number | null) {
    if (timestamp === null) {
        return "No due time";
    }

    const date = new Date(timestamp);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const time = formatTimeTo12HourWithMinutes(date);

    if (date.toDateString() === today.toDateString()) {
        return `Today at ${time}`;
    }
    if (date.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow at ${time}`;
    }
    return `${formatDateHumanReadable(date)} at ${time}`;
}

function priorityClass(priority: WorkItem["priority"]) {
    if (priority === "urgent") {
        return "border-[color:var(--status-urgent)]/30 bg-[color:var(--status-urgent)]/10 text-[color:var(--status-urgent)]";
    }
    if (priority === "high") {
        return "border-[color:var(--status-attention)]/30 bg-[color:var(--status-attention)]/10 text-[color:var(--status-attention)]";
    }
    if (priority === "normal") {
        return "border-[color:var(--status-info)]/30 bg-[color:var(--status-info)]/10 text-[color:var(--status-info)]";
    }
    return "border-border bg-muted/60 text-muted-foreground dark:bg-muted/40";
}

function priorityRailClass(priority: WorkItem["priority"]) {
    if (priority === "urgent") {
        return "border-l-[color:var(--status-urgent)]";
    }
    if (priority === "high") {
        return "border-l-[color:var(--status-attention)]";
    }
    if (priority === "normal") {
        return "border-l-[color:var(--status-info)]";
    }
    return "border-l-border";
}

function interactionClass(tone: "amber" | "blue" | "emerald" | "red" | "violet" = "blue") {
    const tones = {
        amber: "hover:bg-[color:var(--status-attention)]/10",
        blue: "hover:bg-[color:var(--status-info)]/10",
        emerald: "hover:bg-[color:var(--status-good)]/10",
        red: "hover:bg-[color:var(--status-urgent)]/10",
        violet: "hover:bg-[color:var(--status-special)]/10",
    };

    return cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "transition-[background-color,border-color,color,transform] duration-200 active:translate-y-px",
        tones[tone],
    );
}

function workTone(kind: WorkItem["kind"]) {
    if (kind === "callback" || kind === "campaign_problem") {
        return "red";
    }
    if (kind === "qualified_handoff") {
        return "emerald";
    }
    if (kind === "pipeline_gap") {
        return "violet";
    }
    return "blue";
}

function eventBadgeClass(eventType: ScheduleItem["eventType"]) {
    if (eventType === "showing" || eventType === "open_house") {
        return "border-[color:var(--status-good)]/30 bg-[color:var(--status-good)]/10 text-[color:var(--status-good)]";
    }
    if (eventType === "call" || eventType === "follow_up") {
        return "border-[color:var(--status-attention)]/30 bg-[color:var(--status-attention)]/10 text-[color:var(--status-attention)]";
    }
    if (eventType === "meeting") {
        return "border-[color:var(--status-info)]/30 bg-[color:var(--status-info)]/10 text-[color:var(--status-info)]";
    }
    return "border-border bg-muted/60 text-muted-foreground";
}

function workKindConfig(kind: WorkItem["kind"]) {
    if (kind === "callback") {
        return {
            label: "Callback",
            Icon: Phone,
            className:
                "border-[color:var(--status-urgent)]/30 bg-[color:var(--status-urgent)]/10 text-[color:var(--status-urgent)]",
        };
    }
    if (kind === "qualified_handoff") {
        return {
            label: "Handoff",
            Icon: Handshake,
            className:
                "border-[color:var(--status-good)]/30 bg-[color:var(--status-good)]/10 text-[color:var(--status-good)]",
        };
    }
    if (kind === "campaign_problem") {
        return {
            label: "Issue",
            Icon: AlertTriangle,
            className:
                "border-[color:var(--status-urgent)]/30 bg-[color:var(--status-urgent)]/10 text-[color:var(--status-urgent)]",
        };
    }
    if (kind === "pipeline_gap") {
        return {
            label: "Pipeline",
            Icon: Route,
            className:
                "border-[color:var(--status-special)]/30 bg-[color:var(--status-special)]/10 text-[color:var(--status-special)]",
        };
    }
    if (kind === "calendar_event") {
        return {
            label: "Calendar",
            Icon: CalendarDays,
            className:
                "border-[color:var(--status-info)]/30 bg-[color:var(--status-info)]/10 text-[color:var(--status-info)]",
        };
    }
    return {
        label: "Lead",
        Icon: UserRound,
        className:
            "border-[color:var(--status-info)]/30 bg-[color:var(--status-info)]/10 text-[color:var(--status-info)]",
    };
}

function CompactQuote() {
    return (
        <div className="mt-4 max-w-xl">
            <Quote
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
            />
            <p className="mt-2 line-clamp-2 font-serif text-sm italic leading-6 text-foreground/85">
                {DAILY_QUOTE.text}
            </p>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                — {DAILY_QUOTE.author}
            </p>
        </div>
    );
}

function MiniClock() {
    const time = useClock();
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();
    const secondDeg = seconds * 6;
    const minuteDeg = minutes * 6 + seconds * 0.1;
    const hourDeg = (hours % 12) * 30 + minutes * 0.5;

    return (
        <div className="mt-2 flex items-center gap-4">
            <div
                className="relative h-[72px] w-[72px] shrink-0"
                role="img"
                aria-label={`Current time: ${formatTimeTo12HourWithMinutes(time)}`}
            >
                <div className="absolute inset-0 rounded-full border border-primary/50 bg-popover shadow-inner">
                    {[...Array(12)].map((_, index) => (
                        <div
                            key={index}
                            className="absolute h-1 w-1 rounded-full bg-muted-foreground/45"
                            style={{
                                top: "50%",
                                left: "50%",
                                transform: `translate(-50%, -50%) rotate(${index * 30}deg) translateY(-29px)`,
                            }}
                            aria-hidden="true"
                        />
                    ))}
                    <div
                        className="absolute bottom-1/2 left-1/2 w-1 origin-bottom rounded-full bg-foreground transition-transform duration-300"
                        style={{
                            height: "20px",
                            transform: `translateX(-50%) rotate(${hourDeg}deg)`,
                        }}
                        aria-hidden="true"
                    />
                    <div
                        className="absolute bottom-1/2 left-1/2 w-0.5 origin-bottom rounded-full bg-primary transition-transform duration-300"
                        style={{
                            height: "27px",
                            transform: `translateX(-50%) rotate(${minuteDeg}deg)`,
                        }}
                        aria-hidden="true"
                    />
                    <div
                        className="absolute bottom-1/2 left-1/2 w-0.5 origin-bottom rounded-full bg-amber-500"
                        style={{
                            height: "30px",
                            transform: `translateX(-50%) rotate(${secondDeg}deg)`,
                            transition:
                                seconds === 0 ? "none" : "transform 200ms ease-out",
                        }}
                        aria-hidden="true"
                    />
                    <div
                        className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                        aria-hidden="true"
                    />
                </div>
            </div>
            <div className="min-w-0">
                <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
                    {formatTimeTo12HourWithMinutes(time)}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                    {formatDateHumanReadable(time)}
                </p>
            </div>
        </div>
    );
}

function TopMetric({
    label,
    value,
    hint,
    tone = "default",
}: {
    label: string;
    value: number;
    hint: string;
    tone?: "default" | "urgent" | "good";
}) {
    return (
        <div className="flex min-w-0 flex-col justify-center rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/45">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className="mt-1 flex items-baseline gap-2">
                <p
                    className={cn(
                        "text-2xl font-semibold tabular-nums tracking-tight",
                        tone === "urgent" && "text-[color:var(--status-attention)]",
                        tone === "good" && "text-[color:var(--status-good)]",
                    )}
                >
                    {value}
                </p>
                <p className="truncate text-xs text-muted-foreground">{hint}</p>
            </div>
        </div>
    );
}

function CockpitColumn({
    title,
    description,
    icon: Icon,
    action,
    variant = "quiet",
    children,
}: {
    title: string;
    description: string;
    icon: LucideIcon;
    action?: React.ReactNode;
    variant?: "action" | "quiet" | "review";
    children: React.ReactNode;
}) {
    return (
        <section
            className={cn(
                "flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:min-h-0",
                variant === "action" && "border-t-2 border-t-primary",
            )}
        >
            <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 font-serif text-sm font-semibold italic">
                        <Icon
                            className={cn(
                                "h-4 w-4 text-primary",
                                variant === "action" &&
                                    "drop-shadow-[0_0_6px_color-mix(in_oklab,var(--primary)_45%,transparent)]",
                            )}
                        />
                        {title}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                        {description}
                    </p>
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
                {children}
            </div>
        </section>
    );
}

function WorkQueueColumn({ items }: { items: WorkItem[] }) {
    if (items.length === 0) {
        return (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/25 dark:bg-accent/60 dark:text-accent-foreground dark:ring-accent-foreground/25">
                    <CheckCircle2 className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                    No urgent work right now
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    New leads, callbacks, follow-ups, and calendar commitments will appear here.
                </p>
            </div>
        );
    }

    return (
        <ol className="divide-y divide-border">
            {items.map((item) => {
                const config = workKindConfig(item.kind);
                const Icon = config.Icon;
                return (
                    <li key={item.id}>
                        <Link
                            href={item.href}
                            className={cn(
                                "group block border-l-2 px-4 py-3.5",
                                priorityRailClass(item.priority),
                                interactionClass(workTone(item.kind)),
                            )}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "rounded-sm capitalize",
                                        config.className,
                                    )}
                                >
                                    <Icon className="h-3 w-3" />
                                    {config.label}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "rounded-sm capitalize",
                                        priorityClass(item.priority),
                                    )}
                                >
                                    {item.priority}
                                </Badge>
                                {item.lead ? (
                                    <span className="truncate text-xs text-muted-foreground">
                                        {item.lead.intent} lead
                                    </span>
                                ) : null}
                            </div>
                            <div className="mt-2 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="truncate text-sm font-semibold text-foreground">
                                        {item.title}
                                    </h3>
                                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                                        {item.description}
                                    </p>
                                </div>
                                <span className="mt-0.5 shrink-0 text-xs font-semibold text-primary transition-transform duration-200 group-hover:translate-x-0.5">
                                    {item.actionLabel}
                                </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {formatDue(item.dueAt)}
                                </span>
                                {item.campaign ? (
                                    <span className="inline-flex min-w-0 items-center gap-1">
                                        <Radio className="h-3.5 w-3.5" />
                                        <span className="truncate">
                                            {item.campaign.name}
                                        </span>
                                    </span>
                                ) : null}
                            </div>
                        </Link>
                    </li>
                );
            })}
        </ol>
    );
}

function CalendarColumn({ items }: { items: ScheduleItem[] }) {
    if (items.length === 0) {
        return (
            <div className="flex h-full min-h-[220px] items-center px-4 text-sm text-muted-foreground">
                No scheduled events in the next seven days.
            </div>
        );
    }

    return (
        <div className="px-4 py-4">
            <div className="relative space-y-2 pl-4 before:absolute before:inset-y-2 before:left-1 before:w-px before:bg-border/80">
                {items.map((event) => (
                    <Link
                        key={event._id}
                        href={event.href}
                        className={cn(
                            "group relative block rounded-md px-3 py-2.5",
                            interactionClass("blue"),
                        )}
                    >
                        <span className="absolute left-[-0.85rem] top-4 h-2.5 w-2.5 rounded-full border-2 border-card bg-[color:var(--status-info)]" />
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                    {event.title}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {formatDateTimeHumanReadable(event.startTime)}
                                </p>
                            </div>
                            <Badge
                                variant="outline"
                                className={cn(
                                    "rounded-sm capitalize",
                                    eventBadgeClass(event.eventType),
                                )}
                            >
                                {normalizeLabel(event.eventType)}
                            </Badge>
                        </div>
                        {event.location ? (
                            <p className="mt-2 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                {event.location}
                            </p>
                        ) : null}
                        {event.lead ? (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                Linked to {event.lead.name}
                            </p>
                        ) : null}
                    </Link>
                ))}
            </div>
        </div>
    );
}

function isPauseItem(item: WorkItem) {
    return item.kind === "qualified_handoff" && /pause/i.test(item.title);
}

function outreachGroupTone(
    group: "callbacks" | "handoffs" | "paused" | "issues",
) {
    if (group === "callbacks") {
        return {
            badge: "border-[color:var(--status-urgent)]/30 bg-[color:var(--status-urgent)]/10 text-[color:var(--status-urgent)]",
            hover: "red" as const,
        };
    }
    if (group === "handoffs") {
        return {
            badge: "border-[color:var(--status-good)]/30 bg-[color:var(--status-good)]/10 text-[color:var(--status-good)]",
            hover: "emerald" as const,
        };
    }
    if (group === "issues") {
        return {
            badge: "border-[color:var(--status-urgent)]/30 bg-[color:var(--status-urgent)]/10 text-[color:var(--status-urgent)]",
            hover: "red" as const,
        };
    }
    return {
        badge: "border-[color:var(--status-special)]/30 bg-[color:var(--status-special)]/10 text-[color:var(--status-special)]",
        hover: "violet" as const,
    };
}

function OutreachReviewPanel({
    dashboard,
}: {
    dashboard: DashboardData;
}) {
    const outreachItems = dashboard.outreachReviewItems;
    const groups = [
        {
            id: "issues" as const,
            title: "Issues",
            count: dashboard.outreach.problems,
            description: "Failed calls, wrong numbers, scheduler errors",
            items: outreachItems.filter((item) => item.kind === "campaign_problem"),
            defaultOpen: dashboard.outreach.problems > 0,
        },
        {
            id: "callbacks" as const,
            title: "Callbacks",
            count: dashboard.outreach.callbacks,
            description: "People who asked to be called back",
            items: outreachItems.filter((item) => item.kind === "callback"),
            defaultOpen: false,
        },
        {
            id: "handoffs" as const,
            title: "AI handoffs",
            count: dashboard.outreach.interested,
            description: "Interested leads found by outreach",
            items: outreachItems.filter(
                (item) => item.kind === "qualified_handoff" && !isPauseItem(item),
            ),
            defaultOpen: false,
        },
        {
            id: "paused" as const,
            title: "Paused for review",
            count: dashboard.outreach.pausedForReview,
            description: "Campaigns stopped until you decide",
            items: outreachItems.filter(isPauseItem),
            defaultOpen: false,
        },
    ];

    return (
        <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:h-full xl:min-h-0">
            <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-serif text-base font-semibold italic">
                        <Radio className="h-4 w-4 text-primary" />
                        Outreach review
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Why campaign work needs you
                    </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/leads/outreach">
                        Open
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-gutter:stable]">
                <div className="space-y-2">
                    {groups.map((group) => (
                        <OutreachBucket key={group.id} group={group} />
                    ))}
                </div>

                {dashboard.outreach.campaigns.length > 0 ? (
                    <div className="mt-3 border-t border-border/60 pt-3">
                        <p className="px-1 text-xs font-medium text-muted-foreground">
                            Campaigns
                        </p>
                        <div className="mt-2 space-y-2">
                            {dashboard.outreach.campaigns.map((campaign) => (
                                <CampaignReviewRow
                                    key={campaign.campaignId}
                                    campaign={campaign}
                                />
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </aside>
    );
}

function OutreachBucket({
    group,
}: {
    group: {
        id: "callbacks" | "handoffs" | "paused" | "issues";
        title: string;
        count: number;
        description: string;
        items: WorkItem[];
        defaultOpen: boolean;
    };
}) {
    const tone = outreachGroupTone(group.id);

    return (
        <Collapsible
            defaultOpen={group.defaultOpen}
            className="overflow-hidden rounded-lg border border-border/60 bg-muted/25"
        >
            <CollapsibleTrigger
                className={cn(
                    "group flex w-full items-center justify-between gap-3 px-3 py-3 text-left",
                    interactionClass(tone.hover),
                )}
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{group.title}</p>
                        <Badge
                            variant="outline"
                            className={cn("rounded-sm", tone.badge)}
                        >
                            {group.count}
                        </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                        {group.description}
                    </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border/40">
                {group.items.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">
                        No visible queue items in this bucket.
                    </p>
                ) : (
                    <div className="divide-y divide-border">
                        {group.items.slice(0, 5).map((item) => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={cn(
                                    "group/item block px-3 py-3",
                                    interactionClass(tone.hover),
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="line-clamp-1 text-sm font-semibold">
                                            {item.title}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                            {item.description}
                                        </p>
                                    </div>
                                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform group-hover/item:translate-x-0.5" />
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>{formatDue(item.dueAt)}</span>
                                    {item.lead ? <span>{item.lead.name}</span> : null}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}

function CampaignReviewRow({ campaign }: { campaign: CampaignRollup }) {
    const needsAttention =
        campaign.callbacks + campaign.pausedForReview + campaign.problems;

    return (
        <Link
            href={campaign.href}
            className={cn(
                "group block rounded-lg border border-border/60 bg-muted/30 px-3 py-3",
                interactionClass(needsAttention > 0 ? "amber" : "emerald"),
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                        {campaign.campaignName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {campaign.activeLeads} active leads
                    </p>
                </div>
                <Badge
                    variant="outline"
                    className={cn(
                        "rounded-sm capitalize",
                        needsAttention > 0
                            ? "border-[color:var(--status-attention)]/30 bg-[color:var(--status-attention)]/10 text-[color:var(--status-attention)]"
                            : "border-[color:var(--status-good)]/30 bg-[color:var(--status-good)]/10 text-[color:var(--status-good)]",
                    )}
                >
                    {needsAttention > 0 ? `${needsAttention} review` : campaign.status}
                </Badge>
            </div>
        </Link>
    );
}

function TodayCockpit({ dashboard }: { dashboard: DashboardData }) {
    return (
        <section className="grid min-h-[760px] gap-5 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] xl:gap-6">
            <CockpitColumn
                title="Do now"
                description={`${dashboard.workQueue.length} dated actions`}
                icon={ListChecks}
                variant="action"
                action={
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/leads/network">
                            Leads
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    </Button>
                }
            >
                <WorkQueueColumn items={dashboard.workQueue} />
            </CockpitColumn>

            <CockpitColumn
                title="Calendar"
                description="Appointments and follow-ups"
                icon={CalendarDays}
                variant="quiet"
                action={
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/calendar">
                            Calendar
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    </Button>
                }
            >
                <CalendarColumn items={dashboard.schedule} />
            </CockpitColumn>
        </section>
    );
}

export function OperationalDashboard() {
    const dashboard = useQuery(api.dashboard.queries.getDashboardHome, {});

    if (dashboard === undefined) {
        return (
            <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-64px)] overflow-hidden bg-background text-foreground">
            <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-5 px-4 py-4 md:px-6">
                <header className="grid flex-shrink-0 gap-6 pb-1 xl:grid-cols-[minmax(260px,1fr)_230px_minmax(520px,620px)] xl:items-stretch">
                    <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Today
                        </p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance md:text-3xl">
                            Dashboard
                        </h1>
                        <CompactQuote />
                    </div>

                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Now
                        </p>
                        <MiniClock />
                    </div>

                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            At a glance
                        </p>
                        <div className="mt-2 grid gap-1 rounded-xl border border-border/60 bg-card/40 p-2 sm:grid-cols-2 xl:grid-cols-4">
                        <TopMetric
                            label="Due today"
                            value={dashboard.overview.dueTodayCount}
                            hint="queue items"
                            tone={
                                dashboard.overview.dueTodayCount > 0
                                    ? "urgent"
                                    : "default"
                            }
                        />
                        <TopMetric
                            label="High priority"
                            value={
                                dashboard.overview.urgentCount +
                                dashboard.overview.highPriorityCount
                            }
                            hint="needs action"
                            tone="urgent"
                        />
                        <TopMetric
                            label="Events today"
                            value={dashboard.overview.eventsToday}
                            hint="calendar"
                        />
                        <TopMetric
                            label="New leads"
                            value={dashboard.overview.newLeads}
                            hint="uncontacted"
                            tone="good"
                        />
                        </div>
                    </div>
                </header>

                <main className="min-h-0 flex-1 overflow-y-auto pr-1 xl:overflow-hidden">
                    <div className="grid min-h-[1120px] gap-6 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <TodayCockpit dashboard={dashboard} />
                        <OutreachReviewPanel dashboard={dashboard} />
                    </div>
                </main>
            </div>
        </div>
    );
}
