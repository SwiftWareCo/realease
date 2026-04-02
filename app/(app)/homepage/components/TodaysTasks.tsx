"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    CalendarDays,
    Phone,
    MessageCircle,
    Handshake,
    ArrowRight,
} from "lucide-react";

type TaskType = "call" | "follow_up" | "meeting";

interface TaskItem {
    id: string;
    title: string;
    leadId: string;
    urgency: number;
    type: TaskType;
}

function buildPriorityTasks(leads: Doc<"leads">[]): TaskItem[] {
    const tasks: TaskItem[] = [];

    for (const lead of leads) {
        if (lead.status === "new") {
            tasks.push({
                id: `${lead._id}-call`,
                title: `Call ${lead.name}`,
                leadId: String(lead._id),
                urgency: lead.urgency_score,
                type: "call",
            });
            continue;
        }

        if (lead.status === "contacted") {
            tasks.push({
                id: `${lead._id}-follow-up`,
                title: `Send follow-up to ${lead.name}`,
                leadId: String(lead._id),
                urgency: lead.urgency_score,
                type: "follow_up",
            });
            continue;
        }

        if (lead.status === "qualified") {
            tasks.push({
                id: `${lead._id}-meeting`,
                title: `Book next step with ${lead.name}`,
                leadId: String(lead._id),
                urgency: lead.urgency_score,
                type: "meeting",
            });
        }
    }

    return tasks.sort((a, b) => b.urgency - a.urgency);
}

function taskTypeBadge(type: TaskType) {
    if (type === "call") {
        return {
            label: "Call",
            className:
                "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
            Icon: Phone,
        };
    }
    if (type === "follow_up") {
        return {
            label: "Follow-up",
            className:
                "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
            Icon: MessageCircle,
        };
    }
    return {
        label: "Meeting",
        className:
            "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300",
        Icon: Handshake,
    };
}

export function TodaysTasks() {
    const allLeads = useQuery(api.leads.queries.getAllLeads);

    if (allLeads === undefined) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <CalendarDays
                            className="size-5 text-primary"
                            aria-hidden="true"
                        />
                        Today&apos;s Priority Tasks
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    const tasks = buildPriorityTasks(allLeads);
    const visibleTasks = tasks.slice(0, 3);
    const highUrgencyCount = tasks.filter((task) => task.urgency >= 70).length;

    return (
        <Card className="relative overflow-hidden h-full flex flex-col">
            <div
                className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/70 to-accent/70"
                aria-hidden="true"
            />

            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <CalendarDays
                            className="size-5 text-primary"
                            aria-hidden="true"
                        />
                        Today&apos;s Priority Tasks
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                        {tasks.length} queued
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                    Generated from live lead status and urgency.
                </p>
            </CardHeader>

            <CardContent className="flex flex-1 min-h-0 flex-col gap-3">
                {tasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-3 py-6 text-center">
                        <p className="text-sm text-muted-foreground">
                            No priority tasks right now.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0">
                        <div className="space-y-2 lg:max-h-[300px] overflow-y-auto scrollbar-hidden pr-1">
                            {visibleTasks.map((task) => {
                                const badge = taskTypeBadge(task.type);
                                const Icon = badge.Icon;
                                return (
                                    <Link
                                        key={task.id}
                                        href={`/leads/${task.leadId}`}
                                        className="group flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {task.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Urgency {task.urgency}/100
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={badge.className}>
                                                <Icon
                                                    className="size-3"
                                                    aria-hidden="true"
                                                />
                                                {badge.label}
                                            </Badge>
                                            <ArrowRight
                                                className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors"
                                                aria-hidden="true"
                                            />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2">
                    <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                            {highUrgencyCount}
                        </span>{" "}
                        high-urgency items today
                    </p>
                    <Link
                        href="/leads"
                        className="text-xs text-primary hover:text-primary/80"
                    >
                        Review all leads
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
