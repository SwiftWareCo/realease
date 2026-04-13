"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Clock,
    Sparkles,
    User,
} from "lucide-react";
import { LeadProfileModal } from "@/app/(app)/leads/components/LeadProfileModal";
import { eventTypeConfig, type EnrichedEvent } from "./event-types";

interface UpcomingEventsPanelProps {
    upcomingEvents: EnrichedEvent[] | undefined;
    onMarkComplete: (eventId: Id<"events">, completed: boolean) => void;
    onEdit: (event: EnrichedEvent) => void;
    onSelectDate: (date: Date) => void;
    onAddEvent: () => void;
}

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

const dayLabel = (timestamp: number) => {
    const eventDate = new Date(timestamp);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (eventDate.toDateString() === today.toDateString()) return "Today";
    if (eventDate.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return eventDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
};

export function UpcomingEventsPanel({
    upcomingEvents,
    onMarkComplete,
    onEdit,
    onSelectDate,
    onAddEvent,
}: UpcomingEventsPanelProps) {
    const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(
        null,
    );

    const pending = (upcomingEvents ?? []).filter((e) => !e.is_completed);
    const priority = pending.slice(0, 2);
    const upcoming = pending.slice(0, 3);
    const advisorEvent = pending[0];

    return (
        <>
            <div className="flex h-full flex-col gap-4">
                <Button
                    size="lg"
                    onClick={onAddEvent}
                    className="h-11 w-full bg-gradient-to-r from-orange-500 to-orange-600 text-sm font-semibold uppercase tracking-wider text-white hover:from-orange-600 hover:to-orange-700"
                >
                    + Add Event
                </Button>

                <PriorityRemindersCard
                    events={priority}
                    onMarkComplete={onMarkComplete}
                />

                <UpcomingScheduleList
                    events={upcoming}
                    onSelectDate={onSelectDate}
                    onEdit={onEdit}
                    onLeadClick={(id) => setSelectedLeadId(id)}
                />

                <AIAdvisorCard event={advisorEvent} />
            </div>

            {selectedLeadId && (
                <LeadProfileModal
                    open={selectedLeadId !== null}
                    onOpenChange={(open) => {
                        if (!open) setSelectedLeadId(null);
                    }}
                    leadId={selectedLeadId}
                />
            )}
        </>
    );
}

function PriorityRemindersCard({
    events,
    onMarkComplete,
}: {
    events: EnrichedEvent[];
    onMarkComplete: (id: Id<"events">, completed: boolean) => void;
}) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="mb-3 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                    Priority Reminders
                </span>
            </div>
            {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    No reminders right now.
                </p>
            ) : (
                <div className="space-y-2">
                    {events.map((event) => (
                        <div
                            key={event._id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                        >
                            <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-foreground">
                                    {event.title}
                                </div>
                                <div className="truncate text-[11px] text-muted-foreground">
                                    {dayLabel(event.start_time)} •{" "}
                                    {formatTime(event.start_time)}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    onMarkComplete(event._id, true)
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent"
                                title="Mark complete"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function UpcomingScheduleList({
    events,
    onSelectDate,
    onEdit,
    onLeadClick,
}: {
    events: EnrichedEvent[];
    onSelectDate: (date: Date) => void;
    onEdit: (event: EnrichedEvent) => void;
    onLeadClick: (id: Id<"leads">) => void;
}) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Upcoming Schedule
                </span>
            </div>
            {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    No upcoming events.
                </p>
            ) : (
                <div className="space-y-3">
                    {events.map((event) => {
                        const config = eventTypeConfig[event.event_type];
                        const Icon = config.icon;
                        return (
                            <div
                                key={event._id}
                                className="group cursor-pointer rounded-lg border border-border/50 bg-background/40 p-3 transition-colors hover:bg-background/70"
                                onClick={() =>
                                    onSelectDate(new Date(event.start_time))
                                }
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${config.color} text-white`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                {dayLabel(event.start_time)}
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {formatTime(event.start_time)}
                                            </div>
                                        </div>
                                        <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
                                            {event.title}
                                        </div>
                                        {event.lead && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onLeadClick(
                                                        event.lead!._id,
                                                    );
                                                }}
                                                className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                            >
                                                <User className="h-3 w-3" />
                                                {event.lead.name}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-2 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(event);
                                        }}
                                        className="text-[11px] text-muted-foreground hover:text-foreground"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function AIAdvisorCard({ event }: { event: EnrichedEvent | undefined }) {
    const fallback =
        "Market trends suggest Tuesday mornings have higher engagement rates.";
    const text = event?.ai_preparation || fallback;

    return (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    AI Advisor
                </span>
            </div>
            <h4 className="text-sm font-semibold text-foreground">
                Reschedule Recommendation
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">{text}</p>
            <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                disabled
            >
                Reschedule Recommendation
            </Button>
        </div>
    );
}
