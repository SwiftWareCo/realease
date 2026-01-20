import { EventsCalendar } from '@/components/events/EventsCalendar';

export default function CalendarPage() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Calendar</h1>
            <EventsCalendar />
        </div>
    );
}
