"use client";

import { createElement, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Plus, SlidersHorizontal, X } from "lucide-react";
import { AddLeadModal } from "./AddLeadModal";
import { LeadsStatCards } from "./LeadsStatCards";
import { LeadsEngineRow } from "./LeadsEngineRow";
import { useRouter } from "next/navigation";
import {
    deriveTier,
    formatOrigin,
    getOriginIcon,
    getTierColor,
    parseMarket,
} from "./leads-ui";

type StatusFilter = "all" | "new" | "contacted" | "qualified";
type IntentFilter = "all" | "buyer" | "seller" | "investor";
type DateFilter = "any" | "today" | "7d" | "30d" | "90d";
type ScoreFilter = "any" | "80" | "65" | "50";

const normalizeLabel = (value: string) =>
    value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

const labelize = (value: string) =>
    value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

const formatCreatedAt = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const intentConfig = {
    buyer: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    seller: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    investor: "border-violet-500/30 bg-violet-500/10 text-violet-200",
} as const;

const statusConfig = {
    new: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    contacted: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    qualified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
} as const;

export function LeadsDashboard() {
    const router = useRouter();
    const allLeads = useQuery(api.leads.queries.getAllLeads);
    const allTags = useQuery(api.leads.queries.getAllTags) ?? [];
    const [now] = useState(() => Date.now());
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [intentFilter, setIntentFilter] = useState<IntentFilter>("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [tagFilter, setTagFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState<DateFilter>("any");
    const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("any");
    const [search, setSearch] = useState("");
    const [sortByScore, setSortByScore] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);

    const stats = useMemo(() => {
        if (!allLeads) {
            return { total: 0, new: 0, contacted: 0, qualified: 0 };
        }
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

    const uniqueSources = useMemo(() => {
        if (!allLeads) return [];
        return Array.from(new Set(allLeads.map((lead) => lead.source)))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    }, [allLeads]);

    const filteredLeads = useMemo(() => {
        if (!allLeads) return [];

        const minScore =
            scoreFilter === "any" ? null : Number.parseInt(scoreFilter, 10);
        const searchValue = search.trim().toLowerCase();

        return allLeads
            .filter((lead: Doc<"leads">) => {
                if (statusFilter !== "all" && lead.status !== statusFilter) {
                    return false;
                }

                if (intentFilter !== "all" && lead.intent !== intentFilter) {
                    return false;
                }

                if (sourceFilter !== "all" && lead.source !== sourceFilter) {
                    return false;
                }

                if (tagFilter !== "all" && !(lead.tags ?? []).includes(tagFilter)) {
                    return false;
                }

                if (minScore !== null && (lead.urgency_score ?? 0) < minScore) {
                    return false;
                }

                if (dateFilter !== "any") {
                    const createdAt = lead.created_at ?? lead._creationTime;
                    const elapsed = now - createdAt;
                    const day = 24 * 60 * 60 * 1000;
                    const limit =
                        dateFilter === "today"
                            ? day
                            : dateFilter === "7d"
                              ? 7 * day
                              : dateFilter === "30d"
                                ? 30 * day
                                : 90 * day;
                    if (elapsed > limit) {
                        return false;
                    }
                }

                if (!searchValue) return true;

                const haystack = [
                    lead.name,
                    lead.phone,
                    lead.email,
                    lead.property_address,
                    lead.source,
                    ...(lead.tags ?? []),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                return haystack.includes(searchValue);
            })
            .sort((a, b) => {
                if (sortByScore) {
                    return (b.urgency_score ?? 0) - (a.urgency_score ?? 0);
                }
                return (b.created_at ?? b._creationTime) - (a.created_at ?? a._creationTime);
            });
    }, [
        allLeads,
        dateFilter,
        intentFilter,
        now,
        sortByScore,
        scoreFilter,
        search,
        sourceFilter,
        statusFilter,
        tagFilter,
    ]);

    const activeFilterCount = [
        statusFilter !== "all",
        intentFilter !== "all",
        sourceFilter !== "all",
        tagFilter !== "all",
        dateFilter !== "any",
        scoreFilter !== "any",
        search.trim().length > 0,
    ].filter(Boolean).length;

    const openLeadProfile = (leadId: string) => {
        router.push(`/leads/${leadId}`);
    };

    if (allLeads === undefined) {
        return (
            <div className="flex h-full flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-32 rounded-2xl" />
                <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-4">
            <LeadsStatCards
                totalCount={stats.total}
                newCount={stats.new}
                contactedCount={stats.contacted}
                qualifiedCount={stats.qualified}
            />

            <div className="rounded-xl border border-border/60 bg-card/60 px-3 py-2 shadow-[0_12px_40px_-30px_rgba(249,115,22,0.45)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Tabs
                        value={statusFilter}
                        onValueChange={(value) =>
                            setStatusFilter(value as StatusFilter)
                        }
                    >
                        <TabsList className="h-8 bg-muted/60 p-1">
                            <TabsTrigger value="new" className="px-2.5 text-xs">
                                New Inquiry
                            </TabsTrigger>
                            <TabsTrigger value="contacted" className="px-2.5 text-xs">
                                Contacted
                            </TabsTrigger>
                            <TabsTrigger value="qualified" className="px-2.5 text-xs">
                                Qualified
                            </TabsTrigger>
                            <TabsTrigger value="all" className="px-2.5 text-xs">
                                All
                            </TabsTrigger>
                            </TabsList>
                        </Tabs>

                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search leads..."
                        className="h-8 w-full min-w-[180px] text-xs md:w-[220px]"
                    />

                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-1 text-xs text-muted-foreground">
                            Total Leads:{" "}
                            <span className="font-semibold text-foreground">
                                {stats.total}
                            </span>
                        </span>
                        <Button
                            variant={showAdvancedFilters ? "secondary" : "outline"}
                            size="sm"
                            className="h-8 gap-1.5 px-2.5 text-xs"
                            onClick={() =>
                                setShowAdvancedFilters((current) => !current)
                            }
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                        <Button
                            variant={sortByScore ? "default" : "outline"}
                            size="sm"
                            className="h-8 gap-1.5 px-2.5 text-xs"
                            onClick={() => setSortByScore((current) => !current)}
                        >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            Sort by AI Score
                        </Button>
                        <Button
                            size="sm"
                            className="h-8 gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 px-2.5 text-xs text-white hover:from-orange-600 hover:to-orange-700"
                            onClick={() => setIsAddLeadOpen(true)}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Lead
                        </Button>
                    </div>
                </div>

                {showAdvancedFilters && (
                    <div className="mt-2 grid gap-2 border-t border-border/60 pt-2 md:grid-cols-2 xl:grid-cols-6">
                        <select
                            value={intentFilter}
                            onChange={(e) =>
                                setIntentFilter(e.target.value as IntentFilter)
                            }
                            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
                        >
                            <option value="all">All types</option>
                            <option value="buyer">Buyer</option>
                            <option value="seller">Seller</option>
                            <option value="investor">Investor</option>
                        </select>

                        <select
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
                        >
                            <option value="all">All sources</option>
                            {uniqueSources.map((source) => (
                                <option key={source} value={source}>
                                    {normalizeLabel(source)}
                                </option>
                            ))}
                        </select>

                        <select
                            value={tagFilter}
                            onChange={(e) => setTagFilter(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
                        >
                            <option value="all">All tags</option>
                            {allTags.map((tag) => (
                                <option key={tag} value={tag}>
                                    {tag}
                                </option>
                            ))}
                        </select>

                        <div className="grid grid-cols-3 gap-2 xl:col-span-3">
                            <select
                                value={dateFilter}
                                onChange={(e) =>
                                    setDateFilter(e.target.value as DateFilter)
                                }
                                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
                            >
                                <option value="any">Any date</option>
                                <option value="today">Today</option>
                                <option value="7d">Last 7d</option>
                                <option value="30d">Last 30d</option>
                                <option value="90d">Last 90d</option>
                            </select>

                            <select
                                value={scoreFilter}
                                onChange={(e) =>
                                    setScoreFilter(e.target.value as ScoreFilter)
                                }
                                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
                            >
                                <option value="any">Any score</option>
                                <option value="80">80+</option>
                                <option value="65">65+</option>
                                <option value="50">50+</option>
                            </select>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                onClick={() => {
                                    setStatusFilter("all");
                                    setIntentFilter("all");
                                    setSourceFilter("all");
                                    setTagFilter("all");
                                    setDateFilter("any");
                                    setScoreFilter("any");
                                    setSearch("");
                                }}
                                disabled={activeFilterCount === 0}
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {filteredLeads.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 py-16 text-center text-sm text-muted-foreground">
                        No leads match the current filters.
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card/30 lg:block">
                            <Table className="table-fixed">
                                <colgroup>
                                    <col className="w-[36%]" />
                                    <col className="w-[22%]" />
                                    <col className="w-[14%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[8%]" />
                                </colgroup>
                                <TableHeader className="sticky top-0 z-20 border-b border-border/60 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                                    <TableRow className="border-0 hover:bg-transparent">
                                        {[
                                            "Lead",
                                            "AI Score",
                                            "Source",
                                            "Status",
                                            "Date Added",
                                            "Tags",
                                        ].map((label) => (
                                            <TableHead
                                                key={label}
                                                className="h-11 px-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
                                            >
                                                {label}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLeads.map((lead: Doc<"leads">) => {
                                        const score = Math.max(
                                            0,
                                            Math.min(100, lead.urgency_score ?? 0),
                                        );
                                        const tier = deriveTier(lead);
                                        const tierColor = getTierColor(tier);
                                        const market = parseMarket(lead);
                                        const origin = formatOrigin(lead.source);
                                        const tags = lead.tags ?? [];
                                        const Icon = getOriginIcon(lead.source);
                                        const initial = (
                                            lead.name?.trim()?.[0] ?? "?"
                                        ).toUpperCase();
                                        return (
                                            <TableRow
                                                key={lead._id}
                                                className="cursor-pointer border-border/40 hover:bg-muted/20"
                                                onClick={() =>
                                                    openLeadProfile(lead._id)
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === "Enter" ||
                                                        event.key === " "
                                                    ) {
                                                        event.preventDefault();
                                                        openLeadProfile(lead._id);
                                                    }
                                                }}
                                                tabIndex={0}
                                            >
                                                <TableCell className="relative py-4 pl-4 pr-4">
                                                    <span
                                                        className={cn(
                                                            "absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full",
                                                            tierColor.accent,
                                                        )}
                                                        aria-hidden
                                                    />
                                                    <div className="flex min-w-0 items-center gap-3 pl-3">
                                                        <div
                                                            className={cn(
                                                                "flex h-10 w-10 flex-none items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground ring-1 ring-border",
                                                                tierColor.glow,
                                                            )}
                                                        >
                                                            {initial}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-semibold text-foreground">
                                                                {lead.name}
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                                <span className="truncate">
                                                                    {market}
                                                                </span>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={cn(
                                                                        "text-[10px]",
                                                                        intentConfig[
                                                                            lead.intent
                                                                        ],
                                                                    )}
                                                                >
                                                                    {labelize(
                                                                        lead.intent,
                                                                    )}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-4">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className="w-8 text-right text-sm font-semibold text-foreground">
                                                            {score}
                                                        </span>
                                                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all",
                                                                    tierColor.bar,
                                                                )}
                                                                style={{
                                                                    width: `${score}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-4">
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        {createElement(Icon, {
                                                            className:
                                                                "h-3.5 w-3.5 text-muted-foreground",
                                                        })}
                                                        <span className="truncate">
                                                            {origin}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-4">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[10px]",
                                                            statusConfig[
                                                                lead.status
                                                            ],
                                                        )}
                                                    >
                                                        {labelize(lead.status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-4 px-4 text-xs text-foreground/80">
                                                    {formatCreatedAt(
                                                        lead.created_at ??
                                                            lead._creationTime,
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-4 px-4">
                                                    {tags.length > 0 ? (
                                                        <div className="flex min-w-0 flex-wrap gap-1.5">
                                                            {tags
                                                                .slice(0, 1)
                                                                .map((tag) => (
                                                                    <Badge
                                                                        key={tag}
                                                                        variant="secondary"
                                                                        className="bg-muted/70 text-[10px]"
                                                                    >
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                            {tags.length > 1 && (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="bg-muted/70 text-[10px]"
                                                                >
                                                                    +
                                                                    {tags.length -
                                                                        1}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">
                                                            No tags
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="space-y-2 lg:hidden">
                            {filteredLeads.map((lead: Doc<"leads">) => (
                                <LeadsEngineRow
                                    key={lead._id}
                                    lead={lead}
                                    onClick={() => openLeadProfile(lead._id)}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <AddLeadModal
                open={isAddLeadOpen}
                onOpenChange={setIsAddLeadOpen}
            />
        </div>
    );
}
