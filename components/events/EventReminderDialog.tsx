'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, MessageSquare, Mail, Smartphone } from 'lucide-react';
import { EnrichedEvent } from './event-types';

interface EventReminderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: EnrichedEvent;
}

export function EventReminderDialog({
    open,
    onOpenChange,
    event,
}: EventReminderDialogProps) {
    const [recipient, setRecipient] = useState<'realtor' | 'client' | 'both'>(
        event.reminder_config?.recipient ?? 'realtor'
    );
    const [timing, setTiming] = useState<string>(
        event.reminder_config?.reminder_minutes_before?.[0]?.toString() ?? '60'
    );
    const [channels, setChannels] = useState<('sms' | 'email' | 'push')[]>(
        event.reminder_config?.channels ?? ['sms']
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    const updateEvent = useMutation(api.events.mutations.updateEvent);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await updateEvent({
                id: event._id,
                reminder_config: {
                    send_reminder: true,
                    reminder_minutes_before: [parseInt(timing)],
                    channels,
                    recipient,
                },
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to update reminder:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveReminder = async () => {
        setIsSubmitting(true);
        try {
            await updateEvent({
                id: event._id,
                reminder_config: {
                    send_reminder: false,
                    reminder_minutes_before: [],
                    channels: [],
                    recipient: 'realtor',
                },
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to remove reminder:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleChannel = (channel: 'sms' | 'email' | 'push') => {
        if (channels.includes(channel)) {
            setChannels(channels.filter((c) => c !== channel));
        } else {
            setChannels([...channels, channel]);
        }
    };

    const timingOptions = [
        { value: '15', label: '15 minutes before' },
        { value: '30', label: '30 minutes before' },
        { value: '60', label: '1 hour before' },
        { value: '120', label: '2 hours before' },
        { value: '1440', label: '1 day before' },
        { value: '2880', label: '2 days before' },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Set Reminder
                    </DialogTitle>
                    <DialogDescription>
                        Configure reminder for &quot;{event.title}&quot;
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Recipient */}
                    <div className="space-y-2">
                        <Label>Send reminder to</Label>
                        <Select value={recipient} onValueChange={(v) => setRecipient(v as typeof recipient)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="realtor">Agent only</SelectItem>
                                <SelectItem value="client">Client only</SelectItem>
                                <SelectItem value="both">Both agent and client</SelectItem>
                            </SelectContent>
                        </Select>
                        {recipient !== 'realtor' && !event.lead && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                ⚠️ No client linked to this event. Link a lead to send client reminders.
                            </p>
                        )}
                    </div>

                    {/* Timing */}
                    <div className="space-y-2">
                        <Label>When to send</Label>
                        <Select value={timing} onValueChange={setTiming}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {timingOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Channels */}
                    <div className="space-y-2">
                        <Label>Notification channels</Label>
                        <div className="flex gap-2 flex-wrap">
                            <Badge
                                variant={channels.includes('sms') ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => toggleChannel('sms')}
                            >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                SMS
                            </Badge>
                            <Badge
                                variant={channels.includes('email') ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => toggleChannel('email')}
                            >
                                <Mail className="h-3 w-3 mr-1" />
                                Email
                            </Badge>
                            <Badge
                                variant={channels.includes('push') ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => toggleChannel('push')}
                            >
                                <Smartphone className="h-3 w-3 mr-1" />
                                Push
                            </Badge>
                        </div>
                        {channels.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                Select at least one channel
                            </p>
                        )}
                    </div>

                    {/* Future integration notice */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                        <p className="font-medium">🚀 Coming Soon</p>
                        <p className="mt-1">
                            SMS and email reminders will be automatically sent by our AI assistant.
                            For now, reminders are saved for future integration.
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {event.reminder_config?.send_reminder && (
                        <Button
                            variant="destructive"
                            onClick={handleRemoveReminder}
                            disabled={isSubmitting}
                            className="sm:mr-auto"
                        >
                            Remove Reminder
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || channels.length === 0}
                    >
                        {isSubmitting ? 'Saving...' : 'Save Reminder'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
