'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    Clock,
    MapPin,
    User,
    Plus,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Bell,
    ArrowLeft,
    Pencil,
} from 'lucide-react';
import { EventFormDialog } from './EventFormDialog';
import { EventReminderDialog } from './EventReminderDialog';
import { eventTypeConfig, type EnrichedEvent } from './event-types';
import Link from 'next/link';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function EventsCalendar() {
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isEventFormOpen, setIsEventFormOpen] = useState(false);
    const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
    const [reminderDialogEvent, setReminderDialogEvent] = useState<EnrichedEvent | null>(null);
    const [editingEvent, setEditingEvent] = useState<EnrichedEvent | null>(null);

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
        return events?.reduce((acc, event) => {
            const dateKey = new Date(event.start_time).toDateString();
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(event);
            return acc;
        }, {} as Record<string, EnrichedEvent[]>) ?? {};
    }, [events]);

    const selectedDateEvents = selectedDate ? (eventsByDate[selectedDate.toDateString()] ?? []) : [];

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

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
    };

    const handleAddEvent = () => {
        setSelectedEventDate(selectedDate || new Date());
        setIsEventFormOpen(true);
    };

    const handleMarkComplete = async (eventId: Id<'events'>, completed: boolean) => {
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

    // Generate year options (5 years back, 5 years forward)
    const yearOptions = useMemo(() => {
        const years: number[] = [];
        const thisYear = new Date().getFullYear();
        for (let i = thisYear - 5; i <= thisYear + 5; i++) {
            years.push(i);
        }
        return years;
    }, []);

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isSelected = (date: Date) => {
        return selectedDate?.toDateString() === date.toDateString();
    };

    return (
        <TooltipProvider>
            <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
                {/* Calendar */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            Calendar
                        </CardTitle>
                        <Button onClick={handleAddEvent} size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Add Event
                        </Button>
                    </CardHeader>

                    {/* Separator line */}
                    <div className="border-t border-border/50 mx-4" />

                    <CardContent className="pt-4">
                        {/* Month/Year Navigation */}
                        <div className="flex items-center justify-between mb-4">
                            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center gap-2">
                                <Select value={currentMonth.toString()} onValueChange={handleMonthChange}>
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
                                <Select value={currentYear.toString()} onValueChange={handleYearChange}>
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
                            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 gap-px mb-2 border-b border-border/30 pb-2">
                            {WEEKDAYS.map((day) => (
                                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid - thin borders around each square */}
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
                                        onClick={() => handleDateClick(date)}
                                        className={`
                                            aspect-square p-1 cursor-pointer transition-all bg-background
                                            hover:bg-accent
                                            ${isTodayDate && !isSelectedDate ? 'ring-1 ring-inset ring-primary' : ''}
                                            ${isSelectedDate ? 'bg-primary text-primary-foreground' : ''}
                                        `}
                                    >
                                        <div className="h-full flex flex-col">
                                            <span className={`text-sm font-medium ${isSelected(date) ? 'text-primary-foreground' : ''}`}>
                                                {date.getDate()}
                                            </span>
                                            {/* Event Indicators */}
                                            {hasEvents && (
                                                <div className="flex-1 flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                                                    {dayEvents.slice(0, 3).map((event) => {
                                                        const config = eventTypeConfig[event.event_type];
                                                        return (
                                                            <Tooltip key={event._id}>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        className={`h-1.5 w-full rounded-full ${config.dotColor} ${isSelected(date) ? 'opacity-70' : ''}`}
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
                                                        <span className={`text-[10px] ${isSelected(date) ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
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

                        {/* Event Type Legend */}
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

                {/* Right Panel: Either Selected Date Events or Upcoming Summary */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        {selectedDate ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={handleBackToOverview} className="h-8 w-8">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <CardTitle className="text-lg">
                                        {selectedDate.toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </CardTitle>
                                </div>
                                <Button size="sm" variant="outline" onClick={handleAddEvent}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add
                                </Button>
                            </>
                        ) : (
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CalendarDays className="h-5 w-5" />
                                Upcoming Events
                            </CardTitle>
                        )}
                    </CardHeader>
                    <CardContent className="max-h-[600px] overflow-y-auto">
                        {selectedDate ? (
                            // Selected Date View
                            selectedDateEvents.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                    <p>No events scheduled</p>
                                    <Button variant="outline" className="mt-4" onClick={handleAddEvent}>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Schedule Event
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedDateEvents.map((event) => (
                                        <EventCard
                                            key={event._id}
                                            event={event}
                                            onMarkComplete={handleMarkComplete}
                                            onSetReminder={() => setReminderDialogEvent(event)}
                                            onEdit={() => {
                                                setEditingEvent(event);
                                                setIsEventFormOpen(true);
                                            }}
                                        />
                                    ))}
                                </div>
                            )
                        ) : (
                            // Upcoming Events Summary View
                            !upcomingEvents || upcomingEvents.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                    <p>No upcoming events</p>
                                    <p className="text-sm mt-1">Click a date to schedule one</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {upcomingEvents.map((event) => {
                                        const eventDate = new Date(event.start_time);
                                        const today = new Date();
                                        const tomorrow = new Date(today);
                                        tomorrow.setDate(tomorrow.getDate() + 1);

                                        let dateLabel = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                        if (eventDate.toDateString() === today.toDateString()) {
                                            dateLabel = 'Today';
                                        } else if (eventDate.toDateString() === tomorrow.toDateString()) {
                                            dateLabel = 'Tomorrow';
                                        }

                                        const config = eventTypeConfig[event.event_type];
                                        const Icon = config.icon;

                                        return (
                                            <div
                                                key={event._id}
                                                className="p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                                                onClick={() => {
                                                    setSelectedDate(eventDate);
                                                }}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg ${config.color} text-white shrink-0`}>
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-medium text-sm truncate">{event.title}</h4>
                                                            <Badge variant="outline" className="text-[10px]">
                                                                {config.label}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                {dateLabel}
                                                            </Badge>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {formatTime(event.start_time)}
                                                            </span>
                                                        </div>
                                                        {event.lead && (
                                                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                                <User className="h-3 w-3" />
                                                                {event.lead.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </CardContent>
                </Card>

                {/* Event Form Dialog */}
                <EventFormDialog
                    open={isEventFormOpen}
                    onOpenChange={(open: boolean) => {
                        setIsEventFormOpen(open);
                        if (!open) setEditingEvent(null);
                    }}
                    defaultDate={selectedEventDate ?? undefined}
                    editEvent={editingEvent ?? undefined}
                />

                {/* Reminder Dialog */}
                {reminderDialogEvent && (
                    <EventReminderDialog
                        open={!!reminderDialogEvent}
                        onOpenChange={(open) => !open && setReminderDialogEvent(null)}
                        event={reminderDialogEvent}
                    />
                )}
            </div>
        </TooltipProvider>
    );
}

// Separate EventCard component for better organization
interface EventCardProps {
    event: EnrichedEvent;
    onMarkComplete: (eventId: Id<'events'>, completed: boolean) => void;
    onSetReminder: () => void;
    onEdit: () => void;
}

function EventCard({ event, onMarkComplete, onSetReminder, onEdit }: EventCardProps) {
    const config = eventTypeConfig[event.event_type];
    const Icon = config.icon;

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    return (
        <Card className={`${event.is_completed ? 'opacity-60' : ''} hover:shadow-md transition-shadow`}>
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config.color} text-white shrink-0`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`font-medium ${event.is_completed ? 'line-through' : ''}`}>
                                {event.title}
                            </h4>
                            <Badge variant="outline" className={`text-xs ${config.textColor} border-current`}>
                                {config.label}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(event.start_time)} - {formatTime(event.end_time)}
                            </span>
                        </div>

                        {event.location && (
                            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{event.location}</span>
                            </div>
                        )}

                        {event.lead && (
                            <div className="flex items-center gap-1 mt-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <Link
                                    href={`/leads/${event.lead._id}`}
                                    className="text-sm text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {event.lead.name}
                                </Link>
                            </div>
                        )}

                        {event.ai_preparation && !event.is_completed && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs text-blue-700 dark:text-blue-300">
                                💡 {event.ai_preparation}
                            </div>
                        )}

                        {/* Reminder indicator */}
                        {event.reminder_config?.send_reminder && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <Bell className="h-3 w-3" />
                                Reminder set for {event.reminder_config.recipient}
                            </div>
                        )}

                        <div className="mt-3 flex gap-2 flex-wrap">
                            <Button
                                size="sm"
                                variant={event.is_completed ? 'outline' : 'default'}
                                onClick={() => onMarkComplete(event._id, !event.is_completed)}
                            >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {event.is_completed ? 'Undo' : 'Complete'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={onEdit}>
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={onSetReminder}>
                                <Bell className="h-3 w-3 mr-1" />
                                Reminder
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
