"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
    CheckCircle2,
    Clock,
    User,
    Phone,
    Mail,
    MapPin,
    LayoutGrid,
    Table2,
    AlertCircle,
    MessageSquare,
    Plus,
    Tag,
    X,
} from "lucide-react";
import { LeadsKanbanBoard } from "./LeadsKanbanBoard";
import { AddLeadModal } from "./AddLeadModal";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export function LeadsDashboard() {
    const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
    const [intentFilter, setIntentFilter] = useState<
        "all" | "buyer" | "seller" | "investor"
    >("all");
    const [tagFilters, setTagFilters] = useState<string[]>([]);
    const [tagSearch, setTagSearch] = useState("");
    const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
    const allLeads = useQuery(api.leads.queries.getAllLeads);
    const allTags = useQuery(api.leads.queries.getAllTags);
    const updateStatus = useMutation(api.leads.mutations.updateLeadStatus);

    // Toggle a tag filter
    const toggleTagFilter = (tag: string) => {
        setTagFilters((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
        );
    };

    // Apply intent and tag filters
    const leads = allLeads?.filter((lead: Doc<"leads">) => {
        const intentMatch =
            intentFilter === "all" || lead.intent === intentFilter;
        const tagMatch =
            tagFilters.length === 0 ||
            tagFilters.some((tag) => lead.tags?.includes(tag));
        return intentMatch && tagMatch;
    });

    const handleStatusUpdate = async (
        leadId: Id<"leads">,
        newStatus: "new" | "contacted" | "qualified",
    ) => {
        await updateStatus({ id: leadId, status: newStatus });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "new":
                return (
                    <Badge variant="default" className="bg-blue-500">
                        New
                    </Badge>
                );
            case "contacted":
                return (
                    <Badge variant="default" className="bg-yellow-500">
                        Contacted
                    </Badge>
                );
            case "qualified":
                return (
                    <Badge variant="default" className="bg-green-500">
                        Qualified
                    </Badge>
                );
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
                        className="border-green-300 text-green-700 dark:text-green-300"
                    >
                        Positive
                    </Badge>
                );
            case "negative":
                return (
                    <Badge
                        variant="outline"
                        className="border-red-300 text-red-700 dark:text-red-300"
                    >
                        Negative
                    </Badge>
                );
            default:
                return (
                    <Badge
                        variant="outline"
                        className="border-gray-300 text-gray-700 dark:text-gray-300"
                    >
                        Neutral
                    </Badge>
                );
        }
    };

    // Separate priority leads (urgency >= 75)
    const priorityLeads =
        allLeads?.filter((lead: Doc<"leads">) => lead.urgency_score >= 75) ||
        [];
    const regularLeadsList =
        leads?.filter((lead: Doc<"leads">) => lead.urgency_score < 75) || [];

    if (allLeads === undefined) {
        return (
            <div className="flex flex-col h-full space-y-4">
                {/* Skeleton Header */}
                <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                    <Skeleton className="h-8 w-28 rounded-lg" />
                    <Skeleton className="h-8 w-40 rounded-lg" />
                </div>
                {/* Skeleton Controls */}
                <div className="flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Skeleton className="h-8 w-24 rounded-lg" />
                        <Skeleton className="h-8 w-24 rounded-lg" />
                        <Skeleton className="h-8 w-28 rounded-lg" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
                {/* Skeleton Content */}
                <div className="flex-1 min-h-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                        {[...Array(3)].map((_, i) => (
                            <Card key={i} className="flex-1 flex flex-col">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-5 w-8 rounded-full" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {[...Array(4)].map((_, j) => (
                                        <div
                                            key={j}
                                            className="bg-card border rounded-lg p-3 space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-4 w-16" />
                                            </div>
                                            <Skeleton className="h-3 w-full" />
                                            <Skeleton className="h-3 w-2/3" />
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const stats = {
        total: allLeads.length,
        new: allLeads.filter((l: Doc<"leads">) => l.status === "new").length,
        contacted: allLeads.filter(
            (l: Doc<"leads">) => l.status === "contacted",
        ).length,
        qualified: allLeads.filter(
            (l: Doc<"leads">) => l.status === "qualified",
        ).length,
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header Row: Total count + Priority Alerts */}
            <div className="flex items-center gap-3 mb-3 flex-shrink-0 flex-wrap">
                {/* Left side - Total Leads badge */}
                <div className="flex items-center px-3 py-1.5 rounded-lg bg-muted/50 border">
                    <span className="text-xs">
                        <span className="text-muted-foreground">
                            Total Leads:
                        </span>{" "}
                        <span className="font-bold">{stats.total}</span>
                    </span>
                </div>

                {/* Priority Alerts - Compact inline display */}
                {priorityLeads.length > 0 && (
                    <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-300 whitespace-nowrap">
                            {priorityLeads.length} Priority
                        </span>
                        <div className="flex items-center gap-1">
                            {priorityLeads
                                .slice(0, 2)
                                .map((lead: Doc<"leads">) => (
                                    <Badge
                                        key={lead._id}
                                        variant="destructive"
                                        className="text-[9px] px-1 py-0 h-4 cursor-pointer hover:bg-red-700"
                                        title={lead.name}
                                    >
                                        {lead.urgency_score}%
                                    </Badge>
                                ))}
                            {priorityLeads.length > 2 && (
                                <span className="text-[10px] text-red-600 font-medium">
                                    +{priorityLeads.length - 2}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Row: View Toggle + Filters + Add Button */}
            <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Tabs
                        value={viewMode}
                        onValueChange={(value) =>
                            setViewMode(value as "table" | "kanban")
                        }
                    >
                        <TabsList className="h-8">
                            <TabsTrigger
                                value="kanban"
                                className="text-xs px-2.5 h-7"
                            >
                                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                                Kanban
                            </TabsTrigger>
                            <TabsTrigger
                                value="table"
                                className="text-xs px-2.5 h-7"
                            >
                                <Table2 className="h-3.5 w-3.5 mr-1" />
                                Table
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Select
                        value={intentFilter}
                        onValueChange={(
                            value: "all" | "buyer" | "seller" | "investor",
                        ) => setIntentFilter(value)}
                    >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="buyer">Buyer</SelectItem>
                            <SelectItem value="seller">Seller</SelectItem>
                            <SelectItem value="investor">Investor</SelectItem>
                        </SelectContent>
                    </Select>
                    {/* Tag Filter Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-dashed text-xs gap-1"
                            >
                                <Tag className="h-3.5 w-3.5 mr-1" />
                                Tags
                                {tagFilters.length > 0 && (
                                    <Badge
                                        variant="secondary"
                                        className="px-1 h-5 ml-1 text-[10px]"
                                    >
                                        {tagFilters.length}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-2" align="start">
                            <Input
                                placeholder="Filter tags..."
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                                className="h-8 text-xs mb-2"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && tagSearch.trim()) {
                                        if (
                                            !tagFilters.includes(
                                                tagSearch.trim(),
                                            )
                                        ) {
                                            toggleTagFilter(tagSearch.trim());
                                        }
                                        setTagSearch("");
                                    }
                                }}
                            />
                            {tagFilters.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {tagFilters.sort().map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="secondary"
                                            className="text-[10px] px-1 h-5 gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => toggleTagFilter(tag)}
                                        >
                                            {tag}
                                            <X className="h-2.5 w-2.5" />
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            <ScrollArea className="h-[200px]">
                                <div className="space-y-1">
                                    {(allTags ?? [])
                                        .filter((t) =>
                                            t
                                                .toLowerCase()
                                                .includes(
                                                    tagSearch.toLowerCase(),
                                                ),
                                        )
                                        .filter((t) => !tagFilters.includes(t))
                                        .map((tag) => (
                                            <div
                                                key={tag}
                                                className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent rounded-sm cursor-pointer"
                                                onClick={() => {
                                                    toggleTagFilter(tag);
                                                    setTagSearch("");
                                                }}
                                            >
                                                <Tag className="h-3 w-3 text-muted-foreground" />
                                                {tag}
                                            </div>
                                        ))}
                                    {tagSearch.trim() &&
                                        !(allTags ?? []).includes(
                                            tagSearch.trim(),
                                        ) &&
                                        !tagFilters.includes(
                                            tagSearch.trim(),
                                        ) && (
                                            <div
                                                className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent rounded-sm cursor-pointer text-muted-foreground"
                                                onClick={() => {
                                                    toggleTagFilter(
                                                        tagSearch.trim(),
                                                    );
                                                    setTagSearch("");
                                                }}
                                            >
                                                <Plus className="h-3 w-3" />
                                                Filter by &quot;{tagSearch}
                                                &quot;
                                            </div>
                                        )}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </div>
                <Button
                    onClick={() => setIsAddLeadOpen(true)}
                    size="sm"
                    className="gap-1.5 bg-gradient-to-r from-primary to-primary/80 h-8"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Lead
                </Button>
            </div>

            {/* Main Content Area - Kanban or Table */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {viewMode === "kanban" ? (
                    <LeadsKanbanBoard
                        intentFilter={intentFilter}
                        tagFilters={tagFilters}
                    />
                ) : leads && leads.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No leads found.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-[calc(100vh-260px)] rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Property</TableHead>
                                    <TableHead>Intent</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Urgency</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>AI Insights</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {regularLeadsList?.map((lead: Doc<"leads">) => (
                                    <TableRow key={lead._id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        {lead.name}
                                                    </span>
                                                    {lead.notes && (
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <MessageSquare className="w-3 h-3" />
                                                            Has notes
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                                    <span>{lead.phone}</span>
                                                </div>
                                                {lead.email && (
                                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                        <Mail className="h-3 w-3" />
                                                        <span>
                                                            {lead.email}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {lead.property_address ? (
                                                <div className="flex items-start gap-1 max-w-[200px]">
                                                    <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                                    <span className="text-sm truncate">
                                                        {lead.property_address}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {getIntentBadge(lead.intent)}
                                                {getSentimentBadge(
                                                    lead.last_message_sentiment,
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">
                                                {lead.source}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={getUrgencyColor(
                                                    lead.urgency_score,
                                                )}
                                            >
                                                {lead.urgency_score}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(lead.status)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 max-w-[200px]">
                                                {lead.conversion_prediction && (
                                                    <span className="text-xs text-blue-600 dark:text-blue-400">
                                                        {
                                                            lead.conversion_prediction
                                                        }
                                                    </span>
                                                )}
                                                {lead.ai_suggestion && (
                                                    <span className="text-xs text-muted-foreground truncate">
                                                        {lead.ai_suggestion}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {lead.status !==
                                                    "contacted" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            handleStatusUpdate(
                                                                lead._id,
                                                                "contacted",
                                                            )
                                                        }
                                                    >
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        Contact
                                                    </Button>
                                                )}
                                                {lead.status !==
                                                    "qualified" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            handleStatusUpdate(
                                                                lead._id,
                                                                "qualified",
                                                            )
                                                        }
                                                    >
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Qualify
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}
            </div>

            {/* Add Lead Modal */}
            <AddLeadModal
                open={isAddLeadOpen}
                onOpenChange={setIsAddLeadOpen}
            />
        </div>
    );
}
