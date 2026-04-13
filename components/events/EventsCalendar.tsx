"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EventFormDialog } from "./EventFormDialog";
import { CalendarPanel } from "./CalendarPanel";
import { UpcomingEventsPanel } from "./UpcomingEventsPanel";
import { SelectedDatePanel } from "./SelectedDatePanel";
import type { EnrichedEvent } from "./event-types";

export function EventsCalendar() {
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isEventFormOpen, setIsEventFormOpen] = useState(false);
    const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(
        null,
    );
    const [editingEvent, setEditingEvent] = useState<EnrichedEvent | null>(
        null,
    );

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    const events = useQuery(api.events.queries.getEventsInRange, {
        startTime: startOfMonth.getTime(),
        endTime: endOfMonth.getTime(),
    }) as EnrichedEvent[] | undefined;

    const upcomingEvents = useQuery(api.events.queries.getUpcomingEvents, {
        limit: 10,
        daysAhead: 30,
    }) as EnrichedEvent[] | undefined;

    const markCompleted = useMutation(api.events.mutations.markEventCompleted);

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

    const calendarDays = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startPadding = firstDay.getDay();
        const totalDays = lastDay.getDate();

        const days: (Date | null)[] = [];
        for (let i = 0; i < startPadding; i++) days.push(null);
        for (let i = 1; i <= totalDays; i++) {
            days.push(new Date(currentYear, currentMonth, i));
        }
        return days;
    }, [currentMonth, currentYear]);

    const handleDateClick = (date: Date) => {
        const key = date.toDateString();
        const dayEvents = eventsByDate[key] ?? [];
        if (dayEvents.length === 0) {
            setSelectedDate(null);
            return;
        }
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
        setSelectedDate(null);
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        setSelectedDate(null);
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleMonthChange = (value: string) => {
        setSelectedDate(null);
        setCurrentMonth(parseInt(value));
    };

    const handleYearChange = (value: string) => {
        setSelectedDate(null);
        setCurrentYear(parseInt(value));
    };

    const handleJumpToToday = () => {
        const now = new Date();
        setCurrentMonth(now.getMonth());
        setCurrentYear(now.getFullYear());
        setSelectedDate(null);
    };

    const handleBackToOverview = () => {
        setSelectedDate(null);
    };

    const handleSelectDateFromUpcoming = (date: Date) => {
        setCurrentMonth(date.getMonth());
        setCurrentYear(date.getFullYear());
        setSelectedDate(date);
    };

    const handleEditEvent = (event: EnrichedEvent) => {
        setEditingEvent(event);
        setIsEventFormOpen(true);
    };

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
                onDateSelect={handleDateClick}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onMonthChange={handleMonthChange}
                onYearChange={handleYearChange}
                onJumpToToday={handleJumpToToday}
                yearOptions={yearOptions}
            />

            {selectedDate ? (
                <SelectedDatePanel
                    selectedDate={selectedDate}
                    events={selectedDateEvents}
                    onBack={handleBackToOverview}
                    onAddEvent={handleAddEvent}
                    onEdit={handleEditEvent}
                />
            ) : (
                <UpcomingEventsPanel
                    upcomingEvents={upcomingEvents}
                    onMarkComplete={handleMarkComplete}
                    onEdit={handleEditEvent}
                    onSelectDate={handleSelectDateFromUpcoming}
                    onAddEvent={handleAddEvent}
                />
            )}

            <EventFormDialog
                open={isEventFormOpen}
                onOpenChange={setIsEventFormOpen}
                defaultDate={selectedEventDate ?? undefined}
                editEvent={editingEvent ?? undefined}
            />
        </div>
    );
}
