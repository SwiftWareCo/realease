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
import { Label } from "@/components/ui/label";
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
import { REASON_LABELS, WizardStep } from "./constants";
import type {
    CampaignRow,
    CampaignTemplate,
    LeadEnrollmentReview,
    PickerData,
} from "./types";
import { getOutreachOutcomeLabel } from "@/lib/outreach/outcomes";
import { formatDateTimeHumanReadable } from "@/utils/dateandtimes";
import { RuntimeSummaryCard } from "./RuntimeSummaryCard";

type WizardStepKey = "template" | "leads" | "campaign" | "review";

type SubmitPayload = {
    templateKey?: CampaignTemplate["key"];
    campaignId?: Id<"outreachCampaigns">;
    campaignName?: string;
    leadIds: Id<"leads">[];
};

function getStepLabel(step: WizardStepKey): string {
    switch (step) {
        case "template":
            return "Template";
        case "leads":
            return "Lead Selection";
        case "campaign":
            return "Campaign";
        case "review":
            return "Review";
    }
}

export function StartOutreachWizardModal({
    campaigns,
    templates,
    fixedCampaign = null,
    open,
    isSubmitting,
    onOpenChange,
    onSubmit,
}: {
    campaigns: CampaignRow[];
    templates: CampaignTemplate[];
    fixedCampaign?: CampaignRow | null;
    open: boolean;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (payload: SubmitPayload) => Promise<void>;
}) {
    const defaultTemplateKey = fixedCampaign?.templateKey ?? templates[0]?.key ?? null;
    const [step, setStep] = useState<WizardStepKey>(
        fixedCampaign ? "leads" : "template",
    );
    const [selectedTemplateKey, setSelectedTemplateKey] = useState<
        CampaignTemplate["key"] | null
    >(defaultTemplateKey);
    const [search, setSearch] = useState("");
    const [targetMode, setTargetMode] = useState<"existing" | "new">(
        fixedCampaign ? "existing" : "new",
    );
    const [selectedCampaignId, setSelectedCampaignId] = useState<
        Id<"outreachCampaigns"> | null
    >(fixedCampaign?._id ?? null);
    const [campaignName, setCampaignName] = useState("");
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

    const activeTemplate = useMemo(
        () =>
            templates.find((template) => template.key === selectedTemplateKey) ??
            null,
        [selectedTemplateKey, templates],
    );

    const matchingCampaigns = useMemo(() => {
        if (fixedCampaign) {
            return [fixedCampaign];
        }
        return campaigns.filter(
            (campaign) => campaign.templateKey === selectedTemplateKey,
        );
    }, [campaigns, fixedCampaign, selectedTemplateKey]);

    const steps: WizardStepKey[] = fixedCampaign
        ? ["leads", "review"]
        : ["template", "leads", "campaign", "review"];
    const currentStepIndex = steps.indexOf(step);
    const effectiveTargetMode =
        fixedCampaign || matchingCampaigns.length > 0
            ? targetMode
            : "new";
    const effectiveSelectedCampaignId =
        fixedCampaign?._id ??
        (effectiveTargetMode === "existing"
            ? (selectedCampaignId ?? matchingCampaigns[0]?._id ?? null)
            : null);
    const selectedCampaignForSummary =
        matchingCampaigns.find(
            (campaign) => campaign._id === effectiveSelectedCampaignId,
        ) ??
        matchingCampaigns[0] ??
        null;
    const effectiveTemplateKey =
        fixedCampaign?.templateKey ?? selectedTemplateKey ?? null;
    const effectiveCampaignName = campaignName || activeTemplate?.defaultName || "";
    const campaignStepRuntimeSummary =
        effectiveTargetMode === "existing"
            ? selectedCampaignForSummary?.runtimeSummary
            : activeTemplate?.runtimeSummary;

    const pickerDataRaw = useQuery(
        api.outreach.queries.getOutreachLeadPicker,
        open && (effectiveTemplateKey || fixedCampaign?._id)
            ? {
                  templateKey: effectiveTemplateKey ?? undefined,
                  campaignId: fixedCampaign?._id,
                  limit: 500,
              }
            : "skip",
    );
    const pickerData = pickerDataRaw as PickerData | undefined;

    const reviewDataRaw = useQuery(
        api.outreach.queries.getLeadEnrollmentReview,
        open &&
            (effectiveTemplateKey || fixedCampaign?._id) &&
            selectedLeadIds.length > 0 &&
            (fixedCampaign ||
                effectiveTargetMode === "new" ||
                effectiveSelectedCampaignId)
            ? {
                  templateKey: effectiveTemplateKey ?? undefined,
                  campaignId:
                      fixedCampaign?._id ??
                      (effectiveTargetMode === "existing"
                          ? effectiveSelectedCampaignId ?? undefined
                          : undefined),
                  leadIds: selectedLeadIds as Id<"leads">[],
              }
            : "skip",
    );
    const reviewData = reviewDataRaw as LeadEnrollmentReview | undefined;

    const filteredLeads = useMemo(() => {
        if (!pickerData) {
            return [];
        }
        const query = search.trim().toLowerCase();
        if (!query) {
            return pickerData.leads;
        }
        return pickerData.leads.filter((lead) => {
            return (
                lead.name.toLowerCase().includes(query) ||
                lead.phone.toLowerCase().includes(query)
            );
        });
    }, [pickerData, search]);

    const selectedLeadIdSet = useMemo(
        () => new Set(selectedLeadIds),
        [selectedLeadIds],
    );

    const selectableLeadIds = useMemo(
        () =>
            filteredLeads
                .filter((lead) => lead.selectable)
                .map((lead) => String(lead.leadId)),
        [filteredLeads],
    );

    const allSelectableChecked =
        selectableLeadIds.length > 0 &&
        selectableLeadIds.every((leadId) => selectedLeadIdSet.has(leadId));

    const selectedInView = filteredLeads.filter((lead) =>
        selectedLeadIdSet.has(String(lead.leadId)),
    ).length;

    const blockedReasonCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const lead of filteredLeads) {
            if (lead.selectable) {
                continue;
            }
            for (const reason of lead.reasons) {
                counts.set(reason, (counts.get(reason) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [filteredLeads]);

    const resetState = () => {
        setStep(fixedCampaign ? "leads" : "template");
        setSearch("");
        setSelectedLeadIds([]);
        setSelectedTemplateKey(defaultTemplateKey);
        setSelectedCampaignId(fixedCampaign?._id ?? null);
        setTargetMode(
            fixedCampaign
                ? "existing"
                : campaigns.some((campaign) => campaign.templateKey === defaultTemplateKey)
                  ? "existing"
                  : "new",
        );
        setCampaignName(
            templates.find((template) => template.key === defaultTemplateKey)
                ?.defaultName ?? "",
        );
    };

    const handleTemplateSelection = (template: CampaignTemplate) => {
        const nextMatchingCampaigns = campaigns.filter(
            (campaign) => campaign.templateKey === template.key,
        );
        setSelectedTemplateKey(template.key);
        setSearch("");
        setSelectedLeadIds([]);
        setStep(fixedCampaign ? "leads" : "template");
        setCampaignName(template.defaultName);
        if (!fixedCampaign) {
            setTargetMode(
                nextMatchingCampaigns.length > 0 ? "existing" : "new",
            );
            setSelectedCampaignId(nextMatchingCampaigns[0]?._id ?? null);
        }
    };

    const toggleLead = (leadId: string) => {
        setSelectedLeadIds((current) =>
            current.includes(leadId)
                ? current.filter((value) => value !== leadId)
                : [...current, leadId],
        );
    };

    const toggleAllSelectable = () => {
        setSelectedLeadIds((current) => {
            if (allSelectableChecked) {
                return current.filter((leadId) => !selectableLeadIds.includes(leadId));
            }
            return Array.from(new Set([...current, ...selectableLeadIds]));
        });
    };

    const goNext = () => {
        const nextStep = steps[currentStepIndex + 1];
        if (nextStep) {
            setStep(nextStep);
        }
    };

    const goBack = () => {
        const previousStep = steps[currentStepIndex - 1];
        if (previousStep) {
            setStep(previousStep);
        }
    };

    const handleSubmit = async () => {
        if (!selectedTemplateKey || selectedLeadIds.length === 0) {
            return;
        }
        await onSubmit({
            templateKey: effectiveTemplateKey ?? undefined,
            campaignId:
                fixedCampaign?._id ??
                (effectiveTargetMode === "existing"
                    ? (effectiveSelectedCampaignId ?? undefined)
                    : undefined),
            campaignName:
                !fixedCampaign && effectiveTargetMode === "new"
                    ? effectiveCampaignName.trim() || activeTemplate?.defaultName
                    : undefined,
            leadIds: selectedLeadIds as Id<"leads">[],
        });
    };

    const canAdvanceFromTemplate = Boolean(effectiveTemplateKey);
    const canAdvanceFromLeads = selectedLeadIds.length > 0;
    const canAdvanceFromCampaign =
        effectiveTargetMode === "new"
            ? Boolean(effectiveCampaignName.trim())
            : Boolean(effectiveSelectedCampaignId);
    const eligibleCount = reviewData?.summary.eligibleCount ?? 0;

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    resetState();
                }
                onOpenChange(nextOpen);
            }}
        >
            <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-[1100px]">
                <DialogHeader>
                    <DialogTitle>
                        {fixedCampaign ? "Add Leads" : "Start Outreach"}
                    </DialogTitle>
                    <DialogDescription>
                        Pick a template, choose leads, then explicitly enroll and
                        schedule the eligible leads.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-4">
                    {steps.map((wizardStep, index) => (
                        <WizardStep
                            key={wizardStep}
                            active={step === wizardStep}
                            done={currentStepIndex > index}
                            label={getStepLabel(wizardStep)}
                        />
                    ))}
                </div>

                {step === "template" && (
                    <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                            {templates.map((template) => {
                                const selected =
                                    template.key === selectedTemplateKey;
                                return (
                                    <button
                                        key={template.key}
                                        type="button"
                                        onClick={() =>
                                            handleTemplateSelection(template)
                                        }
                                        className={`rounded-xl border p-4 text-left transition-colors ${
                                            selected
                                                ? "border-primary bg-primary/5"
                                                : "hover:border-primary/40 hover:bg-muted/30"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-base font-semibold">
                                                    {template.label}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Template v{template.version}
                                                </p>
                                            </div>
                                            {selected && (
                                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                                    Selected
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="mt-3 text-sm text-muted-foreground">
                                            {template.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                        <RuntimeSummaryCard
                            summary={activeTemplate?.runtimeSummary}
                        />
                    </div>
                )}

                {step === "leads" && (
                    <div className="space-y-3">
                        {!pickerData ? (
                            <div className="flex h-[460px] items-center justify-center">
                                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <Badge variant="outline" className="gap-1.5 py-0.5">
                                        <Users className="h-3.5 w-3.5" />
                                        In View: {filteredLeads.length}
                                    </Badge>
                                    <Badge variant="outline" className="gap-1.5 py-0.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        Selectable: {filteredLeads.filter((lead) => lead.selectable).length}
                                    </Badge>
                                    <Badge variant="outline" className="gap-1.5 py-0.5">
                                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                        Blocked: {filteredLeads.filter((lead) => !lead.selectable).length}
                                    </Badge>
                                    <Badge variant="outline" className="gap-1.5 py-0.5">
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
                                            Select all eligible leads in view
                                        </span>
                                    </div>
                                    <div className="relative w-full md:w-[280px]">
                                        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Search by name or phone"
                                            className="pl-8"
                                        />
                                    </div>
                                </div>

                                {blockedReasonCounts.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {blockedReasonCounts.map(([reason, count]) => (
                                            <Badge
                                                key={reason}
                                                variant="destructive"
                                                className="text-[11px]"
                                            >
                                                {REASON_LABELS[reason] ?? reason}: {count}
                                            </Badge>
                                        ))}
                                    </div>
                                )}

                                <ScrollArea className="h-[420px] rounded-md border">
                                    <Table>
                                        <TableHeader className="sticky top-0 z-10 bg-background">
                                            <TableRow>
                                                <TableHead className="w-12" />
                                                <TableHead>Lead</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Attempts</TableHead>
                                                <TableHead>Latest Outcome</TableHead>
                                                <TableHead>Eligibility</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredLeads.map((lead) => {
                                                const leadId = String(lead.leadId);
                                                return (
                                                    <TableRow key={leadId}>
                                                        <TableCell className="align-top">
                                                            <Checkbox
                                                                checked={selectedLeadIdSet.has(leadId)}
                                                                onCheckedChange={() => toggleLead(leadId)}
                                                                disabled={!lead.selectable}
                                                                aria-label={`Select ${lead.name}`}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="align-top">
                                                            <div className="font-medium">{lead.name}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {lead.phone}
                                                            </div>
                                                            {lead.conflictCampaignName && (
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    Active in {lead.conflictCampaignName}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="align-top">
                                                            <Badge variant="outline">{lead.status}</Badge>
                                                        </TableCell>
                                                        <TableCell className="align-top">
                                                            {lead.attemptsInCampaign}
                                                        </TableCell>
                                                        <TableCell className="align-top">
                                                            {lead.latestCampaignOutcome ? (
                                                                <Badge variant="secondary">
                                                                    {getOutreachOutcomeLabel(
                                                                        lead.latestCampaignOutcome,
                                                                    )}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="align-top">
                                                            {lead.selectable ? (
                                                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                                                    Eligible
                                                                </Badge>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {lead.reasons.map((reason) => (
                                                                        <Badge
                                                                            key={`${leadId}-${reason}`}
                                                                            variant="destructive"
                                                                            className="text-[11px]"
                                                                        >
                                                                            {REASON_LABELS[reason] ?? reason}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </>
                        )}
                    </div>
                )}

                {step === "campaign" && activeTemplate && (
                    <div className="space-y-3">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">
                                        Use Existing Campaign
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Button
                                        variant={
                                            effectiveTargetMode === "existing"
                                                ? "default"
                                                : "outline"
                                        }
                                        onClick={() => setTargetMode("existing")}
                                        disabled={matchingCampaigns.length === 0}
                                    >
                                        Existing {activeTemplate.label}
                                    </Button>
                                    <div className="space-y-2">
                                        {matchingCampaigns.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                No existing {activeTemplate.shortLabel.toLowerCase()} campaigns yet.
                                            </p>
                                        ) : (
                                            matchingCampaigns.map((campaign) => (
                                                <button
                                                    key={campaign._id}
                                                    type="button"
                                                    onClick={() => {
                                                        setTargetMode("existing");
                                                        setSelectedCampaignId(campaign._id);
                                                    }}
                                                    className={`w-full rounded-lg border p-3 text-left ${
                                                        effectiveTargetMode === "existing" &&
                                                        effectiveSelectedCampaignId === campaign._id
                                                            ? "border-primary bg-primary/5"
                                                            : "hover:bg-muted/40"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-medium">{campaign.name}</p>
                                                        <Badge variant="outline">{campaign.status}</Badge>
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {campaign.description ||
                                                            "No description"}
                                                    </p>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">
                                        Create New Campaign
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button
                                        variant={
                                            effectiveTargetMode === "new"
                                                ? "default"
                                                : "outline"
                                        }
                                        onClick={() => setTargetMode("new")}
                                    >
                                        New {activeTemplate.label}
                                    </Button>
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="start-outreach-campaign-name"
                                            className="text-xs text-muted-foreground"
                                        >
                                            Campaign name
                                        </Label>
                                        <Input
                                            id="start-outreach-campaign-name"
                                            value={effectiveCampaignName}
                                            onChange={(event) => setCampaignName(event.target.value)}
                                            disabled={effectiveTargetMode !== "new"}
                                            placeholder={activeTemplate.defaultName}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            New campaigns start from template defaults and can be edited after launch.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <RuntimeSummaryCard summary={campaignStepRuntimeSummary} />
                    </div>
                )}

                {step === "review" && (
                    <div className="space-y-3">
                        {!reviewData ? (
                            <div className="flex h-[420px] items-center justify-center">
                                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">
                                            Enrollment Summary
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline">
                                                Selected: {reviewData.summary.selectedCount}
                                            </Badge>
                                            <Badge variant="outline">
                                                Eligible: {reviewData.summary.eligibleCount}
                                            </Badge>
                                            <Badge variant="outline">
                                                Conflicts: {reviewData.summary.conflictCount}
                                            </Badge>
                                            <Badge variant="outline">
                                                Ineligible: {reviewData.summary.ineligibleCount}
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground">
                                            Final confirmation enrolls eligible leads and schedules them against the campaign rules.
                                        </p>
                                        {reviewData.target.dispatchMode === "next_window" &&
                                            reviewData.target.nextCallableAt && (
                                                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
                                                    This campaign is outside its calling window. Eligible leads will be queued for the next valid window at {formatDateTimeHumanReadable(reviewData.target.nextCallableAt)}.
                                                </p>
                                            )}
                                    </CardContent>
                                </Card>

                                <RuntimeSummaryCard
                                    summary={reviewData.target.runtimeSummary}
                                />

                                <div className="grid gap-3 lg:grid-cols-3">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">
                                                Eligible Leads
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            {reviewData.eligibleLeads.length === 0 ? (
                                                <p className="text-muted-foreground">No eligible leads selected.</p>
                                            ) : (
                                                reviewData.eligibleLeads.map((lead) => (
                                                    <div key={lead.leadId} className="rounded-md border p-3">
                                                        <p className="font-medium">{lead.name}</p>
                                                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                                                    </div>
                                                ))
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">
                                                Conflicts
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            {reviewData.conflictLeads.length === 0 ? (
                                                <p className="text-muted-foreground">No cross-campaign conflicts.</p>
                                            ) : (
                                                reviewData.conflictLeads.map((lead) => (
                                                    <div key={lead.leadId} className="rounded-md border p-3">
                                                        <p className="font-medium">{lead.name}</p>
                                                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {lead.conflictCampaignName
                                                                ? `Already active in ${lead.conflictCampaignName}.`
                                                                : "Already active in another campaign."}
                                                        </p>
                                                    </div>
                                                ))
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">
                                                Ineligible
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            {reviewData.ineligibleLeads.length === 0 ? (
                                                <p className="text-muted-foreground">No ineligible leads selected.</p>
                                            ) : (
                                                reviewData.ineligibleLeads.map((lead) => (
                                                    <div key={lead.leadId} className="rounded-md border p-3">
                                                        <p className="font-medium">{lead.name}</p>
                                                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {lead.reasons.map((reason) => (
                                                                <Badge
                                                                    key={`${lead.leadId}-${reason}`}
                                                                    variant="destructive"
                                                                    className="text-[11px]"
                                                                >
                                                                    {REASON_LABELS[reason] ?? reason}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between gap-2 border-t pt-4">
                    <Button
                        variant="outline"
                        onClick={() => {
                            resetState();
                            onOpenChange(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <div className="flex items-center gap-2">
                        {currentStepIndex > 0 && (
                            <Button variant="outline" onClick={goBack}>
                                Back
                            </Button>
                        )}
                        {step === "template" && (
                            <Button onClick={goNext} disabled={!canAdvanceFromTemplate}>
                                Next
                            </Button>
                        )}
                        {step === "leads" && (
                            <Button onClick={goNext} disabled={!canAdvanceFromLeads}>
                                Continue ({selectedLeadIds.length})
                            </Button>
                        )}
                        {step === "campaign" && (
                            <Button onClick={goNext} disabled={!canAdvanceFromCampaign}>
                                Review
                            </Button>
                        )}
                        {step === "review" && (
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || eligibleCount === 0}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enrolling...
                                    </>
                                ) : (
                                    `Enroll & Schedule (${eligibleCount})`
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
