'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Bell,
    CalendarDays,
    CheckCircle2,
    Clock,
    Home,
    MapPin,
    MessageSquare,
    MoreHorizontal,
    Phone,
    Users,
    User,
    ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

type EventType = 'showing' | 'meeting' | 'follow_up' | 'call' | 'open_house' | 'other';

interface EnrichedEvent {
    _id: Id<'events'>;
    title: string;
    event_type: EventType;
    start_time: number;
    end_time: number;
    location?: string;
    ai_preparation?: string;
    is_completed: boolean;
    lead?: Doc<'leads'> | null;
}

const eventTypeConfig: Record<EventType, { icon: React.ElementType; color: string }> = {
    showing: { icon: Home, color: 'text-blue-500' },
    meeting: { icon: Users, color: 'text-purple-500' },
    follow_up: { icon: MessageSquare, color: 'text-yellow-500' },
    call: { icon: Phone, color: 'text-green-500' },
    open_house: { icon: CalendarDays, color: 'text-orange-500' },
    other: { icon: MoreHorizontal, color: 'text-gray-500' },
};

export function UpcomingEventsWidget() {
    const events = useQuery(api.events.queries.getUpcomingEvents, {
        limit: 5,
        daysAhead: 7,
    }) as EnrichedEvent[] | undefined;

    const markCompleted = useMutation(api.events.mutations.markEventCompleted);

    const formatEventTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let dayStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        if (date.toDateString() === today.toDateString()) {
            dayStr = 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            dayStr = 'Tomorrow';
        }

        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });

        return { dayStr, timeStr };
    };

    const handleMarkComplete = async (eventId: Id<'events'>) => {
        await markCompleted({ id: eventId, completed: true });
    };

    const upcomingCount = events?.length ?? 0;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                    <Bell className="h-4 w-4" />
                    {upcomingCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                            {upcomingCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
                <Card className="border-0 shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" />
                                Upcoming Events
                            </span>
                            <Link href="/calendar">
                                <Button variant="ghost" size="sm" className="text-xs">
                                    View All
                                    <ChevronRight className="h-3 w-3 ml-1" />
                                </Button>
                            </Link>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[400px] overflow-y-auto">
                        {!events || events.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                                <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p>No upcoming events</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {events.map((event) => {
                                    const config = eventTypeConfig[event.event_type];
                                    const Icon = config.icon;
                                    const { dayStr, timeStr } = formatEventTime(event.start_time);

                                    return (
                                        <div
                                            key={event._id}
                                            className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-0.5 ${config.color}`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium text-sm truncate">{event.title}</h4>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                        <Badge variant="outline" className="text-[10px] px-1">
                                                            {dayStr}
                                                        </Badge>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {timeStr}
                                                        </span>
                                                    </div>

                                                    {event.location && (
                                                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                            <MapPin className="h-3 w-3" />
                                                            <span className="truncate">{event.location}</span>
                                                        </div>
                                                    )}

                                                    {event.lead && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <User className="h-3 w-3 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground">
                                                                {event.lead.name}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {event.ai_preparation && (
                                                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-[11px] text-blue-700 dark:text-blue-300">
                                                            💡 {event.ai_preparation}
                                                        </div>
                                                    )}

                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="mt-2 h-7 text-xs"
                                                        onClick={() => handleMarkComplete(event._id)}
                                                    >
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Mark Complete
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </PopoverContent>
        </Popover>
    );
}
