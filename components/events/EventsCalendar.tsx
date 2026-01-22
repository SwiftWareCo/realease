"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EventFormDialog } from "./EventFormDialog";
import { EventReminderDialog } from "./EventReminderDialog";
import { CalendarPanel } from "./CalendarPanel";
import { UpcomingEventsPanel } from "./UpcomingEventsPanel";
import type { EnrichedEvent } from "./event-types";

export function EventsCalendar() {
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isEventFormOpen, setIsEventFormOpen] = useState(false);
    const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(
        null,
    );
    const [reminderDialogEvent, setReminderDialogEvent] =
        useState<EnrichedEvent | null>(null);
    const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<EnrichedEvent | null>(
        null,
    );

    // Get first and last day of current viewed month for range query
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    const events = useQuery(api.events.queries.getEventsInRange, {
        startTime: startOfMonth.getTime(),
        endTime: endOfMonth.getTime(),
    }) as EnrichedEvent[] | undefined;

    // Get all upcoming events for the summary view
    const upcomingEvents = useQuery(api.events.queries.getUpcomingEvents, {
        limit: 10,
        daysAhead: 30,
    }) as EnrichedEvent[] | undefined;

    const markCompleted = useMutation(api.events.mutations.markEventCompleted);

    // Group events by date
    const eventsByDate = useMemo(() => {
        return (
            events?.reduce(
                (acc, event) => {
                    const dateKey = new Date(event.start_time).toDateString();
                    if (!acc[dateKey]) acc[dateKey] = [];
                    acc[dateKey].push(event);
                    return acc;
                },
                {} as Record<string, EnrichedEvent[]>,
            ) ?? {}
        );
    }, [events]);

    const selectedDateEvents = selectedDate
        ? (eventsByDate[selectedDate.toDateString()] ?? [])
        : [];

    // Generate calendar days for the current month
    const calendarDays = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startPadding = firstDay.getDay();
        const totalDays = lastDay.getDate();

        const days: (Date | null)[] = [];

        // Add padding for days before the first of the month
        for (let i = 0; i < startPadding; i++) {
            days.push(null);
        }

        // Add all days of the month
        for (let i = 1; i <= totalDays; i++) {
            days.push(new Date(currentYear, currentMonth, i));
        }

        return days;
    }, [currentMonth, currentYear]);

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
    };

    const handleAddEvent = () => {
        setEditingEvent(null);
        setSelectedEventDate(selectedDate || new Date());
        setIsEventFormOpen(true);
    };

    const handleMarkComplete = async (
        eventId: Id<"events">,
        completed: boolean,
    ) => {
        await markCompleted({ id: eventId, completed });
    };

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleMonthChange = (value: string) => {
        setCurrentMonth(parseInt(value));
    };

    const handleYearChange = (value: string) => {
        setCurrentYear(parseInt(value));
    };

    const handleBackToOverview = () => {
        setSelectedDate(null);
    };

    const handleOpenReminder = (event: EnrichedEvent) => {
        setReminderDialogEvent(event);
        setIsReminderDialogOpen(true);
    };

    // Generate year options (5 years back, 5 years forward)
    const yearOptions = useMemo(() => {
        const years: number[] = [];
        const thisYear = new Date().getFullYear();
        for (let i = thisYear - 5; i <= thisYear + 5; i++) {
            years.push(i);
        }
        return years;
    }, []);

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            <CalendarPanel
                currentMonth={currentMonth}
                currentYear={currentYear}
                calendarDays={calendarDays}
                eventsByDate={eventsByDate}
                selectedDate={selectedDate}
                onAddEvent={handleAddEvent}
                onDateSelect={handleDateClick}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onMonthChange={handleMonthChange}
                onYearChange={handleYearChange}
                yearOptions={yearOptions}
            />

            <UpcomingEventsPanel
                selectedDate={selectedDate}
                selectedDateEvents={selectedDateEvents}
                upcomingEvents={upcomingEvents}
                onBackToOverview={handleBackToOverview}
                onMarkComplete={handleMarkComplete}
                onSetReminder={handleOpenReminder}
                onEdit={(event) => {
                    setEditingEvent(event);
                    setIsEventFormOpen(true);
                }}
                onSelectDate={setSelectedDate}
            />

            <EventFormDialog
                open={isEventFormOpen}
                onOpenChange={setIsEventFormOpen}
                defaultDate={selectedEventDate ?? undefined}
                editEvent={editingEvent ?? undefined}
            />

            {reminderDialogEvent && (
                <EventReminderDialog
                    open={isReminderDialogOpen}
                    onOpenChange={setIsReminderDialogOpen}
                    event={reminderDialogEvent}
                />
            )}
        </div>
    );
}
