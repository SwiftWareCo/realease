'use client';

import { useState } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    Bell,
    CalendarDays,
    CheckCircle2,
    Clock,
    MapPin,
    Pencil,
    User,
} from 'lucide-react';
import { eventTypeConfig, type EnrichedEvent } from './event-types';
import { LeadProfileModal } from '@/components/leads/LeadProfileModal';

interface UpcomingEventsPanelProps {
    selectedDate: Date | null;
    selectedDateEvents: EnrichedEvent[];
    upcomingEvents: EnrichedEvent[] | undefined;
    onBackToOverview: () => void;
    onMarkComplete: (eventId: Id<'events'>, completed: boolean) => void;
    onSetReminder: (event: EnrichedEvent) => void;
    onEdit: (event: EnrichedEvent) => void;
    onSelectDate: (date: Date) => void;
}

export function UpcomingEventsPanel({
    selectedDate,
    selectedDateEvents,
    upcomingEvents,
    onBackToOverview,
    onMarkComplete,
    onSetReminder,
    onEdit,
    onSelectDate,
}: UpcomingEventsPanelProps) {
    const [selectedLeadId, setSelectedLeadId] = useState<Id<'leads'> | null>(null);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

    const handleLeadClick = (leadId: Id<'leads'>) => {
        setSelectedLeadId(leadId);
        setIsLeadModalOpen(true);
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    {selectedDate ? (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={onBackToOverview} className="h-8 w-8">
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
                    ) : (
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            Upcoming Events
                        </CardTitle>
                    )}
                </CardHeader>
                <CardContent className="max-h-[600px] overflow-y-auto">
                    {selectedDate ? (
                        selectedDateEvents.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                <p>No events scheduled</p>
                                <p className="text-sm mt-2">Use the "Add Event" button above to create one</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedDateEvents.map((event) => (
                                    <EventCard
                                        key={event._id}
                                        event={event}
                                        onMarkComplete={onMarkComplete}
                                        onSetReminder={() => onSetReminder(event)}
                                        onEdit={() => onEdit(event)}
                                        onLeadClick={handleLeadClick}
                                    />
                                ))}
                            </div>
                        )
                    ) : !upcomingEvents || upcomingEvents.length === 0 ? (
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

                                let dateLabel = eventDate.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                });
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
                                        onClick={() => onSelectDate(eventDate)}
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
                    )}
                </CardContent>
            </Card>

            {selectedLeadId && (
                <LeadProfileModal
                    open={isLeadModalOpen}
                    onOpenChange={setIsLeadModalOpen}
                    leadId={selectedLeadId}
                />
            )}
        </>
    );
}

interface EventCardProps {
    event: EnrichedEvent;
    onMarkComplete: (eventId: Id<'events'>, completed: boolean) => void;
    onSetReminder: () => void;
    onEdit: () => void;
    onLeadClick: (leadId: Id<'leads'>) => void;
}

function EventCard({ event, onMarkComplete, onSetReminder, onEdit, onLeadClick }: EventCardProps) {
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
                                <button
                                    type="button"
                                    className="text-sm text-primary hover:underline"
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        onLeadClick(event.lead!._id);
                                    }}
                                >
                                    {event.lead.name}
                                </button>
                            </div>
                        )}

                        {event.ai_preparation && !event.is_completed && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs text-blue-700 dark:text-blue-300">
                                💡 {event.ai_preparation}
                            </div>
                        )}

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
