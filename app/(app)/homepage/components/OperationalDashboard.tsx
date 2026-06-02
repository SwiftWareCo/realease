"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
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
    ChevronRight,
    Clock3,
    Handshake,
    ListChecks,
    Loader2,
    MapPin,
    Pencil,
    Phone,
    Plus,
    Quote,
    Radio,
    Route,
    UserRound,
    type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

type DashboardData = FunctionReturnType<
    typeof api.dashboard.queries.getDashboardHome
>;
type WorkItem = DashboardData["workQueue"][number];
type ScheduleItem = DashboardData["schedule"][number];

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

function formatDateTimeLocal(timestamp: number | null) {
    if (timestamp === null) {
        return "";
    }

    const date = new Date(timestamp);
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
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
    if (kind === "campaign_problem") {
        return "red";
    }
    if (kind === "callback" || kind === "qualified_handoff") {
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
    if (kind === "manual_task") {
        return {
            label: "Task",
            Icon: ListChecks,
            className:
                "border-border bg-muted/60 text-muted-foreground dark:bg-muted/40",
        };
    }
    if (kind === "callback") {
        return {
            label: "Follow-up",
            Icon: Phone,
            className:
                "border-[color:var(--status-good)]/30 bg-[color:var(--status-good)]/10 text-[color:var(--status-good)]",
        };
    }
    if (kind === "qualified_handoff") {
        return {
            label: "Follow-up",
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

function WorkQueueColumn({
    items,
    onEditTask,
    onDismissTask,
}: {
    items: WorkItem[];
    onEditTask: (item: WorkItem) => void;
    onDismissTask: (taskId: Id<"tasks">) => void;
}) {
    if (items.length === 0) {
        return (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/25 dark:bg-accent/60 dark:text-accent-foreground dark:ring-accent-foreground/25">
                    <CheckCircle2 className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                    No personal tasks right now
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Tasks you create or accept from campaign review will appear here.
                </p>
            </div>
        );
    }

    return (
        <ol className="divide-y divide-border">
            {items.map((item) => {
                const config = workKindConfig(item.kind);
                const Icon = config.Icon;
                const content = (
                    <>
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
                            {item.task ? (
                                <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs"
                                        onClick={() => onEditTask(item)}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs"
                                        onClick={() => onDismissTask(item.task!._id)}
                                    >
                                        Done
                                    </Button>
                                </div>
                            ) : (
                                <span className="mt-0.5 shrink-0 text-xs font-semibold text-primary transition-transform duration-200 group-hover:translate-x-0.5">
                                    {item.actionLabel}
                                </span>
                            )}
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
                    </>
                );

                return (
                    <li key={item.id}>
                        {item.task ? (
                            <div
                                className={cn(
                                    "group block border-l-2 px-4 py-3.5",
                                    priorityRailClass(item.priority),
                                )}
                            >
                                {content}
                            </div>
                        ) : (
                            <Link
                                href={item.href}
                                className={cn(
                                    "group block border-l-2 px-4 py-3.5",
                                    priorityRailClass(item.priority),
                                    interactionClass(workTone(item.kind)),
                                )}
                            >
                                {content}
                            </Link>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

function CreateTaskDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const createTask = useMutation(api.tasks.mutations.createTask);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dueAt, setDueAt] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setDueAt("");
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            return;
        }

        try {
            setIsSaving(true);
            await createTask({
                title: trimmedTitle,
                description: description.trim() || undefined,
                due_at: dueAt ? new Date(dueAt).getTime() : undefined,
            });
            toast.success("Task created");
            resetForm();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to create task:", error);
            toast.error("Failed to create task");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>Create task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="task-title">Title</Label>
                        <Input
                            id="task-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Follow up with lender"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="task-due">Due date and time</Label>
                        <Input
                            id="task-due"
                            type="datetime-local"
                            value={dueAt}
                            onChange={(event) => setDueAt(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="task-description">Description</Label>
                        <Textarea
                            id="task-description"
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            placeholder="Add any context that helps later"
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!title.trim() || isSaving}
                        >
                            {isSaving ? "Creating..." : "Create task"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditTaskDialog({
    item,
    onOpenChange,
}: {
    item: WorkItem | null;
    onOpenChange: (open: boolean) => void;
}) {
    const updateTask = useMutation(api.tasks.mutations.updateTask);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dueAt, setDueAt] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!item) {
            return;
        }

        setTitle(item.title);
        setDescription(item.description === "Manual task" ? "" : item.description);
        setDueAt(formatDateTimeLocal(item.dueAt));
    }, [item]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!item?.task) {
            return;
        }

        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            return;
        }

        try {
            setIsSaving(true);
            await updateTask({
                id: item.task._id,
                title: trimmedTitle,
                description: description.trim() || undefined,
                due_at: dueAt ? new Date(dueAt).getTime() : undefined,
            });
            toast.success("Task updated");
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update task:", error);
            toast.error("Failed to update task");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={item !== null} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>Edit task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-task-title">Title</Label>
                        <Input
                            id="edit-task-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-task-due">Due date and time</Label>
                        <Input
                            id="edit-task-due"
                            type="datetime-local"
                            value={dueAt}
                            onChange={(event) => setDueAt(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-task-description">Description</Label>
                        <Textarea
                            id="edit-task-description"
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!title.trim() || isSaving}
                        >
                            {isSaving ? "Saving..." : "Save task"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
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
            <div className="relative space-y-2 pl-6 before:absolute before:inset-y-2 before:left-3 before:w-px before:bg-border/80">
                {items.map((event) => (
                    <Link
                        key={event._id}
                        href={event.href}
                        className={cn(
                            "group relative block rounded-md px-3 py-2.5",
                            interactionClass("blue"),
                        )}
                    >
                        <span className="absolute left-[-1.0625rem] top-4 h-2.5 w-2.5 rounded-full border-2 border-card bg-[color:var(--status-info)]" />
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

type OutcomeFilter = "all" | "followups" | "issues" | "paused";

function outcomeFilterForItem(item: WorkItem): Exclude<OutcomeFilter, "all"> {
    if (item.kind === "campaign_problem") {
        return "issues";
    }
    if (isPauseItem(item)) {
        return "paused";
    }
    return "followups";
}

function outcomeLabel(item: WorkItem) {
    const filter = outcomeFilterForItem(item);
    if (filter === "issues") {
        return "Issue";
    }
    if (filter === "paused") {
        return "Paused";
    }
    return "Follow-up";
}

function outcomeTone(item: WorkItem) {
    const filter = outcomeFilterForItem(item);
    if (filter === "issues") {
        return {
            badge: "border-[color:var(--status-urgent)]/30 bg-[color:var(--status-urgent)]/10 text-[color:var(--status-urgent)]",
            hover: "red" as const,
        };
    }
    if (filter === "followups") {
        return {
            badge: "border-[color:var(--status-good)]/30 bg-[color:var(--status-good)]/10 text-[color:var(--status-good)]",
            hover: "emerald" as const,
        };
    }
    return {
        badge: "border-[color:var(--status-special)]/30 bg-[color:var(--status-special)]/10 text-[color:var(--status-special)]",
        hover: "violet" as const,
    };
}

function reviewTitle(item: WorkItem) {
    const filter = outcomeFilterForItem(item);
    if (filter === "followups" && item.lead) {
        return `Follow up with ${item.lead.name}`;
    }
    return item.title;
}

function reviewDescription(item: WorkItem) {
    if (outcomeFilterForItem(item) !== "followups") {
        return item.description;
    }
    return item.description.replace(/\bcallbacks?\b/gi, "follow-up");
}

function OutreachReviewPanel({ dashboard }: { dashboard: DashboardData }) {
    const outreachItems = dashboard.outreachReviewItems;
    const [filter, setFilter] = useState<OutcomeFilter>("all");
    const followUpCount =
        dashboard.outreach.callbacks + dashboard.outreach.interested;
    const filters: { id: OutcomeFilter; label: string; count: number }[] = [
        {
            id: "all",
            label: "All",
            count: dashboard.overview.campaignReviewCount,
        },
        {
            id: "followups",
            label: "Follow-ups",
            count: followUpCount,
        },
        {
            id: "issues",
            label: "Issues",
            count: dashboard.outreach.problems,
        },
        {
            id: "paused",
            label: "Paused",
            count: dashboard.outreach.pausedForReview,
        },
    ];
    const visibleItems =
        filter === "all"
            ? outreachItems
            : outreachItems.filter((item) => outcomeFilterForItem(item) === filter);

    return (
        <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:h-full xl:min-h-0">
            <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-serif text-base font-semibold italic">
                        <Radio className="h-4 w-4 text-primary" />
                        Review inbox
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Follow-ups, issues, and paused outreach
                    </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/leads/outreach">
                        Open
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </Button>
            </header>

            <div className="border-b border-border/60 px-3 py-2">
                <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {filters.map((item) => (
                        <Button
                            key={item.id}
                            type="button"
                            variant={filter === item.id ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 shrink-0 gap-1.5 rounded-md px-2 text-xs"
                            onClick={() => setFilter(item.id)}
                        >
                            {item.label}
                            <span className="rounded-sm bg-background/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                                {item.count}
                            </span>
                        </Button>
                    ))}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-gutter:stable]">
                {visibleItems.length === 0 ? (
                    <div className="flex min-h-[180px] items-center rounded-lg border border-dashed border-border/70 px-4 text-sm text-muted-foreground">
                        No review items in this view.
                    </div>
                ) : (
                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                        {visibleItems.map((item) => {
                            const tone = outcomeTone(item);
                            return (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    className={cn(
                                        "group block px-3 py-3",
                                        interactionClass(tone.hover),
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "rounded-sm",
                                                        tone.badge,
                                                    )}
                                                >
                                                    {outcomeLabel(item)}
                                                </Badge>
                                                {item.lead ? (
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {item.lead.name}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 line-clamp-1 text-sm font-semibold">
                                                {reviewTitle(item)}
                                            </p>
                                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                                {reviewDescription(item)}
                                            </p>
                                        </div>
                                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span>{formatDue(item.dueAt)}</span>
                                        <span className="font-semibold text-primary">
                                            Open
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
}

function LeadQueueMetric({ dashboard }: { dashboard: DashboardData }) {
    const [settledPulse, setSettledPulse] = useState(false);
    const leadCount = dashboard.overview.newLeads;
    const visibleLeads = dashboard.leadQueue;

    useEffect(() => {
        const id = window.setTimeout(() => {
            setSettledPulse(true);
        }, 5200);

        return () => window.clearTimeout(id);
    }, []);

    return (
        <Sheet>
            <SheetTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "relative flex min-w-0 flex-col justify-center overflow-hidden rounded-lg px-3 py-2 text-left transition-[background-color,border-color,transform] duration-200 hover:bg-muted/45 active:translate-y-px",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                >
                    {leadCount > 0 ? (
                        <span
                            className={cn(
                                "pointer-events-none absolute inset-0 rounded-lg border border-[color:var(--status-good)]/35",
                                settledPulse
                                    ? "[animation:lead-queue-soft-pulse_4s_ease-in-out_infinite]"
                                    : "[animation:lead-queue-intro-pulse_1.15s_ease-out_infinite]",
                            )}
                            aria-hidden="true"
                        />
                    ) : null}
                    <span className="relative text-xs font-medium text-muted-foreground">
                        New leads
                    </span>
                    <span className="relative mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tabular-nums tracking-tight text-[color:var(--status-good)]">
                            {leadCount}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            need contact
                        </span>
                    </span>
                </button>
            </SheetTrigger>

            <SheetContent className="w-[min(92vw,540px)] gap-0 border-border bg-card p-0 sm:max-w-[540px]">
                <SheetHeader className="border-b border-border px-5 py-4">
                    <div className="flex items-start justify-between gap-8 pr-8">
                        <div>
                            <SheetTitle className="font-serif text-xl italic">
                                Lead queue
                            </SheetTitle>
                            <SheetDescription>
                                New leads waiting for first contact
                            </SheetDescription>
                        </div>
                        <Badge
                            variant="outline"
                            className="rounded-sm border-[color:var(--status-good)]/30 bg-[color:var(--status-good)]/10 text-[color:var(--status-good)]"
                        >
                            {leadCount} new
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="border-b border-border/60 px-5 py-3">
                    <Button asChild size="sm" className="w-full">
                        <Link href="/leads/network?status=new">
                            Open filtered lead list
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {visibleLeads.length === 0 ? (
                        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 px-6 text-center">
                            <CheckCircle2 className="h-7 w-7 text-[color:var(--status-good)]" />
                            <p className="mt-3 text-sm font-semibold">
                                No new leads waiting
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                Fresh inquiries will collect here before they become follow-ups or pipeline work.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {visibleLeads.map((lead) => (
                                <Link
                                    key={lead.id}
                                    href={lead.href}
                                    className={cn(
                                        "group block rounded-xl border border-border/60 bg-muted/20 px-3 py-3",
                                        interactionClass(
                                            lead.priority === "high"
                                                ? "amber"
                                                : "blue",
                                        ),
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "rounded-sm capitalize",
                                                        priorityClass(lead.priority),
                                                    )}
                                                >
                                                    {lead.priority}
                                                </Badge>
                                                {lead.lead ? (
                                                    <span className="text-xs text-muted-foreground">
                                                        {lead.lead.intent} lead
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 truncate text-sm font-semibold">
                                                {lead.lead?.name ?? lead.title}
                                            </p>
                                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                                {lead.description}
                                            </p>
                                        </div>
                                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                        <span>{formatDue(lead.dueAt)}</span>
                                        <span className="font-semibold text-primary">
                                            Open lead
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function TodayCockpit({
    dashboard,
    onAddTask,
    onEditTask,
    onDismissTask,
}: {
    dashboard: DashboardData;
    onAddTask: () => void;
    onEditTask: (item: WorkItem) => void;
    onDismissTask: (taskId: Id<"tasks">) => void;
}) {
    return (
        <section className="grid min-h-[760px] gap-5 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] xl:gap-6">
            <CockpitColumn
                title="Tasks"
                description={`${dashboard.workQueue.length} personal items`}
                icon={ListChecks}
                variant="action"
                action={
                    <Button variant="ghost" size="sm" onClick={onAddTask}>
                        <Plus className="h-4 w-4" />
                        New task
                    </Button>
                }
            >
                <WorkQueueColumn
                    items={dashboard.workQueue}
                    onEditTask={onEditTask}
                    onDismissTask={onDismissTask}
                />
            </CockpitColumn>

            <CockpitColumn
                title="Upcoming events"
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
    const dismissTask = useMutation(api.tasks.mutations.dismissTask);
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<WorkItem | null>(null);

    const handleDismissTask = async (taskId: Id<"tasks">) => {
        try {
            await dismissTask({ id: taskId });
            toast.success("Task done");
        } catch (error) {
            console.error("Failed to dismiss task:", error);
            toast.error("Failed to dismiss task");
        }
    };

    if (dashboard === undefined) {
        return (
            <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="relative h-[calc(100vh-64px)] overflow-hidden bg-background text-foreground">
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
                                hint="tasks"
                                tone={
                                    dashboard.overview.dueTodayCount > 0
                                        ? "urgent"
                                        : "default"
                                }
                            />
                            <TopMetric
                                label="Needs review"
                                value={dashboard.overview.campaignReviewCount}
                                hint="outreach"
                                tone="urgent"
                            />
                            <TopMetric
                                label="Events today"
                                value={dashboard.overview.eventsToday}
                                hint="calendar"
                            />
                            <LeadQueueMetric dashboard={dashboard} />
                        </div>
                    </div>
                </header>

                <main className="min-h-0 flex-1 overflow-y-auto pr-1 xl:overflow-hidden">
                    <div className="grid min-h-[1120px] gap-6 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <TodayCockpit
                            dashboard={dashboard}
                            onAddTask={() => setIsTaskDialogOpen(true)}
                            onEditTask={setEditingTask}
                            onDismissTask={handleDismissTask}
                        />
                        <OutreachReviewPanel dashboard={dashboard} />
                    </div>
                </main>
            </div>
            <CreateTaskDialog
                open={isTaskDialogOpen}
                onOpenChange={setIsTaskDialogOpen}
            />
            <EditTaskDialog
                item={editingTask}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingTask(null);
                    }
                }}
            />
        </div>
    );
}
