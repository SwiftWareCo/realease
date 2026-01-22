'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Plus,
} from 'lucide-react';
import { eventTypeConfig, type EnrichedEvent } from './event-types';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarPanelProps {
    currentMonth: number;
    currentYear: number;
    calendarDays: (Date | null)[];
    eventsByDate: Record<string, EnrichedEvent[]>;
    selectedDate: Date | null;
    onAddEvent: () => void;
    onDateSelect: (date: Date) => void;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onMonthChange: (value: string) => void;
    onYearChange: (value: string) => void;
    yearOptions: number[];
}

export function CalendarPanel({
    currentMonth,
    currentYear,
    calendarDays,
    eventsByDate,
    selectedDate,
    onAddEvent,
    onDateSelect,
    onPrevMonth,
    onNextMonth,
    onMonthChange,
    onYearChange,
    yearOptions,
}: CalendarPanelProps) {
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const todayKey = useMemo(() => new Date().toDateString(), []);

    const isToday = (date: Date) => date.toDateString() === todayKey;
    const isSelected = (date: Date) => selectedDate?.toDateString() === date.toDateString();

    return (
        <TooltipProvider>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5" />
                        Calendar
                    </CardTitle>
                    <Button onClick={onAddEvent} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Event
                    </Button>
                </CardHeader>

                <div className="border-t border-border/50 mx-4" />

                <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <Button variant="ghost" size="icon" onClick={onPrevMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Select value={currentMonth.toString()} onValueChange={onMonthChange}>
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((month, index) => (
                                        <SelectItem key={month} value={index.toString()}>
                                            {month}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={currentYear.toString()} onValueChange={onYearChange}>
                                <SelectTrigger className="w-[90px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map((year) => (
                                        <SelectItem key={year} value={year.toString()}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onNextMonth}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-7 gap-px mb-2 border-b border-border/30 pb-2">
                        {WEEKDAYS.map((day) => (
                            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-px bg-border/20 border border-border/30 rounded-lg overflow-hidden">
                        {calendarDays.map((date, index) => {
                            if (!date) {
                                return <div key={`empty-${index}`} className="aspect-square bg-background" />;
                            }

                            const dayEvents = eventsByDate[date.toDateString()] || [];
                            const hasEvents = dayEvents.length > 0;
                            const isTodayDate = isToday(date);
                            const isSelectedDate = isSelected(date);

                            return (
                                <div
                                    key={date.toISOString()}
                                    onClick={() => onDateSelect(date)}
                                    className={`
                                        aspect-square p-1 cursor-pointer transition-all bg-background
                                        hover:bg-accent
                                        ${isTodayDate && !isSelectedDate ? 'ring-1 ring-inset ring-primary' : ''}
                                        ${isSelectedDate ? 'bg-primary text-primary-foreground' : ''}
                                    `}
                                >
                                    <div className="h-full flex flex-col">
                                        <span className={`text-sm font-medium ${isSelectedDate ? 'text-primary-foreground' : ''}`}>
                                            {date.getDate()}
                                        </span>
                                        {hasEvents && (
                                            <div className="flex-1 flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                                                {dayEvents.slice(0, 3).map((event) => {
                                                    const config = eventTypeConfig[event.event_type];
                                                    return (
                                                        <Tooltip key={event._id}>
                                                            <TooltipTrigger asChild>
                                                                <div
                                                                    className={`h-1.5 w-full rounded-full ${config.dotColor} ${isSelectedDate ? 'opacity-70' : ''}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="max-w-[200px]">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                                                                    <span className="font-medium text-xs">{event.title}</span>
                                                                </div>
                                                                <div className="text-xs text-muted-foreground mt-1">
                                                                    {config.label} • {formatTime(event.start_time)}
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    );
                                                })}
                                                {dayEvents.length > 3 && (
                                                    <span
                                                        className={`text-[10px] ${isSelectedDate ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                                                    >
                                                        +{dayEvents.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 pt-4 border-t">
                        <div className="flex flex-wrap gap-3 text-xs">
                            {Object.entries(eventTypeConfig).map(([type, config]) => (
                                <div key={type} className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                                    <span className="text-muted-foreground">{config.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
