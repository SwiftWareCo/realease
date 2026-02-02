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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
    User,
    GripVertical,
    DollarSign,
    MapPin,
} from "lucide-react";
import { useState } from "react";
import { LeadProfileModal } from "./LeadProfileModal";

const buyerStages = [
    { id: "searching", label: "Searching", color: "bg-blue-500" },
    { id: "showings", label: "Showings", color: "bg-yellow-500" },
    { id: "offer_out", label: "Offer Out", color: "bg-orange-500" },
    { id: "under_contract", label: "Under Contract", color: "bg-purple-500" },
    { id: "closed", label: "Closed", color: "bg-green-500" },
] as const;

type BuyerStage = "searching" | "showings" | "offer_out" | "under_contract" | "closed";

interface BuyerLeadCardProps {
    lead: Doc<"leads">;
    onOpenProfile: (leadId: Id<"leads">) => void;
}

function BuyerLeadCard({ lead, onOpenProfile }: BuyerLeadCardProps) {
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

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-200 group"
        >
            {/* Header with drag handle and name */}
            <div className="flex items-center gap-2 mb-3">
                <div
                    className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <button
                    type="button"
                    className="flex items-center gap-2 flex-1 min-w-0 hover:text-primary transition-colors text-left"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfile(lead._id);
                    }}
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-semibold text-sm truncate">
                        {lead.name}
                    </span>
                </button>
            </div>

            {/* Budget */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="font-medium">
                    {lead.budget || "Budget not set"}
                </span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span className="truncate">
                    {lead.preferred_location || lead.property_address || "Location not set"}
                </span>
            </div>
        </div>
    );
}

interface StageColumnProps {
    stage: BuyerStage;
    leads: Doc<"leads">[];
    label: string;
    color: string;
    onOpenProfile: (leadId: Id<"leads">) => void;
}

function StageColumn({
    stage,
    leads,
    label,
    color,
    onOpenProfile,
}: StageColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage,
    });

    return (
        <div className="flex flex-col h-full flex-1 min-w-0">
            <Card className={`flex-1 flex flex-col border-t-4 ${color.replace('bg-', 'border-t-')} bg-card/50 backdrop-blur-sm`}>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                        </CardTitle>
                        <Badge variant="secondary" className="font-bold">
                            {leads.length}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 min-h-0">
                    <ScrollArea className="h-[calc(100vh-320px)]">
                        <div
                            ref={setNodeRef}
                            className={`p-4 transition-colors min-h-[200px] ${isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : ""}`}
                        >
                            <SortableContext
                                items={leads.map((l) => l._id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-3">
                                    {leads.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground/60 text-sm border-2 border-dashed border-border/50 rounded-xl">
                                            <p className="font-medium">No leads</p>
                                            <p className="text-xs mt-1">Drop leads here</p>
                                        </div>
                                    ) : (
                                        leads.map((lead) => (
                                            <BuyerLeadCard
                                                key={lead._id}
                                                lead={lead}
                                                onOpenProfile={onOpenProfile}
                                            />
                                        ))
                                    )}
                                </div>
                            </SortableContext>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}

export function BuyerKanbanBoard() {
    const buyerLeads = useQuery(api.leads.queries.getBuyerLeads);
    const updateStage = useMutation(api.leads.mutations.updateBuyerPipelineStage);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
    );

    const leadsByStage = buyerStages.reduce(
        (acc, stage) => {
            acc[stage.id] =
                buyerLeads?.filter((lead) => lead.buyer_pipeline_stage === stage.id) || [];
            return acc;
        },
        {} as Record<BuyerStage, Doc<"leads">[]>,
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        const leadId = active.id as Id<"leads">;
        const newStage = over.id as BuyerStage;

        // Find current lead stage
        const lead = buyerLeads?.find((l) => l._id === leadId);
        if (!lead || lead.buyer_pipeline_stage === newStage) return;

        // Update stage
        await updateStage({ id: leadId, stage: newStage });
    };

    const handleOpenProfile = (leadId: Id<"leads">) => {
        setSelectedLeadId(leadId);
        setIsProfileOpen(true);
    };

    const activeLead = buyerLeads?.find((l) => l._id === activeId);

    if (buyerLeads === undefined) {
        return (
            <div className="grid grid-cols-5 gap-4 h-full">
                {buyerStages.map((stage) => (
                    <div key={stage.id} className="flex flex-col h-full flex-1 min-w-0">
                        <Card className={`flex-1 flex flex-col border-t-4 ${stage.color.replace('bg-', 'border-t-')} bg-card/50 backdrop-blur-sm`}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-5 w-6 rounded-full" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="bg-card/80 border border-border/50 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-8 w-8 rounded-full" />
                                            <Skeleton className="h-4 w-32" />
                                        </div>
                                        <Skeleton className="h-3 w-24" />
                                        <Skeleton className="h-3 w-full" />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-5 gap-4 h-full">
                    {buyerStages.map((stage) => (
                        <StageColumn
                            key={stage.id}
                            stage={stage.id}
                            leads={leadsByStage[stage.id]}
                            label={stage.label}
                            color={stage.color}
                            onOpenProfile={handleOpenProfile}
                        />
                    ))}
                </div>
                <DragOverlay>
                    {activeLead ? (
                        <div className="bg-card border rounded-xl p-4 shadow-2xl rotate-3 opacity-95 w-72 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                                <span className="font-semibold text-sm">
                                    {activeLead.name}
                                </span>
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
