"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpDown, Filter, Plus } from "lucide-react";
import { AddLeadModal } from "./AddLeadModal";
import { LeadProfileModal } from "./LeadProfileModal";
import { LeadsStatCards } from "./LeadsStatCards";
import { LeadsEngineRow } from "./LeadsEngineRow";

type StatusFilter = "all" | "new" | "contacted" | "qualified";

export function LeadsDashboard() {
    const allLeads = useQuery(api.leads.queries.getAllLeads);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("new");
    const [sortByScore, setSortByScore] = useState(false);
    const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(
        null,
    );

    const stats = useMemo(() => {
        if (!allLeads) return { total: 0, new: 0, contacted: 0, qualified: 0 };
        return {
            total: allLeads.length,
            new: allLeads.filter((l: Doc<"leads">) => l.status === "new")
                .length,
            contacted: allLeads.filter(
                (l: Doc<"leads">) => l.status === "contacted",
            ).length,
            qualified: allLeads.filter(
                (l: Doc<"leads">) => l.status === "qualified",
            ).length,
        };
    }, [allLeads]);

    const filteredLeads = useMemo(() => {
        if (!allLeads) return [];
        const filtered =
            statusFilter === "all"
                ? allLeads
                : allLeads.filter(
                      (l: Doc<"leads">) => l.status === statusFilter,
                  );
        if (sortByScore) {
            return [...filtered].sort(
                (a, b) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0),
            );
        }
        return filtered;
    }, [allLeads, statusFilter, sortByScore]);

    if (allLeads === undefined) {
        return (
            <div className="flex h-full flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-10 rounded-lg" />
                <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-4">
            <LeadsStatCards
                newCount={stats.new}
                contactedCount={stats.contacted}
                qualifiedCount={stats.qualified}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                    <TabsList className="h-9">
                        <TabsTrigger value="new" className="text-xs px-3">
                            New Inquiry
                        </TabsTrigger>
                        <TabsTrigger value="contacted" className="text-xs px-3">
                            Contacted
                        </TabsTrigger>
                        <TabsTrigger value="qualified" className="text-xs px-3">
                            Qualified
                        </TabsTrigger>
                        <TabsTrigger value="all" className="text-xs px-3">
                            All
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        Total Leads:{" "}
                        <span className="font-semibold text-foreground">
                            {stats.total}
                        </span>
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled
                    >
                        <Filter className="mr-1 h-3.5 w-3.5" />
                        Filters
                    </Button>
                    <Button
                        variant={sortByScore ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setSortByScore((v) => !v)}
                    >
                        <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
                        Sort by AI Score
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
                        onClick={() => setIsAddLeadOpen(true)}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Lead
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                {filteredLeads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-card/30 py-12 text-center text-sm text-muted-foreground">
                        No leads in this status.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredLeads.map((lead: Doc<"leads">) => (
                            <LeadsEngineRow
                                key={lead._id}
                                lead={lead}
                                onClick={() => setSelectedLeadId(lead._id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <AddLeadModal
                open={isAddLeadOpen}
                onOpenChange={setIsAddLeadOpen}
            />

            {selectedLeadId && (
                <LeadProfileModal
                    open={selectedLeadId !== null}
                    onOpenChange={(open) => {
                        if (!open) setSelectedLeadId(null);
                    }}
                    leadId={selectedLeadId}
                />
            )}
        </div>
    );
}
