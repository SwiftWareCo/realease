'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, MapPin, User, Phone } from 'lucide-react';

interface Task {
    id: string;
    title: string;
    time: string;
    type: 'meeting' | 'showing' | 'call' | 'other';
    location?: string;
    client?: string;
}

// Mock data - will be synced with calendar later
const mockTasks: Task[] = [
    {
        id: '1',
        title: 'Property Showing',
        time: '10:00 AM',
        type: 'showing',
        location: '123 Oak Street',
        client: 'Sarah Johnson',
    },
    {
        id: '2',
        title: 'Client Call',
        time: '11:30 AM',
        type: 'call',
        client: 'Michael Chen',
    },
    {
        id: '3',
        title: 'Team Meeting',
        time: '2:00 PM',
        type: 'meeting',
        location: 'Conference Room A',
    },
    {
        id: '4',
        title: 'Open House Prep',
        time: '4:30 PM',
        type: 'other',
        location: '456 Maple Ave',
    },
];

const typeStyles = {
    meeting: {
        bg: 'bg-blue-500/10 dark:bg-blue-500/20',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-500/30',
    },
    showing: {
        bg: 'bg-green-500/10 dark:bg-green-500/20',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-500/30',
    },
    call: {
        bg: 'bg-orange-500/10 dark:bg-orange-500/20',
        text: 'text-orange-700 dark:text-orange-300',
        border: 'border-orange-500/30',
    },
    other: {
        bg: 'bg-purple-500/10 dark:bg-purple-500/20',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-500/30',
    },
};

export function TodaysTasks() {
    return (
        <Card className='relative overflow-hidden'>
            {/* Decorative side accent */}
            <div
                className='absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-accent to-primary/50'
                aria-hidden='true'
            />

            <CardHeader className='pb-3'>
                <div className='flex items-center justify-between'>
                    <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                        <CalendarDays className='size-5 text-primary' aria-hidden='true' />
                        Today&apos;s Schedule
                    </CardTitle>
                    <Badge variant='secondary' className='text-xs'>
                        {mockTasks.length} tasks
                    </Badge>
                </div>
                <p className='text-xs text-muted-foreground mt-1'>
                    Synced with your calendar
                </p>
            </CardHeader>

            <CardContent className='space-y-3'>
                {mockTasks.length === 0 ? (
                    <div className='flex flex-col items-center justify-center py-8'>
                        <CalendarDays className='size-10 text-muted-foreground/40 mb-2' aria-hidden='true' />
                        <p className='text-sm text-muted-foreground'>No tasks scheduled</p>
                    </div>
                ) : (
                    <div className='space-y-2'>
                        {mockTasks.map((task) => {
                            const styles = typeStyles[task.type];
                            return (
                                <div
                                    key={task.id}
                                    className={`group p-3 rounded-lg border ${styles.bg} ${styles.border} transition-all hover:shadow-sm cursor-pointer`}
                                    role='button'
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            // Will navigate to calendar/event later
                                        }
                                    }}
                                >
                                    <div className='flex items-start justify-between gap-3'>
                                        <div className='flex-1 min-w-0'>
                                            <div className='flex items-center gap-2 mb-1'>
                                                <p className={`font-medium truncate ${styles.text}`}>
                                                    {task.title}
                                                </p>
                                                <Badge
                                                    variant='outline'
                                                    className={`text-[10px] px-1.5 capitalize ${styles.text} ${styles.border}`}
                                                >
                                                    {task.type}
                                                </Badge>
                                            </div>

                                            <div className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                                                <span className='flex items-center gap-1'>
                                                    <Clock className='size-3' aria-hidden='true' />
                                                    {task.time}
                                                </span>
                                                {task.location && (
                                                    <span className='flex items-center gap-1'>
                                                        <MapPin className='size-3' aria-hidden='true' />
                                                        {task.location}
                                                    </span>
                                                )}
                                                {task.client && (
                                                    <span className='flex items-center gap-1'>
                                                        {task.type === 'call' ? (
                                                            <Phone className='size-3' aria-hidden='true' />
                                                        ) : (
                                                            <User className='size-3' aria-hidden='true' />
                                                        )}
                                                        {task.client}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Placeholder for calendar sync indicator */}
                <div className='flex items-center justify-center gap-2 pt-2 border-t border-border/50'>
                    <div className='size-2 rounded-full bg-green-500 animate-pulse' aria-hidden='true' />
                    <p className='text-xs text-muted-foreground'>
                        Last synced just now
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
