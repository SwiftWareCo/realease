"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Check, ListFilter, Search, UserCheck, Users } from "lucide-react";
import { REASON_LABELS } from "./constants";
import type { PickerData, PickerLead } from "./types";

type AudienceClassificationFilter = "all" | PickerLead["classification"];
type AudienceStatusFilter = "all" | PickerLead["status"];
type AudienceTypeFilter = "all" | "buyer" | "seller" | "investor" | "unknown";

function getLeadAudienceValue(lead: PickerLead): AudienceTypeFilter {
    return lead.leadType ?? lead.intent ?? "unknown";
}

function formatLeadAudience(value: AudienceTypeFilter | string | null) {
    switch (value) {
        case "buyer":
            return "Buyer";
        case "seller":
            return "Seller";
        case "investor":
            return "Investor";
        case "unknown":
            return "Unknown";
        case "all":
            return "All audiences";
        default:
            return value ?? "Unknown";
    }
}

function formatClassification(value: PickerLead["classification"]) {
    switch (value) {
        case "eligible":
            return "Eligible";
        case "conflict":
            return "Conflict";
        case "ineligible":
            return "Blocked";
    }
}

function formatLeadStatus(value: PickerLead["status"] | "all") {
    switch (value) {
        case "new":
            return "New";
        case "contacted":
            return "Contacted";
        case "qualified":
            return "Qualified";
        case "all":
            return "All statuses";
    }
}

function formatReason(reason: string) {
    return REASON_LABELS[reason] ?? reason.replaceAll("_", " ");
}

export function CampaignLeadAssignmentDialog({
    open,
    onOpenChange,
    campaignId,
    campaignName,
    isSubmitting,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    campaignId: Id<"outreachCampaigns">;
    campaignName: string;
    isSubmitting: boolean;
    onSubmit: (leadIds: Id<"leads">[]) => Promise<void>;
}) {
    const [search, setSearch] = useState("");
    const [audienceClassificationFilter, setAudienceClassificationFilter] =
        useState<AudienceClassificationFilter>("all");
    const [audienceStatusFilter, setAudienceStatusFilter] =
        useState<AudienceStatusFilter>("all");
    const [audienceTypeFilter, setAudienceTypeFilter] =
        useState<AudienceTypeFilter>("all");
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

    const pickerDataRaw = useQuery(
        api.outreach.queries.getOutreachLeadPicker,
        open
            ? {
                  campaignId,
                  limit: 500,
              }
            : "skip",
    );
    const pickerData = pickerDataRaw as PickerData | undefined;

    const filteredLeads = useMemo(() => {
        if (!pickerData) {
            return [];
        }
        const query = search.trim().toLowerCase();
        return pickerData.leads.filter((lead) => {
            const audience = getLeadAudienceValue(lead);
            const matchesClassification =
                audienceClassificationFilter === "all" ||
                lead.classification === audienceClassificationFilter;
            const matchesStatus =
                audienceStatusFilter === "all" ||
                lead.status === audienceStatusFilter;
            const matchesAudience =
                audienceTypeFilter === "all" || audience === audienceTypeFilter;
            const matchesSearch =
                !query ||
                lead.name.toLowerCase().includes(query) ||
                lead.phone.toLowerCase().includes(query) ||
                lead.status.toLowerCase().includes(query) ||
                audience.toLowerCase().includes(query) ||
                lead.intent.toLowerCase().includes(query) ||
                lead.reasons.join(" ").toLowerCase().includes(query) ||
                (lead.conflictCampaignName ?? "").toLowerCase().includes(query);
            return (
                matchesClassification &&
                matchesStatus &&
                matchesAudience &&
                matchesSearch
            );
        });
    }, [
        audienceClassificationFilter,
        audienceStatusFilter,
        audienceTypeFilter,
        pickerData,
        search,
    ]);

    const audienceStats = useMemo(() => {
        const leads = pickerData?.leads ?? [];
        return {
            total: leads.length,
            visible: filteredLeads.length,
            eligible: leads.filter((lead) => lead.classification === "eligible")
                .length,
            conflict: leads.filter((lead) => lead.classification === "conflict")
                .length,
            blocked: leads.filter((lead) => lead.classification === "ineligible")
                .length,
        };
    }, [filteredLeads.length, pickerData?.leads]);

    const visibleSelectableLeadIds = useMemo(
        () =>
            filteredLeads
                .filter((lead) => lead.selectable)
                .map((lead) => String(lead.leadId)),
        [filteredLeads],
    );
    const selectedLeadCount = selectedLeadIds.length;
    const estimatedTouches = selectedLeadCount * Math.max(pickerData?.maxAttempts ?? 1, 1);

    const toggleLead = (leadId: string) => {
        setSelectedLeadIds((current) =>
            current.includes(leadId)
                ? current.filter((value) => value !== leadId)
                : [...current, leadId],
        );
    };

    const selectVisibleLeads = () => {
        setSelectedLeadIds((current) =>
            Array.from(new Set([...current, ...visibleSelectableLeadIds])),
        );
    };

    const resetPicker = () => {
        setSelectedLeadIds([]);
        setSearch("");
        setAudienceClassificationFilter("all");
        setAudienceStatusFilter("all");
        setAudienceTypeFilter("all");
    };

    const handleSubmit = async () => {
        await onSubmit(selectedLeadIds as Id<"leads">[]);
        resetPicker();
    };

    const handleCancel = () => {
        if (!isSubmitting) {
            resetPicker();
        }
        onOpenChange(false);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && !isSubmitting) {
                    resetPicker();
                }
                onOpenChange(nextOpen);
            }}
        >
            <DialogContent className="max-h-[90vh] overflow-hidden rounded-[2rem] border-border/60 bg-card p-0 shadow-2xl sm:max-w-6xl">
                <DialogHeader className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_30%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)/0.35))] px-5 py-5 md:px-6">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-primary/90">
                        Audience selection
                    </p>
                    <DialogTitle className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                        Add leads to {campaignName}
                    </DialogTitle>
                </DialogHeader>

                <div className="max-h-[calc(90vh-12rem)] space-y-5 overflow-y-auto px-5 py-5 md:px-6">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {[
                            {
                                label: "Visible",
                                value: audienceStats.visible,
                                hint: `${audienceStats.total} total`,
                            },
                            {
                                label: "Eligible",
                                value: audienceStats.eligible,
                                hint: "Ready to enroll",
                            },
                            {
                                label: "Conflicts",
                                value: audienceStats.conflict,
                                hint: "Review first",
                            },
                            {
                                label: "Blocked",
                                value: audienceStats.blocked,
                                hint: "Not selectable",
                            },
                            {
                                label: "Selected",
                                value: selectedLeadCount,
                                hint: `${estimatedTouches} max touches`,
                            },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="rounded-[1.25rem] border border-border/60 bg-muted/30 px-4 py-3"
                            >
                                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                    {item.label}
                                </p>
                                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                                    {item.value}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {item.hint}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-[1.35rem] border border-border/60 bg-muted/20 p-3">
                        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1.4fr)_repeat(3,minmax(160px,1fr))]">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search name, phone, reason, or campaign"
                                    className="h-10 rounded-full border-border/70 bg-background pl-9"
                                />
                            </div>
                            <Select
                                value={audienceClassificationFilter}
                                onValueChange={(value) =>
                                    setAudienceClassificationFilter(
                                        value as AudienceClassificationFilter,
                                    )
                                }
                            >
                                <SelectTrigger className="h-10 w-full rounded-full border-border/70 bg-background">
                                    <ListFilter className="h-4 w-4 text-muted-foreground" />
                                    <SelectValue placeholder="Eligibility" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All eligibility</SelectItem>
                                    <SelectItem value="eligible">Eligible</SelectItem>
                                    <SelectItem value="conflict">Conflict</SelectItem>
                                    <SelectItem value="ineligible">Blocked</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                value={audienceStatusFilter}
                                onValueChange={(value) =>
                                    setAudienceStatusFilter(
                                        value as AudienceStatusFilter,
                                    )
                                }
                            >
                                <SelectTrigger className="h-10 w-full rounded-full border-border/70 bg-background">
                                    <SelectValue placeholder="Lead status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="contacted">Contacted</SelectItem>
                                    <SelectItem value="qualified">Qualified</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                value={audienceTypeFilter}
                                onValueChange={(value) =>
                                    setAudienceTypeFilter(
                                        value as AudienceTypeFilter,
                                    )
                                }
                            >
                                <SelectTrigger className="h-10 w-full rounded-full border-border/70 bg-background">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <SelectValue placeholder="Audience" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All audiences</SelectItem>
                                    <SelectItem value="buyer">Buyer</SelectItem>
                                    <SelectItem value="seller">Seller</SelectItem>
                                    <SelectItem value="investor">Investor</SelectItem>
                                    <SelectItem value="unknown">Unknown</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[1.45rem] border border-border/60 bg-background/70">
                        <div className="hidden grid-cols-[minmax(220px,1.2fr)_minmax(120px,0.6fr)_minmax(150px,0.7fr)_minmax(220px,1fr)_auto] gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground lg:grid">
                            <span>Lead</span>
                            <span>Audience</span>
                            <span>Status</span>
                            <span>Eligibility</span>
                            <span className="text-right">Pick</span>
                        </div>

                        {pickerData === undefined ? (
                            <div className="space-y-2 p-3">
                                {Array.from({ length: 8 }).map((_, index) => (
                                    <Skeleton
                                        key={index}
                                        className="h-16 rounded-[1rem]"
                                    />
                                ))}
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="px-5 py-12 text-center">
                                <p className="text-sm font-medium text-foreground">
                                    No leads match these filters.
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Loosen the search or switch eligibility back to all.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {filteredLeads.map((lead) => {
                                    const leadId = String(lead.leadId);
                                    const selected = selectedLeadIds.includes(leadId);
                                    const disabled = !lead.selectable;
                                    const audience = getLeadAudienceValue(lead);
                                    const reasonLabel =
                                        lead.reasons.length > 0
                                            ? lead.reasons
                                                  .slice(0, 2)
                                                  .map(formatReason)
                                                  .join(" / ")
                                            : "Ready for outreach";
                                    const classificationTone =
                                        lead.classification === "eligible"
                                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                            : lead.classification === "conflict"
                                              ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                                              : "border-border bg-muted text-muted-foreground";

                                    return (
                                        <button
                                            key={lead.leadId}
                                            type="button"
                                            disabled={disabled}
                                            aria-pressed={selected}
                                            onClick={() => toggleLead(leadId)}
                                            className={cn(
                                                "grid w-full gap-3 px-4 py-3 text-left transition lg:grid-cols-[minmax(220px,1.2fr)_minmax(120px,0.6fr)_minmax(150px,0.7fr)_minmax(220px,1fr)_auto] lg:items-center",
                                                disabled
                                                    ? "cursor-not-allowed bg-muted/20 opacity-70"
                                                    : selected
                                                      ? "bg-primary/10"
                                                      : "hover:bg-muted/35",
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="truncate text-sm font-semibold text-foreground">
                                                        {lead.name}
                                                    </p>
                                                    {lead.attemptsInCampaign > 0 ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="rounded-full border-border/70 bg-muted/40 px-2 py-0 text-[10px] text-muted-foreground"
                                                        >
                                                            {lead.attemptsInCampaign} attempt
                                                            {lead.attemptsInCampaign === 1
                                                                ? ""
                                                                : "s"}
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                    {lead.phone}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                                                >
                                                    {formatLeadAudience(audience)}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                                                >
                                                    {formatLeadStatus(lead.status)}
                                                </Badge>
                                            </div>
                                            <div className="min-w-0">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
                                                        classificationTone,
                                                    )}
                                                >
                                                    {formatClassification(lead.classification)}
                                                </Badge>
                                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                                    {lead.conflictCampaignName
                                                        ? `${reasonLabel}: ${lead.conflictCampaignName}`
                                                        : reasonLabel}
                                                </p>
                                            </div>
                                            <span
                                                aria-hidden="true"
                                                className={cn(
                                                    "ml-auto flex size-6 shrink-0 items-center justify-center rounded-full border transition",
                                                    selected
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-border/70 bg-background",
                                                    disabled && "opacity-50",
                                                )}
                                            >
                                                {selected ? (
                                                    <Check className="size-3.5" strokeWidth={3} />
                                                ) : null}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/60 bg-background/95 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                            {selectedLeadCount}
                        </span>{" "}
                        lead(s) selected for enrollment
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-border/70 bg-transparent"
                            onClick={selectVisibleLeads}
                            disabled={
                                visibleSelectableLeadIds.length === 0 || isSubmitting
                            }
                        >
                            <UserCheck className="h-4 w-4" />
                            Select visible
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            onClick={resetPicker}
                            disabled={selectedLeadCount === 0 || isSubmitting}
                        >
                            Clear
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-border/70 bg-transparent"
                            onClick={handleCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="rounded-full"
                            disabled={selectedLeadCount === 0 || isSubmitting}
                            onClick={handleSubmit}
                        >
                            Add leads
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
