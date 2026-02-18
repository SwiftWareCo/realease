"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    CheckCircle2,
    Loader2,
    Phone,
    Search,
    ShieldAlert,
    Users,
} from "lucide-react";
import { OUTCOME_LABELS, REASON_LABELS, WizardStep } from "./constants";
import type { PickerData } from "./types";

type StartOutreachCampaign = {
    _id: Id<"outreachCampaigns">;
    name: string;
};

export function StartOutreachWizardModal({
    campaign,
    open,
    isStarting,
    onOpenChange,
    onStart,
}: {
    campaign: StartOutreachCampaign | null;
    open: boolean;
    isStarting: boolean;
    onOpenChange: (open: boolean) => void;
    onStart: (
        campaignId: Id<"outreachCampaigns">,
        leadIds: Id<"leads">[],
    ) => Promise<void>;
}) {
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);
    const [search, setSearch] = useState("");
    const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
        new Set(),
    );

    const resetWizardState = () => {
        setWizardStep(1);
        setSearch("");
        setSelectedLeadIds(new Set());
    };

    const pickerQueryArgs = open
        ? campaign
            ? {
                  campaignId: campaign._id,
                  limit: 500,
              }
            : "skip"
        : "skip";
    const pickerDataRaw = useQuery(
        api.outreach.queries.getCampaignLeadPicker,
        pickerQueryArgs,
    );
    const pickerData = pickerDataRaw as PickerData | undefined;
    const isLoadingPicker = open
        ? campaign
            ? pickerData === undefined
            : false
        : false;

    const filteredLeads = useMemo(() => {
        if (!pickerData) return [];
        const q = search.trim().toLowerCase();
        if (!q) return pickerData.leads;
        return pickerData.leads.filter((lead) => {
            return (
                lead.name.toLowerCase().includes(q) ||
                lead.phone.toLowerCase().includes(q)
            );
        });
    }, [pickerData, search]);

    const selectableLeadIds = useMemo(() => {
        return filteredLeads
            .filter((lead) => lead.selectable)
            .map((lead) => String(lead.leadId));
    }, [filteredLeads]);

    const allSelectableChecked =
        selectableLeadIds.length > 0 &&
        selectableLeadIds.every((leadId) => selectedLeadIds.has(leadId));

    const selectedInView = useMemo(() => {
        return filteredLeads.filter((lead) =>
            selectedLeadIds.has(String(lead.leadId)),
        ).length;
    }, [filteredLeads, selectedLeadIds]);

    const reasonCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const lead of filteredLeads) {
            if (lead.selectable) continue;
            for (const reason of lead.reasons) {
                counts.set(reason, (counts.get(reason) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [filteredLeads]);

    const toggleLead = (leadId: string) => {
        setSelectedLeadIds((prev) => {
            const next = new Set(prev);
            if (next.has(leadId)) {
                next.delete(leadId);
            } else {
                next.add(leadId);
            }
            return next;
        });
    };

    const toggleAllSelectable = () => {
        setSelectedLeadIds((prev) => {
            const next = new Set(prev);
            if (allSelectableChecked) {
                selectableLeadIds.forEach((leadId) => next.delete(leadId));
            } else {
                selectableLeadIds.forEach((leadId) => next.add(leadId));
            }
            return next;
        });
    };

    const handleStart = async () => {
        if (!campaign || selectedLeadIds.size === 0) {
            return;
        }

        await onStart(
            campaign._id,
            Array.from(selectedLeadIds) as Id<"leads">[],
        );
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    resetWizardState();
                }
                onOpenChange(nextOpen);
            }}
        >
            <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-[1100px]">
                <DialogHeader>
                    <DialogTitle>
                        Start Outreach: {campaign?.name ?? "Campaign"}
                    </DialogTitle>
                    <DialogDescription>
                        Select leads, review runtime rules, then start outbound
                        calls.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-4">
                    <WizardStep
                        active={wizardStep === 1}
                        done={wizardStep > 1}
                        label="Lead Selection"
                    />
                    <WizardStep
                        active={wizardStep === 2}
                        done={false}
                        label="Review & Start"
                    />
                </div>

                {isLoadingPicker ? (
                    <div className="flex h-[460px] items-center justify-center">
                        <Loader2
                            className="h-7 w-7 animate-spin text-muted-foreground"
                            aria-label="Loading campaign leads"
                        />
                    </div>
                ) : wizardStep === 1 ? (
                    pickerData ? (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <Badge
                                    variant="outline"
                                    className="gap-1.5 py-0.5"
                                >
                                    <Users className="h-3.5 w-3.5" />
                                    In View: {filteredLeads.length}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="gap-1.5 py-0.5"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    Selectable:{" "}
                                    {
                                        filteredLeads.filter(
                                            (lead) => lead.selectable,
                                        ).length
                                    }
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="gap-1.5 py-0.5"
                                >
                                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                    Skipped:{" "}
                                    {
                                        filteredLeads.filter(
                                            (lead) => !lead.selectable,
                                        ).length
                                    }
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="gap-1.5 py-0.5"
                                >
                                    <Phone className="h-3.5 w-3.5 text-blue-600" />
                                    Selected: {selectedInView}
                                </Badge>
                            </div>

                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={allSelectableChecked}
                                        onCheckedChange={toggleAllSelectable}
                                        aria-label="Select all selectable leads"
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        Select all selectable leads in current
                                        view
                                    </span>
                                </div>
                                <div className="relative w-full md:w-[280px]">
                                    <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search by name or phone"
                                        className="pl-8"
                                    />
                                </div>
                            </div>

                            <ScrollArea className="h-[420px] rounded-md border">
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-background">
                                        <TableRow>
                                            <TableHead className="w-12" />
                                            <TableHead>Lead</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Attempts</TableHead>
                                            <TableHead>
                                                Latest Outcome
                                            </TableHead>
                                            <TableHead>Eligibility</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLeads.map((lead) => {
                                            const leadId = String(lead.leadId);
                                            const checked =
                                                selectedLeadIds.has(leadId);
                                            return (
                                                <TableRow key={leadId}>
                                                    <TableCell className="align-top">
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={() =>
                                                                toggleLead(
                                                                    leadId,
                                                                )
                                                            }
                                                            disabled={
                                                                !lead.selectable
                                                            }
                                                            aria-label={`Select ${lead.name}`}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        <div className="font-medium">
                                                            {lead.name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {lead.phone}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        <Badge variant="outline">
                                                            {lead.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        {
                                                            lead.attemptsInCampaign
                                                        }
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        {lead.latestCampaignOutcome ? (
                                                            <Badge variant="secondary">
                                                                {OUTCOME_LABELS[
                                                                    lead
                                                                        .latestCampaignOutcome
                                                                ] ??
                                                                    lead.latestCampaignOutcome}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                -
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        {lead.selectable ? (
                                                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                                                Selectable
                                                            </Badge>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1">
                                                                {lead.reasons.map(
                                                                    (
                                                                        reason,
                                                                    ) => (
                                                                        <Badge
                                                                            key={
                                                                                reason
                                                                            }
                                                                            variant="destructive"
                                                                            className="text-[11px]"
                                                                        >
                                                                            {REASON_LABELS[
                                                                                reason
                                                                            ] ??
                                                                                reason}
                                                                        </Badge>
                                                                    ),
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                                {filteredLeads.length === 0 && (
                                    <div className="p-8 text-center text-sm text-muted-foreground">
                                        No leads match your search.
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    ) : (
                        <div className="h-[460px]" />
                    )
                ) : pickerData ? (
                    <div className="space-y-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">
                                    Review: Calling Logic Applied At Start
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <p className="text-muted-foreground">
                                    The system re-checks every selected lead at
                                    execution time before any call is placed.
                                    Each attempt is inserted with
                                    <code> call_status=queued </code>
                                    before provider placement and
                                    <code> retell_call_id </code>
                                    is written after successful dispatch.
                                </p>
                                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                    <li>
                                        Campaign must be <code>active</code>.
                                    </li>
                                    <li>
                                        Current local campaign time must be
                                        inside <code>calling_window</code>.
                                    </li>
                                    <li>
                                        Lead phone must normalize to dialable
                                        E.164.
                                    </li>
                                    <li>
                                        Lead must not be{" "}
                                        <code>do_not_call</code>.
                                    </li>
                                    <li>
                                        Lead status must be <code>new</code> or{" "}
                                        <code>contacted</code>.
                                    </li>
                                    <li>
                                        No active call exists for the lead (
                                        <code>queued</code>,{" "}
                                        <code>ringing</code>,{" "}
                                        <code>in_progress</code>).
                                    </li>
                                    <li>
                                        Attempts in this campaign are below
                                        <code> retry_policy.max_attempts</code>.
                                    </li>
                                    <li>
                                        Latest campaign outcome is not terminal
                                        (<code>do_not_call</code>,{" "}
                                        <code>wrong_number</code>).
                                    </li>
                                    <li>
                                        Last campaign attempt is older than
                                        <code>
                                            {" "}
                                            retry_policy.min_minutes_between_attempts
                                        </code>
                                        .
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">
                                    Batch Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">
                                        Selected: {selectedLeadIds.size}
                                    </Badge>
                                    <Badge variant="outline">
                                        Search View: {filteredLeads.length}
                                    </Badge>
                                    <Badge variant="outline">
                                        Campaign Max Attempts:{" "}
                                        {pickerData.maxAttempts}
                                    </Badge>
                                </div>
                                {reasonCounts.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {reasonCounts.map(([reason, count]) => (
                                            <Badge
                                                key={reason}
                                                variant="destructive"
                                                className="text-[11px]"
                                            >
                                                {REASON_LABELS[reason] ??
                                                    reason}
                                                : {count}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="h-[460px]" />
                )}

                <div className="flex items-center justify-between gap-2 border-t pt-4">
                    <Button
                        variant="outline"
                        onClick={() => {
                            resetWizardState();
                            onOpenChange(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <div className="flex items-center gap-2">
                        {wizardStep === 2 && (
                            <Button
                                variant="outline"
                                onClick={() => setWizardStep(1)}
                            >
                                Back
                            </Button>
                        )}
                        {wizardStep === 1 ? (
                            <Button
                                onClick={() => setWizardStep(2)}
                                disabled={
                                    isLoadingPicker ||
                                    selectedLeadIds.size === 0
                                }
                            >
                                Review ({selectedLeadIds.size})
                            </Button>
                        ) : (
                            <Button
                                onClick={handleStart}
                                disabled={
                                    isLoadingPicker ||
                                    isStarting ||
                                    selectedLeadIds.size === 0
                                }
                            >
                                {isStarting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Starting...
                                    </>
                                ) : (
                                    `Start Outreach (${selectedLeadIds.size})`
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
