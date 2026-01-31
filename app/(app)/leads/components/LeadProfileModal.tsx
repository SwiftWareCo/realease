"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    User,
    Phone,
    Mail,
    MapPin,
    TrendingUp,
    MessageSquare,
    Clock,
    Calendar,
    Link2,
    Tag,
    X,
    Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { eventTypeConfig } from "@/components/events/event-types";
import { useState } from "react";

interface LeadProfileModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leadId: Id<"leads">;
}

// Event type for display
type EventDoc = Doc<"events"> & { lead?: Doc<"leads"> | null };

export function LeadProfileModal({
    open,
    onOpenChange,
    leadId,
}: LeadProfileModalProps) {
    const router = useRouter();
    const [newTag, setNewTag] = useState("");
    const lead = useQuery(api.leads.queries.getLeadById, { id: leadId }) as
        | Doc<"leads">
        | null
        | undefined;
    const eventBuckets = useQuery(api.events.queries.getLeadEventsBuckets, {
        leadId,
    }) as { upcoming: EventDoc[]; past: EventDoc[] } | undefined;
    const addTag = useMutation(api.leads.mutations.addTag);
    const removeTag = useMutation(api.leads.mutations.removeTag);

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    };

    const getTimeAgo = (timestamp: number): string => {
        const now = Date.now();
        const diffMs = now - timestamp;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30);

        if (diffMins < 1) return "just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffWeeks < 4) return `${diffWeeks}w ago`;
        return `${diffMonths}mo ago`;
    };

    const handleEventClick = (event: EventDoc) => {
        const eventDate = new Date(event.start_time);
        const month = eventDate.getMonth();
        const year = eventDate.getFullYear();
        const day = eventDate.getDate();
        // Navigate to calendar with date and event params
        router.push(
            `/calendar?month=${month}&year=${year}&day=${day}&event=${event._id}`,
        );
        onOpenChange(false);
    };

    const isLoading = lead === undefined;
    const isNotFound = lead === null;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "new":
                return <Badge className="bg-blue-500">New</Badge>;
            case "contacted":
                return <Badge className="bg-yellow-500">Contacted</Badge>;
            case "qualified":
                return <Badge className="bg-green-500">Qualified</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const getIntentBadge = (intent: string) => {
        switch (intent) {
            case "buyer":
                return (
                    <Badge
                        variant="outline"
                        className="border-blue-300 text-blue-700 dark:text-blue-300"
                    >
                        Buyer
                    </Badge>
                );
            case "seller":
                return (
                    <Badge
                        variant="outline"
                        className="border-green-300 text-green-700 dark:text-green-300"
                    >
                        Seller
                    </Badge>
                );
            case "investor":
                return (
                    <Badge
                        variant="outline"
                        className="border-purple-300 text-purple-700 dark:text-purple-300"
                    >
                        Investor
                    </Badge>
                );
            default:
                return <Badge variant="outline">{intent}</Badge>;
        }
    };

    const upcomingEvents = eventBuckets?.upcoming ?? [];
    const pastEvents = eventBuckets?.past ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden gap-2">
                <DialogHeader className="border-b pb-4">
                    {isLoading ? (
                        <DialogTitle className="sr-only">
                            Loading lead
                        </DialogTitle>
                    ) : isNotFound ? (
                        <DialogTitle>Lead Not Found</DialogTitle>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-xl flex items-center gap-3">
                                    {lead.name}
                                    {getStatusBadge(lead.status)}
                                </DialogTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    {getIntentBadge(lead.intent)}
                                    <Badge
                                        variant="secondary"
                                        className="text-xs"
                                    >
                                        {lead.urgency_score}% Urgency
                                    </Badge>
                                </div>
                                {/* Tags Section */}
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    <Tag className="h-3 w-3 text-muted-foreground" />
                                    {(lead.tags ?? []).map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="outline"
                                            className="text-xs px-2 py-1 h-6 gap-1"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => removeTag({ id: leadId, tag })}
                                                className="hover:text-destructive"
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </Badge>
                                    ))}
                                    <div className="flex items-center gap-1">
                                        <Input
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            placeholder="Add tag..."
                                            className="h-6 w-24 text-xs px-2 py-1"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && newTag.trim()) {
                                                    addTag({ id: leadId, tag: newTag.trim() });
                                                    setNewTag("");
                                                }
                                            }}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => {
                                                if (newTag.trim()) {
                                                    addTag({ id: leadId, tag: newTag.trim() });
                                                    setNewTag("");
                                                }
                                            }}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                {isLoading ? (
                    <div className="space-y-4 pt-4">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-32" />
                        <Skeleton className="h-32" />
                    </div>
                ) : isNotFound ? (
                    <div className="pt-4 text-muted-foreground">
                        This lead could not be found.
                    </div>
                ) : (
                    <div className="space-y-2 pt-2">
                        {/* Contact Information */}
                        <Card className="py-3 gap-0">
                            <CardHeader className="py-1.5 px-4">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                    <User className="h-4 w-4" />
                                    Contact Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 text-sm px-4">
                                <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{lead.phone}</span>
                                </div>
                                {lead.email && (
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span>{lead.email}</span>
                                    </div>
                                )}
                                {lead.property_address && (
                                    <div className="flex items-start gap-3">
                                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <span>{lead.property_address}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <Link2 className="h-4 w-4" />
                                    <span>
                                        Source: {lead.source} • Added {getTimeAgo(lead._creationTime)}
                                    </span>
                                </div>
                                {lead.timeline && (
                                    <div className="flex items-center gap-3 text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span>Timeline: {lead.timeline}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* AI Insights */}
                        {(lead.conversion_prediction || lead.ai_suggestion) && (
                            <Card className="py-3 gap-0">
                                <CardHeader className="py-1.5 px-4">
                                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                        <TrendingUp className="h-4 w-4" />
                                        AI Insights
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1.5 px-4">
                                    {lead.conversion_prediction && (
                                        <div className="p-1.5 pl-3 bg-blue-50 dark:bg-blue-950/30 rounded text-sm">
                                            <p className="font-medium text-blue-900 dark:text-blue-200">
                                                Conversion
                                            </p>
                                            <p className="text-blue-700 dark:text-blue-300">
                                                {lead.conversion_prediction}
                                            </p>
                                        </div>
                                    )}
                                    {lead.ai_suggestion && (
                                        <div className="p-1.5 pl-3 bg-yellow-50 dark:bg-yellow-950/30 rounded text-sm">
                                            <p className="font-medium text-yellow-900 dark:text-yellow-200">
                                                💡 Suggestion
                                            </p>
                                            <p className="text-yellow-700 dark:text-yellow-300">
                                                {lead.ai_suggestion}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Notes */}
                        {lead.notes && (
                            <Card className="py-3 gap-1">
                                <CardHeader className="py-1.5 px-4">
                                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                        <MessageSquare className="h-4 w-4" />
                                        Notes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-4">
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {lead.notes}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Events */}
                        <Card className="py-3 gap-0">
                            <CardHeader className="py-1.5 px-4">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                    <Calendar className="h-4 w-4" />
                                    Events (
                                    {(upcomingEvents?.length ?? 0) +
                                        (pastEvents?.length ?? 0)}
                                    )
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4">
                                {upcomingEvents.length === 0 &&
                                    pastEvents.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-2">
                                        No events scheduled
                                    </p>
                                ) : (
                                    <ScrollArea className="h-40 px-3">
                                        <div className="space-y-2">
                                            {upcomingEvents.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                                        Upcoming
                                                    </p>
                                                    {upcomingEvents.map((event) => {
                                                        const config =
                                                            eventTypeConfig[
                                                            event.event_type as keyof typeof eventTypeConfig
                                                            ];
                                                        return (
                                                            <div
                                                                key={event._id}
                                                                className="p-2 rounded border hover:bg-accent cursor-pointer transition-colors flex items-center gap-2"
                                                                onClick={() =>
                                                                    handleEventClick(
                                                                        event,
                                                                    )
                                                                }
                                                            >
                                                                <div
                                                                    className={`w-2 h-2 rounded-full ${config?.dotColor ?? "bg-gray-500"}`}
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-sm font-medium truncate">
                                                                        {
                                                                            event.title
                                                                        }
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground ml-2">
                                                                        {formatDate(
                                                                            event.start_time,
                                                                        )}{" "}
                                                                        at{" "}
                                                                        {formatTime(
                                                                            event.start_time,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {pastEvents.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground mb-1 mt-2">
                                                        Past
                                                    </p>
                                                    {pastEvents.map((event) => {
                                                        const config =
                                                            eventTypeConfig[
                                                            event.event_type as keyof typeof eventTypeConfig
                                                            ];
                                                        return (
                                                            <div
                                                                key={event._id}
                                                                className="p-2 rounded border hover:bg-accent cursor-pointer transition-colors flex items-center gap-2 opacity-60"
                                                                onClick={() =>
                                                                    handleEventClick(
                                                                        event,
                                                                    )
                                                                }
                                                            >
                                                                <div
                                                                    className={`w-2 h-2 rounded-full ${config?.dotColor ?? "bg-gray-500"}`}
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-sm font-medium truncate">
                                                                        {
                                                                            event.title
                                                                        }
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground ml-2">
                                                                        {formatDate(
                                                                            event.start_time,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
