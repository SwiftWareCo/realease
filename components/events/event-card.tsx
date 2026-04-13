"use client";

import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { Bell, CheckCircle2, MapPin, Pencil, Phone, User } from "lucide-react";
import { eventTypeConfig, type EnrichedEvent } from "./event-types";

interface EventCardProps {
    event: EnrichedEvent;
    onMarkComplete?: (eventId: Id<"events">, completed: boolean) => void;
    onSetReminder?: () => void;
    onEdit: () => void;
    onOpenDossier: () => void;
    variant?: "default" | "expanded";
}

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

export function EventCard({
    event,
    onMarkComplete,
    onSetReminder,
    onEdit,
    onOpenDossier,
    variant = "default",
}: EventCardProps) {
    const config = eventTypeConfig[event.event_type];
    const isExpanded = variant === "expanded";

    return (
        <div
            className={`relative overflow-hidden rounded-xl border border-border/60 bg-card/60 ${
                event.is_completed ? "opacity-60" : ""
            }`}
        >
            <div
                className={`absolute left-0 top-0 h-full w-1 ${config.color}`}
                aria-hidden
            />
            <div className={`pl-4 ${isExpanded ? "p-4" : "p-3"}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div
                            className={`text-[10px] font-semibold uppercase tracking-wider ${config.textColor}`}
                        >
                            {config.label}
                        </div>
                        <h4
                            className={`mt-0.5 truncate font-semibold text-foreground ${
                                isExpanded ? "text-lg" : "text-sm"
                            } ${event.is_completed ? "line-through" : ""}`}
                        >
                            {event.title}
                        </h4>
                    </div>
                    <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {formatTime(event.start_time)}
                    </span>
                </div>

                {event.location && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{event.location}</span>
                    </div>
                )}

                {isExpanded && event.lead && (
                    <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Lead Contacts
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenDossier();
                                }}
                                className="flex items-center gap-2 min-w-0 text-left"
                            >
                                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                                    {(initial(event.lead.name) || "?").toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-foreground">
                                        {event.lead.name}
                                    </div>
                                    {typeof event.lead.urgency_score ===
                                        "number" && (
                                        <div className="truncate text-[11px] text-muted-foreground">
                                            Interest:{" "}
                                            {event.lead.urgency_score >= 75
                                                ? "High"
                                                : event.lead.urgency_score >= 50
                                                  ? "Medium"
                                                  : "Low"}{" "}
                                            ({Math.round(
                                                event.lead.urgency_score / 10,
                                            )}
                                            /10)
                                        </div>
                                    )}
                                </div>
                            </button>
                            <div className="flex items-center gap-1">
                                {event.lead.phone && (
                                    <a
                                        href={`tel:${event.lead.phone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent"
                                    >
                                        <Phone className="h-3.5 w-3.5" />
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenDossier();
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent"
                                >
                                    <User className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!isExpanded && event.lead && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenDossier();
                        }}
                        className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                        <User className="h-3 w-3" />
                        {event.lead.name}
                    </button>
                )}

                {event.ai_preparation && !event.is_completed && !isExpanded && (
                    <div className="mt-2 rounded-md bg-blue-500/10 px-2 py-1.5 text-[11px] text-blue-300">
                        💡 {event.ai_preparation}
                    </div>
                )}

                <div
                    className={`mt-3 flex flex-wrap gap-2 ${
                        isExpanded ? "" : "pt-1"
                    }`}
                >
                    {isExpanded && event.lead && (
                        <Button
                            size="sm"
                            className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenDossier();
                            }}
                        >
                            Open Dossier
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit();
                        }}
                    >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                    </Button>
                    {onMarkComplete && !isExpanded && (
                        <Button
                            size="sm"
                            variant={event.is_completed ? "outline" : "default"}
                            onClick={(e) => {
                                e.stopPropagation();
                                onMarkComplete(event._id, !event.is_completed);
                            }}
                        >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {event.is_completed ? "Undo" : "Complete"}
                        </Button>
                    )}
                    {onSetReminder && !isExpanded && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSetReminder();
                            }}
                        >
                            <Bell className="mr-1 h-3 w-3" />
                            Reminder
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function initial(name: string | undefined): string {
    return (name?.trim()?.[0] ?? "").toString();
}
