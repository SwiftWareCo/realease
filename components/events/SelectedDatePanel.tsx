"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft, CalendarDays, Clock, Plus } from "lucide-react";
import { LeadProfileModal } from "@/app/(app)/leads/components/LeadProfileModal";
import { EventCard } from "./event-card";
import type { EnrichedEvent } from "./event-types";

interface SelectedDatePanelProps {
    selectedDate: Date;
    events: EnrichedEvent[];
    onBack: () => void;
    onAddEvent: () => void;
    onEdit: (event: EnrichedEvent) => void;
}

const formatDateTitle = (date: Date) =>
    date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
    });

export function SelectedDatePanel({
    selectedDate,
    events,
    onBack,
    onAddEvent,
    onEdit,
}: SelectedDatePanelProps) {
    const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(
        null,
    );

    const isToday = selectedDate.toDateString() === new Date().toDateString();
    const pendingContacts = events.filter((e) => e.lead).length;

    return (
        <>
            <div className="flex h-full flex-col gap-4">
                <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-orange-400 hover:text-orange-300"
                        >
                            <ArrowLeft className="h-3 w-3" />
                            Selected Schedule
                        </button>
                        {isToday && (
                            <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-300">
                                Today
                            </span>
                        )}
                    </div>
                    <h2 className="mt-2 text-3xl font-bold text-foreground">
                        {formatDateTitle(selectedDate)}
                    </h2>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                            {events.length}{" "}
                            {events.length === 1 ? "Event" : "Events"} Scheduled
                        </span>
                        {pendingContacts > 0 && (
                            <>
                                <span>•</span>
                                <span>{pendingContacts} Contacts Pending</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
                    {events.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 py-10 text-center">
                            <CalendarDays className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">
                                No events scheduled
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-3"
                                onClick={onAddEvent}
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add Event
                            </Button>
                        </div>
                    ) : (
                        events.map((event) => (
                            <EventCard
                                key={event._id}
                                event={event}
                                variant="expanded"
                                onEdit={() => onEdit(event)}
                                onOpenDossier={() => {
                                    if (event.lead) {
                                        setSelectedLeadId(event.lead._id);
                                    }
                                }}
                            />
                        ))
                    )}
                </div>
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
