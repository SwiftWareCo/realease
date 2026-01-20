import type { Doc, Id } from '@/convex/_generated/dataModel';
import {
    CalendarDays,
    Home,
    Users,
    MessageSquare,
    Phone,
    MoreHorizontal,
} from 'lucide-react';

export type EventType = 'showing' | 'meeting' | 'follow_up' | 'call' | 'open_house' | 'other';

export interface EnrichedEvent {
    _id: Id<'events'>;
    _creationTime: number;
    title: string;
    description?: string;
    event_type: EventType;
    start_time: number;
    end_time: number;
    lead_id?: Id<'leads'>;
    location?: string;
    ai_preparation?: string;
    is_completed: boolean;
    created_at: number;
    lead?: Doc<'leads'> | null;
    reminder_config?: {
        send_reminder: boolean;
        reminder_minutes_before: number[];
        channels: ('sms' | 'email' | 'push')[];
        recipient: 'realtor' | 'client' | 'both';
    };
}

// Consistent color configuration for all event-related components
export const eventTypeConfig: Record<EventType, {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    textColor: string;
    dotColor: string
}> = {
    showing: {
        label: 'Showing',
        icon: Home,
        color: 'bg-blue-500',
        bgColor: 'bg-blue-100 dark:bg-blue-950/30',
        textColor: 'text-blue-700 dark:text-blue-300',
        dotColor: 'bg-blue-500'
    },
    meeting: {
        label: 'Meeting',
        icon: Users,
        color: 'bg-purple-500',
        bgColor: 'bg-purple-100 dark:bg-purple-950/30',
        textColor: 'text-purple-700 dark:text-purple-300',
        dotColor: 'bg-purple-500'
    },
    follow_up: {
        label: 'Follow Up',
        icon: MessageSquare,
        color: 'bg-yellow-500',
        bgColor: 'bg-yellow-100 dark:bg-yellow-950/30',
        textColor: 'text-yellow-700 dark:text-yellow-300',
        dotColor: 'bg-yellow-500'
    },
    call: {
        label: 'Call',
        icon: Phone,
        color: 'bg-green-500',
        bgColor: 'bg-green-100 dark:bg-green-950/30',
        textColor: 'text-green-700 dark:text-green-300',
        dotColor: 'bg-green-500'
    },
    open_house: {
        label: 'Open House',
        icon: CalendarDays,
        color: 'bg-orange-500',
        bgColor: 'bg-orange-100 dark:bg-orange-950/30',
        textColor: 'text-orange-700 dark:text-orange-300',
        dotColor: 'bg-orange-500'
    },
    other: {
        label: 'Other',
        icon: MoreHorizontal,
        color: 'bg-gray-500',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        textColor: 'text-gray-700 dark:text-gray-300',
        dotColor: 'bg-gray-500'
    },
};
