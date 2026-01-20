'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id, Doc } from '@/convex/_generated/dataModel';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarDays, Clock, Pencil } from 'lucide-react';
import { eventTypeConfig, type EventType, type EnrichedEvent } from './event-types';

interface EventFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultDate?: Date;
    defaultLeadId?: Id<'leads'>;
    // For edit mode
    editEvent?: EnrichedEvent;
}

export function EventFormDialog({
    open,
    onOpenChange,
    defaultDate,
    defaultLeadId,
    editEvent,
}: EventFormDialogProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventType, setEventType] = useState<EventType>('meeting');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultDate);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [leadId, setLeadId] = useState<Id<'leads'> | undefined>(defaultLeadId);
    const [location, setLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isEditMode = !!editEvent;

    // Initialize form with event data when editing
    useEffect(() => {
        if (editEvent) {
            setTitle(editEvent.title);
            setDescription(editEvent.description ?? '');
            setEventType(editEvent.event_type);
            setLocation(editEvent.location ?? '');
            setLeadId(editEvent.lead_id);

            const startDate = new Date(editEvent.start_time);
            const endDate = new Date(editEvent.end_time);
            setSelectedDate(startDate);
            setStartTime(
                `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`
            );
            setEndTime(
                `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
            );
        }
    }, [editEvent]);

    // Update selectedDate when defaultDate changes (for new events)
    useEffect(() => {
        if (defaultDate && !editEvent) {
            setSelectedDate(defaultDate);
        }
    }, [defaultDate, editEvent]);

    // Update leadId when defaultLeadId changes (for new events)
    useEffect(() => {
        if (defaultLeadId && !editEvent) {
            setLeadId(defaultLeadId);
        }
    }, [defaultLeadId, editEvent]);

    const leads = useQuery(api.leads.queries.getAllLeads);
    const createEvent = useMutation(api.events.mutations.createEvent);
    const updateEvent = useMutation(api.events.mutations.updateEvent);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setEventType('meeting');
        setSelectedDate(undefined);
        setStartTime('09:00');
        setEndTime('10:00');
        setLeadId(undefined);
        setLocation('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !title) return;

        setIsSubmitting(true);

        try {
            // Combine date and time
            const [startHour, startMin] = startTime.split(':').map(Number);
            const [endHour, endMin] = endTime.split(':').map(Number);

            const startDateTime = new Date(selectedDate);
            startDateTime.setHours(startHour, startMin, 0, 0);

            const endDateTime = new Date(selectedDate);
            endDateTime.setHours(endHour, endMin, 0, 0);

            if (isEditMode && editEvent) {
                await updateEvent({
                    id: editEvent._id,
                    title,
                    description: description || undefined,
                    event_type: eventType,
                    start_time: startDateTime.getTime(),
                    end_time: endDateTime.getTime(),
                    lead_id: leadId,
                    location: location || undefined,
                });
            } else {
                await createEvent({
                    title,
                    description: description || undefined,
                    event_type: eventType,
                    start_time: startDateTime.getTime(),
                    end_time: endDateTime.getTime(),
                    lead_id: leadId,
                    location: location || undefined,
                });
            }

            resetForm();
            onOpenChange(false);
        } catch (error) {
            console.error(`Failed to ${isEditMode ? 'update' : 'create'} event:`, error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get event types with color indicators
    const eventTypes = Object.entries(eventTypeConfig).map(([value, config]) => ({
        value: value as EventType,
        label: config.label,
        dotColor: config.dotColor,
        Icon: config.icon,
    }));

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) resetForm();
            onOpenChange(isOpen);
        }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isEditMode ? (
                            <>
                                <Pencil className="h-5 w-5" />
                                Edit Event
                            </>
                        ) : (
                            <>
                                <CalendarDays className="h-5 w-5" />
                                Schedule Event
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Event Title *</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Property showing at 123 Main St"
                            required
                        />
                    </div>

                    {/* Event Type with Color Indicators */}
                    <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                            <SelectTrigger>
                                <SelectValue>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${eventTypeConfig[eventType].dotColor}`} />
                                        {eventTypeConfig[eventType].label}
                                    </div>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {eventTypes.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${type.dotColor}`} />
                                            <type.Icon className="h-4 w-4" />
                                            {type.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                        <Label>Date *</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start">
                                    <CalendarDays className="mr-2 h-4 w-4" />
                                    {selectedDate ? (
                                        selectedDate.toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                        })
                                    ) : (
                                        <span className="text-muted-foreground">Select a date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">Start Time</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="startTime"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endTime">End Time</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="endTime"
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Link to Lead */}
                    <div className="space-y-2">
                        <Label>Link to Lead (Optional)</Label>
                        <Select
                            value={leadId ?? 'none'}
                            onValueChange={(v) => setLeadId(v === 'none' ? undefined : v as Id<'leads'>)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a lead" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No lead linked</SelectItem>
                                {leads?.map((lead: Doc<'leads'>) => (
                                    <SelectItem key={lead._id} value={lead._id}>
                                        {lead.name} - {lead.intent}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                        <Label htmlFor="location">Location (Optional)</Label>
                        <Input
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g., 123 Main St, City, State"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Notes (Optional)</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Additional details..."
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!selectedDate || !title || isSubmitting}>
                            {isSubmitting
                                ? (isEditMode ? 'Saving...' : 'Creating...')
                                : (isEditMode ? 'Save Changes' : 'Create Event')
                            }
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
