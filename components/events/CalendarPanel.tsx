"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { eventTypeConfig, type EnrichedEvent } from "./event-types";

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface CalendarPanelProps {
    currentMonth: number;
    currentYear: number;
    calendarDays: (Date | null)[];
    eventsByDate: Record<string, EnrichedEvent[]>;
    selectedDate: Date | null;
    onDateSelect: (date: Date) => void;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onMonthChange: (value: string) => void;
    onYearChange: (value: string) => void;
    onJumpToToday: () => void;
    yearOptions: number[];
}

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

export function CalendarPanel({
    currentMonth,
    currentYear,
    calendarDays,
    eventsByDate,
    selectedDate,
    onDateSelect,
    onPrevMonth,
    onNextMonth,
    onMonthChange,
    onYearChange,
    onJumpToToday,
    yearOptions,
}: CalendarPanelProps) {
    const todayKey = useMemo(() => new Date().toDateString(), []);
    const isToday = (date: Date) => date.toDateString() === todayKey;
    const isSelected = (date: Date) =>
        selectedDate?.toDateString() === date.toDateString();

    const monthEventCount = useMemo(
        () =>
            Object.values(eventsByDate).reduce((sum, ev) => sum + ev.length, 0),
        [eventsByDate],
    );

    return (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onPrevMonth}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <Select
                                value={currentMonth.toString()}
                                onValueChange={onMonthChange}
                            >
                                <SelectTrigger className="h-9 border-none bg-transparent px-0 text-2xl font-bold text-foreground hover:bg-transparent focus:ring-0 [&>svg]:opacity-50">
                                    <SelectValue>
                                        {MONTHS[currentMonth]}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((month, idx) => (
                                        <SelectItem
                                            key={month}
                                            value={idx.toString()}
                                        >
                                            {month}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={currentYear.toString()}
                                onValueChange={onYearChange}
                            >
                                <SelectTrigger className="h-9 border-none bg-transparent px-0 text-2xl font-bold text-foreground hover:bg-transparent focus:ring-0 [&>svg]:opacity-50">
                                    <SelectValue>{currentYear}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map((y) => (
                                        <SelectItem
                                            key={y}
                                            value={y.toString()}
                                        >
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {monthEventCount} active interactions this month
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onNextMonth}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <Button
                    size="sm"
                    onClick={onJumpToToday}
                    className="h-8 bg-emerald-500 text-xs font-semibold uppercase tracking-wider text-white hover:bg-emerald-600"
                >
                    Today
                </Button>
            </div>

            {/* Weekday header */}
            <div className="mb-2 grid grid-cols-7 gap-2">
                {WEEKDAYS.map((d) => (
                    <div
                        key={d}
                        className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                        {d}
                    </div>
                ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((date, index) => {
                    if (!date) {
                        return (
                            <div
                                key={`empty-${index}`}
                                className="min-h-[88px] rounded-lg border border-border/30 bg-background/20"
                            />
                        );
                    }

                    const dayEvents =
                        eventsByDate[date.toDateString()] ?? [];
                    const today = isToday(date);
                    const selected = isSelected(date);

                    return (
                        <button
                            type="button"
                            key={date.toISOString()}
                            onClick={() => onDateSelect(date)}
                            className={`relative flex min-h-[88px] flex-col rounded-lg border p-1.5 text-left transition-colors ${
                                selected
                                    ? "border-orange-500/60 bg-orange-500/10"
                                    : today
                                      ? "border-emerald-500/40 bg-emerald-500/5"
                                      : "border-border/40 bg-background/40 hover:bg-background/70"
                            }`}
                        >
                            <span
                                className={`text-xs font-semibold ${
                                    today
                                        ? "text-emerald-300"
                                        : "text-foreground"
                                }`}
                            >
                                {date.getDate()}
                            </span>
                            <div className="mt-1 flex flex-1 flex-col gap-1 overflow-hidden">
                                {dayEvents.slice(0, 2).map((event) => {
                                    const config =
                                        eventTypeConfig[event.event_type];
                                    return (
                                        <div
                                            key={event._id}
                                            className={`overflow-hidden rounded-sm px-1 py-0.5 ${config.bgColor}`}
                                        >
                                            <div
                                                className={`truncate text-[9px] font-semibold ${config.textColor}`}
                                            >
                                                {event.title}
                                            </div>
                                            <div
                                                className={`truncate text-[8px] ${config.textColor} opacity-80`}
                                            >
                                                {formatTime(event.start_time)}
                                            </div>
                                        </div>
                                    );
                                })}
                                {dayEvents.length > 2 && (
                                    <span className="text-[9px] text-muted-foreground">
                                        +{dayEvents.length - 2} more
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
