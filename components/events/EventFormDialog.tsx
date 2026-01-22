"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarDays, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
    eventTypeConfig,
    type EventType,
    type EnrichedEvent,
} from "./event-types";

interface EventFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultDate?: Date;
    defaultLeadId?: Id<"leads">;
    editEvent?: EnrichedEvent;
}

type EventFormValues = {
    title: string;
    description: string;
    eventType: EventType;
    date?: Date;
    startTime: string;
    endTime: string;
    leadId: Id<"leads"> | "none";
    location: string;
};

export function EventFormDialog({
    open,
    onOpenChange,
    defaultDate,
    defaultLeadId,
    editEvent,
}: EventFormDialogProps) {
    const isEditMode = !!editEvent;

    const leads = useQuery(api.leads.queries.getAllLeads);
    const createEvent = useMutation(api.events.mutations.createEvent);
    const updateEvent = useMutation(api.events.mutations.updateEvent);

    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { isSubmitting },
    } = useForm<EventFormValues>({
        defaultValues: {
            title: "",
            description: "",
            eventType: "meeting",
            date: undefined,
            startTime: "09:00",
            endTime: "10:00",
            leadId: "none",
            location: "",
        },
    });

    useEffect(() => {
        if (!open) return;

        if (editEvent) {
            const startDate = new Date(editEvent.start_time);
            const endDate = new Date(editEvent.end_time);
            reset({
                title: editEvent.title,
                description: editEvent.description ?? "",
                eventType: editEvent.event_type,
                date: startDate,
                startTime: `${startDate
                    .getHours()
                    .toString()
                    .padStart(2, "0")}:${startDate
                    .getMinutes()
                    .toString()
                    .padStart(2, "0")}`,
                endTime: `${endDate
                    .getHours()
                    .toString()
                    .padStart(2, "0")}:${endDate
                    .getMinutes()
                    .toString()
                    .padStart(2, "0")}`,
                leadId: editEvent.lead_id ?? "none",
                location: editEvent.location ?? "",
            });
            return;
        }

        reset({
            title: "",
            description: "",
            eventType: "meeting",
            date: defaultDate,
            startTime: "09:00",
            endTime: "10:00",
            leadId: defaultLeadId ?? "none",
            location: "",
        });
    }, [open, editEvent, defaultDate, defaultLeadId, reset]);

    const onSubmit = async (values: EventFormValues) => {
        if (!values.date || !values.title) return;

        try {
            const [startHour, startMin] = values.startTime
                .split(":")
                .map(Number);
            const [endHour, endMin] = values.endTime.split(":").map(Number);

            const startDateTime = new Date(values.date);
            startDateTime.setHours(startHour, startMin, 0, 0);

            const endDateTime = new Date(values.date);
            endDateTime.setHours(endHour, endMin, 0, 0);

            if (isEditMode && editEvent) {
                await updateEvent({
                    id: editEvent._id,
                    title: values.title,
                    description: values.description || undefined,
                    event_type: values.eventType,
                    start_time: startDateTime.getTime(),
                    end_time: endDateTime.getTime(),
                    lead_id:
                        values.leadId === "none" ? undefined : values.leadId,
                    location: values.location || undefined,
                });
                toast.success("Event updated");
            } else {
                await createEvent({
                    title: values.title,
                    description: values.description || undefined,
                    event_type: values.eventType,
                    start_time: startDateTime.getTime(),
                    end_time: endDateTime.getTime(),
                    lead_id:
                        values.leadId === "none" ? undefined : values.leadId,
                    location: values.location || undefined,
                });
                toast.success("Event created");
            }

            onOpenChange(false);
        } catch (error) {
            console.error(
                `Failed to ${isEditMode ? "update" : "create"} event:`,
                error,
            );
            toast.error(`Failed to ${isEditMode ? "update" : "create"} event`);
        }
    };

    const eventTypes = Object.entries(eventTypeConfig).map(
        ([value, config]) => ({
            value: value as EventType,
            label: config.label,
            dotColor: config.dotColor,
            Icon: config.icon,
        }),
    );

    const selectedDate = useWatch({ control, name: "date" });
    const selectedEventType = useWatch({ control, name: "eventType" });
    const title = useWatch({ control, name: "title" });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Event Title *</Label>
                        <Input
                            id="title"
                            placeholder="e.g., Property showing at 123 Main St"
                            {...register("title", { required: true })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Controller
                            control={control}
                            name="eventType"
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={`w-3 h-3 rounded-full ${eventTypeConfig[selectedEventType].dotColor}`}
                                                />
                                                {
                                                    eventTypeConfig[
                                                        selectedEventType
                                                    ].label
                                                }
                                            </div>
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {eventTypes.map((type) => (
                                            <SelectItem
                                                key={type.value}
                                                value={type.value}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={`w-3 h-3 rounded-full ${type.dotColor}`}
                                                    />
                                                    <type.Icon className="h-4 w-4" />
                                                    {type.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Date *</Label>
                        <Controller
                            control={control}
                            name="date"
                            rules={{ required: true }}
                            render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start"
                                        >
                                            <CalendarDays className="mr-2 h-4 w-4" />
                                            {field.value ? (
                                                field.value.toLocaleDateString(
                                                    "en-US",
                                                    {
                                                        weekday: "short",
                                                        month: "short",
                                                        day: "numeric",
                                                    },
                                                )
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    Select a date
                                                </span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-auto p-0"
                                        align="start"
                                    >
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">Start Time</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="startTime"
                                    type="time"
                                    className="pl-9"
                                    {...register("startTime")}
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
                                    className="pl-9"
                                    {...register("endTime")}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Link to Lead (Optional)</Label>
                        <Controller
                            control={control}
                            name="leadId"
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a lead" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            No lead linked
                                        </SelectItem>
                                        {leads?.map((lead: Doc<"leads">) => (
                                            <SelectItem
                                                key={lead._id}
                                                value={lead._id}
                                            >
                                                {lead.name} - {lead.intent}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="location">Location (Optional)</Label>
                        <Input
                            id="location"
                            placeholder="e.g., 123 Main St, City, State"
                            {...register("location")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Notes (Optional)</Label>
                        <Input
                            id="description"
                            placeholder="Additional details..."
                            {...register("description")}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!selectedDate || !title || isSubmitting}
                        >
                            {isSubmitting
                                ? isEditMode
                                    ? "Saving..."
                                    : "Creating..."
                                : isEditMode
                                  ? "Save Changes"
                                  : "Create Event"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
