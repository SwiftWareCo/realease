"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    TrendingUp,
    MessageSquare,
} from "lucide-react";
import { LeadsKanbanBoard } from "./LeadsKanbanBoard";

export function LeadsDashboard() {
    const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
    const [statusFilter, setStatusFilter] = useState<
        "all" | "new" | "contacted" | "qualified"
    >("all");
    const allLeads = useQuery(api.leads.queries.getAllLeads);
    const updateStatus = useMutation(api.leads.mutations.updateLeadStatus);

    const leads =
        statusFilter === "all"
            ? allLeads
            : allLeads?.filter(
                  (lead: Doc<"leads">) => lead.status === statusFilter,
              );

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

    const formatCreatedAt = (createdAt: number) => {
        return new Date(createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    // Separate priority leads (urgency >= 75)
    const priorityLeads =
        allLeads?.filter((lead: Doc<"leads">) => lead.urgency_score >= 75) ||
        [];
    const regularLeadsList =
        leads?.filter((lead: Doc<"leads">) => lead.urgency_score < 75) || [];

    if (allLeads === undefined) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Loading leads...</p>
                </CardContent>
            </Card>
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
        <div className="space-y-6">
            {/* Priority Leads Section */}
            {priorityLeads.length > 0 && (
                <Card className="border-red-500 border-2 bg-red-50 dark:bg-red-950/20">
                    <CardHeader>
                        <CardTitle className="flex items-center text-red-800 dark:text-red-300">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            🔥 Money-Critical Actions ({priorityLeads.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {priorityLeads.map((lead: Doc<"leads">) => (
                            <Card
                                key={lead._id}
                                className="hover:shadow-lg transition-shadow"
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center space-x-2 flex-wrap">
                                                <h3 className="font-bold text-lg">
                                                    {lead.name}
                                                </h3>
                                                <Badge
                                                    variant={
                                                        lead.urgency_score >= 75
                                                            ? "destructive"
                                                            : "default"
                                                    }
                                                >
                                                    {lead.urgency_score}%
                                                    Urgency
                                                </Badge>
                                                {getIntentBadge(lead.intent)}
                                                {lead.notes && (
                                                    <MessageSquare className="w-4 h-4 text-blue-500" />
                                                )}
                                                {getSentimentBadge(
                                                    lead.last_message_sentiment,
                                                )}
                                            </div>
                                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 space-x-4 flex-wrap">
                                                <span className="flex items-center">
                                                    <Phone className="w-4 h-4 mr-1" />
                                                    {lead.phone}
                                                </span>
                                                {lead.property_address && (
                                                    <span className="flex items-center">
                                                        <MapPin className="w-4 h-4 mr-1" />
                                                        {
                                                            lead.property_address.split(
                                                                ",",
                                                            )[0]
                                                        }
                                                    </span>
                                                )}
                                                <span className="flex items-center">
                                                    <Clock className="w-4 h-4 mr-1" />
                                                    Created{" "}
                                                    {formatCreatedAt(
                                                        lead.created_at,
                                                    )}
                                                </span>
                                            </div>
                                            {lead.notes && (
                                                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
                                                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                                                        📝 Notes:
                                                    </p>
                                                    <p className="text-sm text-yellow-800 dark:text-yellow-300 italic">
                                                        {lead.notes}
                                                    </p>
                                                </div>
                                            )}
                                            {lead.conversion_prediction && (
                                                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 flex items-center mb-1">
                                                        <TrendingUp className="w-4 h-4 mr-2" />
                                                        AI Prediction:{" "}
                                                        {
                                                            lead.conversion_prediction
                                                        }
                                                    </p>
                                                    {lead.ai_suggestion && (
                                                        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                                                            💡{" "}
                                                            {lead.ai_suggestion}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {lead.last_message_content && (
                                                <div
                                                    className={`p-2 rounded text-xs ${
                                                        lead.last_message_sentiment ===
                                                        "positive"
                                                            ? "bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"
                                                            : lead.last_message_sentiment ===
                                                                "negative"
                                                              ? "bg-red-100 dark:bg-red-950/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
                                                              : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                                                    }`}
                                                >
                                                    💬 Latest reply: &quot;
                                                    {lead.last_message_content}
                                                    &quot; →{" "}
                                                    {lead.last_message_sentiment ||
                                                        "neutral"}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            {lead.status !== "contacted" && (
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
                                            {lead.status !== "qualified" && (
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
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Leads
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            New
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {stats.new}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Contacted
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {stats.contacted}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Qualified
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {stats.qualified}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* View Toggle and Filters */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>All Leads</CardTitle>
                        <div className="flex items-center gap-2">
                            <Tabs
                                value={viewMode}
                                onValueChange={(value) =>
                                    setViewMode(value as "table" | "kanban")
                                }
                            >
                                <TabsList>
                                    <TabsTrigger value="kanban">
                                        <LayoutGrid className="h-4 w-4 mr-1" />
                                        Kanban
                                    </TabsTrigger>
                                    <TabsTrigger value="table">
                                        <Table2 className="h-4 w-4 mr-1" />
                                        Table
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            {viewMode === "table" && (
                                <Select
                                    value={statusFilter}
                                    onValueChange={(
                                        value:
                                            | "all"
                                            | "new"
                                            | "contacted"
                                            | "qualified",
                                    ) => setStatusFilter(value)}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All Statuses
                                        </SelectItem>
                                        <SelectItem value="new">New</SelectItem>
                                        <SelectItem value="contacted">
                                            Contacted
                                        </SelectItem>
                                        <SelectItem value="qualified">
                                            Qualified
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {viewMode === "kanban" ? (
                        <LeadsKanbanBoard />
                    ) : leads && leads.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No leads found.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
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
                                    {regularLeadsList?.map(
                                        (lead: Doc<"leads">) => (
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
                                                            <span>
                                                                {lead.phone}
                                                            </span>
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
                                                                {
                                                                    lead.property_address
                                                                }
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
                                                        {getIntentBadge(
                                                            lead.intent,
                                                        )}
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
                                                    {getStatusBadge(
                                                        lead.status,
                                                    )}
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
                                                                {
                                                                    lead.ai_suggestion
                                                                }
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
                                        ),
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* AI Suggestions */}
            {allLeads && allLeads.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>AI Suggestions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {allLeads
                                .filter(
                                    (lead: Doc<"leads">) =>
                                        lead.ai_suggestion &&
                                        lead.status === "new",
                                )
                                .slice(0, 5)
                                .map((lead: Doc<"leads">) => (
                                    <div
                                        key={lead._id}
                                        className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-medium">
                                                    {lead.name}
                                                </p>
                                                {getSentimentBadge(
                                                    lead.last_message_sentiment,
                                                )}
                                                {lead.conversion_prediction && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs"
                                                    >
                                                        {
                                                            lead.conversion_prediction
                                                        }
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                💡 {lead.ai_suggestion}
                                            </p>
                                            {lead.notes && (
                                                <p className="text-xs text-muted-foreground mt-2 italic">
                                                    📝 {lead.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
