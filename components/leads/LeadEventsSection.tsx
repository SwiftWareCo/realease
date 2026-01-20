'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    CalendarDays,
    Clock,
    Plus,
    MapPin,
    Home,
    Users,
    MessageSquare,
    Phone,
    MoreHorizontal,
    CheckCircle2,
} from 'lucide-react';
import { EventFormDialog } from '@/components/events/EventFormDialog';

type EventType = 'showing' | 'meeting' | 'follow_up' | 'call' | 'open_house' | 'other';

interface LeadEventsSectionProps {
    leadId: Id<'leads'>;
    leadName: string;
}

const eventTypeConfig: Record<EventType, { label: string; icon: React.ElementType; color: string }> = {
    showing: { label: 'Showing', icon: Home, color: 'bg-blue-500' },
    meeting: { label: 'Meeting', icon: Users, color: 'bg-purple-500' },
    follow_up: { label: 'Follow Up', icon: MessageSquare, color: 'bg-yellow-500' },
    call: { label: 'Call', icon: Phone, color: 'bg-green-500' },
    open_house: { label: 'Open House', icon: CalendarDays, color: 'bg-orange-500' },
    other: { label: 'Other', icon: MoreHorizontal, color: 'bg-gray-500' },
};

export function LeadEventsSection({ leadId, leadName }: LeadEventsSectionProps) {
    const [isEventFormOpen, setIsEventFormOpen] = useState(false);

    const events = useQuery(api.events.queries.getEventsByLead, { leadId }) as Doc<'events'>[] | undefined;

    const formatEventTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const upcomingEvents = events?.filter(e => e.start_time > Date.now() && !e.is_completed) || [];
    const pastEvents = events?.filter(e => e.start_time <= Date.now() || e.is_completed) || [];

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarDays className="h-5 w-5" />
                        Events with {leadName}
                    </CardTitle>
                    <Button size="sm" onClick={() => setIsEventFormOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Schedule Event
                    </Button>
                </CardHeader>
                <CardContent>
                    {/* Upcoming Events */}
                    {upcomingEvents.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-medium text-muted-foreground mb-3">Upcoming</h4>
                            <div className="space-y-3">
                                {upcomingEvents.map((event) => {
                                    const config = eventTypeConfig[event.event_type];
                                    const Icon = config.icon;

                                    return (
                                        <div
                                            key={event._id}
                                            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                                        >
                                            <div className={`p-2 rounded-lg ${config.color} text-white`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{event.title}</span>
                                                    <Badge variant="outline" className="text-xs">
                                                        {config.label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {formatEventTime(event.start_time)}
                                                </div>
                                                {event.location && (
                                                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                                        <MapPin className="h-3 w-3" />
                                                        {event.location}
                                                    </div>
                                                )}
                                                {event.ai_preparation && (
                                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs text-blue-700 dark:text-blue-300">
                                                        💡 {event.ai_preparation}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Past Events */}
                    {pastEvents.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-3">Past Events</h4>
                            <div className="space-y-2">
                                {pastEvents.slice(0, 5).map((event) => {
                                    const config = eventTypeConfig[event.event_type];
                                    const Icon = config.icon;

                                    return (
                                        <div
                                            key={event._id}
                                            className="flex items-center gap-3 p-2 rounded-lg opacity-60"
                                        >
                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                            <div className="flex-1">
                                                <span className="text-sm">{event.title}</span>
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    {new Date(event.start_time).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {event.is_completed && (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!events || events.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No events scheduled with this lead</p>
                            <Button
                                variant="outline"
                                className="mt-3"
                                onClick={() => setIsEventFormOpen(true)}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Schedule First Event
                            </Button>
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <EventFormDialog
                open={isEventFormOpen}
                onOpenChange={setIsEventFormOpen}
                defaultLeadId={leadId}
            />
        </>
    );
}
