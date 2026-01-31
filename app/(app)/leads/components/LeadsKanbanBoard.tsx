"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    User,
    Phone,
    Mail,
    MapPin,
    GripVertical,
    MessageSquare,
    TrendingUp,
    Clock,
    Link2,
    Tag,
} from "lucide-react";
import { useState } from "react";
import { LeadProfileModal } from "./LeadProfileModal";

// Helper function for relative time
function getTimeAgo(timestamp: number): string {
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
}

const statuses = [
    { id: "new", label: "New", color: "bg-blue-500" },
    { id: "contacted", label: "Contacted", color: "bg-yellow-500" },
    { id: "qualified", label: "Qualified", color: "bg-green-500" },
] as const;

type Status = "new" | "contacted" | "qualified";

interface LeadCardProps {
    lead: Doc<"leads">;
    onOpenProfile: (leadId: Id<"leads">) => void;
}

function LeadCard({ lead, onOpenProfile }: LeadCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: lead._id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const getIntentBadge = (intent: string) => {
        switch (intent) {
            case "buyer":
                return (
                    <Badge
                        variant="outline"
                        className="border-blue-300 text-blue-700 dark:text-blue-300 text-xs"
                    >
                        Buyer
                    </Badge>
                );
            case "seller":
                return (
                    <Badge
                        variant="outline"
                        className="border-green-300 text-green-700 dark:text-green-300 text-xs"
                    >
                        Seller
                    </Badge>
                );
            case "investor":
                return (
                    <Badge
                        variant="outline"
                        className="border-purple-300 text-purple-700 dark:text-purple-300 text-xs"
                    >
                        Investor
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="text-xs">
                        {intent}
                    </Badge>
                );
        }
    };

    const getUrgencyColor = (score: number) => {
        if (score >= 80) return "text-red-600 dark:text-red-400 font-semibold";
        if (score >= 60) return "text-orange-600 dark:text-orange-400";
        return "text-gray-600 dark:text-gray-400";
    };

    const getSentimentBadge = (sentiment?: string) => {
        if (!sentiment) return null;
        switch (sentiment) {
            case "positive":
                return (
                    <Badge
                        variant="outline"
                        className="border-green-300 text-green-700 dark:text-green-300 text-xs"
                    >
                        +
                    </Badge>
                );
            case "negative":
                return (
                    <Badge
                        variant="outline"
                        className="border-red-300 text-red-700 dark:text-red-300 text-xs"
                    >
                        -
                    </Badge>
                );
            default:
                return (
                    <Badge
                        variant="outline"
                        className="border-gray-300 text-gray-700 dark:text-gray-300 text-xs"
                    >
                        ~
                    </Badge>
                );
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-card border rounded-lg p-2.5 shadow-sm hover:shadow-md transition-shadow"
        >
            {/* Header row: grip, name, badges */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div
                        className="cursor-grab active:cursor-grabbing"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </div>
                    <button
                        type="button"
                        className="font-medium text-sm truncate hover:underline hover:text-primary text-left"
                        onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onOpenProfile(lead._id);
                        }}
                    >
                        {lead.name}
                    </button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {getIntentBadge(lead.intent)}
                    <Badge
                        variant={lead.urgency_score >= 75 ? "destructive" : "secondary"}
                        className="text-[10px] px-1.5 py-0 h-5 font-semibold"
                    >
                        {lead.urgency_score}%
                    </Badge>
                    {getSentimentBadge(lead.last_message_sentiment)}
                </div>
            </div>

            {/* Contact info row - properly aligned */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="truncate">{lead.phone}</span>
                </span>
                {lead.property_address && (
                    <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{lead.property_address.split(",")[0]}</span>
                    </span>
                )}
                {lead.notes && <MessageSquare className="h-3 w-3 text-blue-500 shrink-0" />}
            </div>

            {/* Source and time ago row */}
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                    <Link2 className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{lead.source}</span>
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    <span>{getTimeAgo(lead._creationTime)}</span>
                </span>
            </div>

            {/* Tags row if present */}
            {lead.tags && lead.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Tag className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    {lead.tags.slice(0, 3).map((tag) => (
                        <Badge
                            key={tag}
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4"
                        >
                            {tag}
                        </Badge>
                    ))}
                    {lead.tags.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{lead.tags.length - 3}</span>
                    )}
                </div>
            )}

            {/* AI suggestion if present */}
            {lead.ai_suggestion && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                    💡 {lead.ai_suggestion}
                </p>
            )}
        </div>
    );
}

interface StatusColumnProps {
    status: Status;
    leads: Doc<"leads">[];
    label: string;
    color: string;
    onOpenProfile: (leadId: Id<"leads">) => void;
}

function StatusColumn({
    status,
    leads,
    label,
    color,
    onOpenProfile,
}: StatusColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: status,
    });

    return (
        <div className="flex flex-col h-full">
            <Card className="flex-1 flex flex-col">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                            {label}
                        </CardTitle>
                        <Badge variant="default" className={color}>
                            {leads.length}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent
                    ref={setNodeRef}
                    className={`flex-1 overflow-y-auto transition-colors ${isOver ? "bg-muted/50" : ""
                        }`}
                >
                    <SortableContext
                        items={leads.map((l) => l._id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {leads.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                    Drop leads here
                                </div>
                            ) : (
                                leads.map((lead) => (
                                    <LeadCard
                                        key={lead._id}
                                        lead={lead}
                                        onOpenProfile={onOpenProfile}
                                    />
                                ))
                            )}
                        </div>
                    </SortableContext>
                </CardContent>
            </Card>
        </div>
    );
}

interface LeadsKanbanBoardProps {
    intentFilter?: "all" | "buyer" | "seller" | "investor";
    tagFilters?: string[];
}

export function LeadsKanbanBoard({
    intentFilter = "all",
    tagFilters = []
}: LeadsKanbanBoardProps) {
    const allLeads = useQuery(api.leads.queries.getAllLeads);
    const updateStatus = useMutation(api.leads.mutations.updateLeadStatus);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(
        null,
    );
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
    );

    // Apply filters first
    const filteredLeads = allLeads?.filter((lead) => {
        const intentMatch = intentFilter === "all" || lead.intent === intentFilter;
        const tagMatch = tagFilters.length === 0 || tagFilters.some(tag => lead.tags?.includes(tag));
        return intentMatch && tagMatch;
    });

    const leadsByStatus = statuses.reduce(
        (acc, status) => {
            acc[status.id] =
                filteredLeads?.filter((lead) => lead.status === status.id) || [];
            return acc;
        },
        {} as Record<Status, Doc<"leads">[]>,
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        const leadId = active.id as Id<"leads">;
        const newStatus = over.id as Status;

        // Find current lead status
        const lead = allLeads?.find((l) => l._id === leadId);
        if (!lead || lead.status === newStatus) return;

        // Update status
        await updateStatus({ id: leadId, status: newStatus });
    };

    const handleOpenProfile = (leadId: Id<"leads">) => {
        setSelectedLeadId(leadId);
        setIsProfileOpen(true);
    };

    const activeLead = allLeads?.find((l) => l._id === activeId);

    if (allLeads === undefined) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Loading leads...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                    {statuses.map((status) => (
                        <StatusColumn
                            key={status.id}
                            status={status.id}
                            leads={leadsByStatus[status.id]}
                            label={status.label}
                            color={status.color}
                            onOpenProfile={handleOpenProfile}
                        />
                    ))}
                </div>
                <DragOverlay>
                    {activeLead ? (
                        <div className="bg-card border rounded-lg p-3 shadow-lg rotate-3 opacity-90 w-64">
                            <div className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">
                                    {activeLead.name}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {activeLead.phone}
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Lead Profile Modal */}
            {selectedLeadId && (
                <LeadProfileModal
                    open={isProfileOpen}
                    onOpenChange={setIsProfileOpen}
                    leadId={selectedLeadId}
                />
            )}
        </>
    );
}
