"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    CheckCircle2,
    Loader2,
    Phone,
    Search,
    ShieldAlert,
    Users,
} from "lucide-react";
import { toast } from "sonner";
import { HOURS, REASON_LABELS, WEEKDAYS, WizardStep } from "./constants";
import type {
    CampaignRow,
    CampaignTemplate,
    LeadEnrollmentReview,
    PickerData,
} from "./types";
import { getOutreachOutcomeLabel } from "@/lib/outreach/outcomes";
import {
    formatDateTimeHumanReadable,
    formatHourTo12Hour,
} from "@/utils/dateandtimes";
import { RuntimeSummaryCard } from "./RuntimeSummaryCard";

type WizardStepKey = "template" | "leads" | "campaign" | "review";

type SubmitPayload = {
    templateKey?: CampaignTemplate["key"];
    customTemplateId?: Id<"outreachCampaignTemplates">;
    campaignId?: Id<"outreachCampaigns">;
    campaignName?: string;
    leadIds: Id<"leads">[];
};

type BaseTemplateKey = CampaignTemplate["key"];

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
    const defaultTemplateSelectionKey =
        fixedCampaign?.templateSelectionKey ?? templates[0]?.selectionKey ?? null;
    const [step, setStep] = useState<WizardStepKey>(
        fixedCampaign ? "leads" : "template",
    );
    const [selectedTemplateSelectionKey, setSelectedTemplateSelectionKey] =
        useState<string | null>(defaultTemplateSelectionKey);
    const [search, setSearch] = useState("");
    const [targetMode, setTargetMode] = useState<"existing" | "new">(
        fixedCampaign ? "existing" : "new",
    );
    const [selectedCampaignId, setSelectedCampaignId] = useState<
        Id<"outreachCampaigns"> | null
    >(fixedCampaign?._id ?? null);
    const [campaignName, setCampaignName] = useState("");
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [templateBaseKey, setTemplateBaseKey] = useState<BaseTemplateKey>(
        templates[0]?.key ?? "buyer_outreach",
    );
    const [templateName, setTemplateName] = useState("Custom Outreach");
    const [templateDescription, setTemplateDescription] = useState("");
    const [templateCallObjective, setTemplateCallObjective] = useState(
        templates[0]?.agentInstructions.call_objective ?? "",
    );
    const [templateOpeningLine, setTemplateOpeningLine] = useState(
        templates[0]?.agentInstructions.opening_line ?? "",
    );
    const [templateTone, setTemplateTone] = useState(
        templates[0]?.agentInstructions.tone ?? "",
    );
    const [templateQuestions, setTemplateQuestions] = useState(
        templates[0]?.agentInstructions.qualification_questions.join("\n") ??
            "",
    );
    const [templateObjectionNotes, setTemplateObjectionNotes] = useState(
        templates[0]?.agentInstructions.objection_handling_notes ?? "",
    );
    const [templateVoicemailGuidance, setTemplateVoicemailGuidance] = useState(
        templates[0]?.agentInstructions.voicemail_guidance ?? "",
    );
    const [templateComplianceDisclosure, setTemplateComplianceDisclosure] =
        useState(templates[0]?.agentInstructions.compliance_disclosure ?? "");
    const [templateStartHour, setTemplateStartHour] = useState(
        templates[0]?.runtimeSummary.callingWindow.start_hour_local ?? 9,
    );
    const [templateEndHour, setTemplateEndHour] = useState(
        templates[0]?.runtimeSummary.callingWindow.end_hour_local ?? 18,
    );
    const [templateAllowedWeekdays, setTemplateAllowedWeekdays] = useState<
        number[]
    >(
        templates[0]?.runtimeSummary.callingWindow.allowed_weekdays ?? [
            1, 2, 3, 4, 5,
        ],
    );
    const [templateMaxAttempts, setTemplateMaxAttempts] = useState(
        templates[0]?.runtimeSummary.maxAttempts ?? 3,
    );
    const [templateCooldownMinutes, setTemplateCooldownMinutes] = useState(
        templates[0]?.runtimeSummary.cooldownMinutes ?? 60,
    );
    const [templateFollowUpSmsEnabled, setTemplateFollowUpSmsEnabled] =
        useState(templates[0]?.runtimeSummary.followUpSms.enabled ?? true);
    const [templateFollowUpSmsTemplate, setTemplateFollowUpSmsTemplate] =
        useState(templates[0]?.runtimeSummary.followUpSms.defaultTemplate ?? "");
    const createTemplate = useMutation(
        api.outreach.mutations.createCampaignTemplate,
    );

    const activeTemplate = useMemo(
        () =>
            templates.find(
                (template) =>
                    template.selectionKey === selectedTemplateSelectionKey,
            ) ?? null,
        [selectedTemplateSelectionKey, templates],
    );
    const systemTemplates = useMemo(
        () => templates.filter((template) => template.source === "system"),
        [templates],
    );

    const matchingCampaigns = useMemo(() => {
        if (fixedCampaign) {
            return [fixedCampaign];
        }
        return campaigns.filter(
            (campaign) =>
                campaign.templateSelectionKey === selectedTemplateSelectionKey,
        );
    }, [campaigns, fixedCampaign, selectedTemplateSelectionKey]);

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
        fixedCampaign?.templateKey ?? activeTemplate?.key ?? null;
    const effectiveCustomTemplateId =
        fixedCampaign?.customTemplateId ?? activeTemplate?.templateId ?? null;
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
                  customTemplateId: effectiveCustomTemplateId ?? undefined,
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
                  customTemplateId: effectiveCustomTemplateId ?? undefined,
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

    const applyTemplateDraftDefaults = (template: CampaignTemplate) => {
        setTemplateBaseKey(template.key);
        setTemplateName(`Custom ${template.shortLabel} Outreach`);
        setTemplateDescription(template.description);
        setTemplateCallObjective(template.agentInstructions.call_objective);
        setTemplateOpeningLine(template.agentInstructions.opening_line);
        setTemplateTone(template.agentInstructions.tone);
        setTemplateQuestions(
            template.agentInstructions.qualification_questions.join("\n"),
        );
        setTemplateObjectionNotes(
            template.agentInstructions.objection_handling_notes,
        );
        setTemplateVoicemailGuidance(
            template.agentInstructions.voicemail_guidance,
        );
        setTemplateComplianceDisclosure(
            template.agentInstructions.compliance_disclosure ?? "",
        );
        setTemplateStartHour(
            template.runtimeSummary.callingWindow.start_hour_local,
        );
        setTemplateEndHour(
            template.runtimeSummary.callingWindow.end_hour_local,
        );
        setTemplateAllowedWeekdays(
            template.runtimeSummary.callingWindow.allowed_weekdays,
        );
        setTemplateMaxAttempts(template.runtimeSummary.maxAttempts);
        setTemplateCooldownMinutes(template.runtimeSummary.cooldownMinutes);
        setTemplateFollowUpSmsEnabled(template.runtimeSummary.followUpSms.enabled);
        setTemplateFollowUpSmsTemplate(
            template.runtimeSummary.followUpSms.defaultTemplate ?? "",
        );
    };

    const openTemplateCreator = () => {
        const baseTemplate =
            systemTemplates.find((template) => template.key === activeTemplate?.key) ??
            systemTemplates[0] ??
            templates[0];
        if (baseTemplate) {
            applyTemplateDraftDefaults(baseTemplate);
        }
        setIsCreatingTemplate(true);
    };

    const toggleTemplateWeekday = (weekday: number) => {
        setTemplateAllowedWeekdays((current) =>
            current.includes(weekday)
                ? current.filter((value) => value !== weekday)
                : [...current, weekday].sort((a, b) => a - b),
        );
    };

    const handleBaseTemplateChange = (value: BaseTemplateKey) => {
        const baseTemplate =
            systemTemplates.find((template) => template.key === value) ??
            templates.find((template) => template.key === value);
        if (baseTemplate) {
            applyTemplateDraftDefaults(baseTemplate);
        } else {
            setTemplateBaseKey(value);
        }
    };

    const handleCreateTemplate = async () => {
        const label = templateName.trim();
        if (!label) {
            toast.error("Template name is required.");
            return;
        }
        if (!templateCallObjective.trim() || !templateOpeningLine.trim()) {
            toast.error("Add a call objective and opening line.");
            return;
        }
        if (templateAllowedWeekdays.length === 0) {
            toast.error("Choose at least one calling day.");
            return;
        }
        if (templateMaxAttempts < 1 || templateCooldownMinutes < 0) {
            toast.error("Template retry settings are invalid.");
            return;
        }
        setIsSavingTemplate(true);
        try {
            const templateId = await createTemplate({
                base_template_key: templateBaseKey,
                label,
                description: templateDescription.trim(),
                agent_instructions: {
                    call_objective: templateCallObjective.trim(),
                    opening_line: templateOpeningLine.trim(),
                    tone: templateTone.trim(),
                    qualification_questions: templateQuestions
                        .split("\n")
                        .map((question) => question.trim())
                        .filter(Boolean),
                    objection_handling_notes: templateObjectionNotes.trim(),
                    voicemail_guidance: templateVoicemailGuidance.trim(),
                    compliance_disclosure:
                        templateComplianceDisclosure.trim() || undefined,
                },
                calling_window: {
                    start_hour_local: templateStartHour,
                    end_hour_local: templateEndHour,
                    allowed_weekdays: templateAllowedWeekdays as Array<
                        0 | 1 | 2 | 3 | 4 | 5 | 6
                    >,
                },
                retry_policy: {
                    max_attempts: templateMaxAttempts,
                    min_minutes_between_attempts: templateCooldownMinutes,
                },
                follow_up_sms: {
                    enabled: templateFollowUpSmsEnabled,
                    delay_minutes: 3,
                    default_template:
                        templateFollowUpSmsTemplate.trim() || undefined,
                    send_only_on_outcomes: templateFollowUpSmsEnabled
                        ? ["no_answer", "voicemail_left"]
                        : [],
                },
            });
            setSelectedTemplateSelectionKey(`custom:${templateId}`);
            setCampaignName(label);
            setSelectedLeadIds([]);
            setSelectedCampaignId(null);
            setTargetMode("new");
            setIsCreatingTemplate(false);
            toast.success("Template created. It is selected for this outreach.");
        } catch (error) {
            console.error("Failed to create campaign template", error);
            toast.error("Failed to create campaign template.");
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const resetState = () => {
        setStep(fixedCampaign ? "leads" : "template");
        setSearch("");
        setSelectedLeadIds([]);
        setSelectedTemplateSelectionKey(defaultTemplateSelectionKey);
        setSelectedCampaignId(fixedCampaign?._id ?? null);
        setTargetMode(
            fixedCampaign
                ? "existing"
                : campaigns.some(
                      (campaign) =>
                          campaign.templateSelectionKey ===
                          defaultTemplateSelectionKey,
                  )
                  ? "existing"
                  : "new",
        );
        setCampaignName(
            templates.find(
                (template) =>
                    template.selectionKey === defaultTemplateSelectionKey,
            )
                ?.defaultName ?? "",
        );
        setIsCreatingTemplate(false);
    };

    const handleTemplateSelection = (template: CampaignTemplate) => {
        const nextMatchingCampaigns = campaigns.filter(
            (campaign) =>
                campaign.templateSelectionKey === template.selectionKey,
        );
        setSelectedTemplateSelectionKey(template.selectionKey);
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
        if (!effectiveTemplateKey || selectedLeadIds.length === 0) {
            return;
        }
        await onSubmit({
            templateKey: effectiveTemplateKey ?? undefined,
            customTemplateId: effectiveCustomTemplateId ?? undefined,
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
            <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-[1100px]">
                <DialogHeader>
                    <DialogTitle>
                        {fixedCampaign ? "Add Leads" : "Start Outreach"}
                    </DialogTitle>
                    <DialogDescription>
                        Pick a template, choose leads, then explicitly enroll and
                        schedule the eligible leads.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
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
                                    template.selectionKey ===
                                    selectedTemplateSelectionKey;
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
                                                    {template.source === "custom"
                                                        ? "Custom template"
                                                        : `Template v${template.version}`}
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
                        {!fixedCampaign && (
                            <div className="rounded-xl border border-dashed bg-muted/20 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-sm font-medium">
                                            Need a different agent script?
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Create a reusable buyer or seller template here.
                                            It will be selected after save; outreach still only
                                            starts after final confirmation.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={
                                            isCreatingTemplate
                                                ? () => setIsCreatingTemplate(false)
                                                : openTemplateCreator
                                        }
                                    >
                                        {isCreatingTemplate
                                            ? "Close Template Builder"
                                            : "Create Template"}
                                    </Button>
                                </div>

                                {isCreatingTemplate && (
                                    <div className="mt-4 space-y-4 border-t pt-4">
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="template-base-type">
                                                    Start from default
                                                </Label>
                                                <Select
                                                    value={templateBaseKey}
                                                    onValueChange={(value) =>
                                                        handleBaseTemplateChange(
                                                            value as BaseTemplateKey,
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger id="template-base-type">
                                                        <SelectValue placeholder="Choose buyer or seller" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {systemTemplates.map(
                                                            (template) => (
                                                                <SelectItem
                                                                    key={
                                                                        template.selectionKey
                                                                    }
                                                                    value={
                                                                        template.key
                                                                    }
                                                                >
                                                                    {
                                                                        template.label
                                                                    }
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="template-name">
                                                    Template name
                                                </Label>
                                                <Input
                                                    id="template-name"
                                                    value={templateName}
                                                    onChange={(event) =>
                                                        setTemplateName(
                                                            event.target.value,
                                                        )
                                                    }
                                                    placeholder="Custom Buyer Follow-up"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="template-description">
                                                Description
                                            </Label>
                                            <Textarea
                                                id="template-description"
                                                value={templateDescription}
                                                onChange={(event) =>
                                                    setTemplateDescription(
                                                        event.target.value,
                                                    )
                                                }
                                                rows={2}
                                                placeholder="When should this template be used?"
                                            />
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="template-objective">
                                                    Call objective
                                                </Label>
                                                <Textarea
                                                    id="template-objective"
                                                    value={templateCallObjective}
                                                    onChange={(event) =>
                                                        setTemplateCallObjective(
                                                            event.target.value,
                                                        )
                                                    }
                                                    rows={3}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="template-opening-line">
                                                    Opening line
                                                </Label>
                                                <Textarea
                                                    id="template-opening-line"
                                                    value={templateOpeningLine}
                                                    onChange={(event) =>
                                                        setTemplateOpeningLine(
                                                            event.target.value,
                                                        )
                                                    }
                                                    rows={3}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="template-tone">
                                                    Tone / persona
                                                </Label>
                                                <Textarea
                                                    id="template-tone"
                                                    value={templateTone}
                                                    onChange={(event) =>
                                                        setTemplateTone(
                                                            event.target.value,
                                                        )
                                                    }
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="template-questions">
                                                    Qualification questions
                                                </Label>
                                                <Textarea
                                                    id="template-questions"
                                                    value={templateQuestions}
                                                    onChange={(event) =>
                                                        setTemplateQuestions(
                                                            event.target.value,
                                                        )
                                                    }
                                                    rows={4}
                                                    placeholder="One question per line"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="template-objections">
                                                    Objection handling
                                                </Label>
                                                <Textarea
                                                    id="template-objections"
                                                    value={templateObjectionNotes}
                                                    onChange={(event) =>
                                                        setTemplateObjectionNotes(
                                                            event.target.value,
                                                        )
                                                    }
                                                    rows={3}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="template-voicemail">
                                                    Voicemail guidance
                                                </Label>
                                                <Textarea
                                                    id="template-voicemail"
                                                    value={
                                                        templateVoicemailGuidance
                                                    }
                                                    onChange={(event) =>
                                                        setTemplateVoicemailGuidance(
                                                            event.target.value,
                                                        )
                                                    }
                                                    rows={3}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="template-compliance">
                                                    Compliance copy
                                                </Label>
                                                <Textarea
                                                    id="template-compliance"
                                                    value={
                                                        templateComplianceDisclosure
                                                    }
                                                    onChange={(event) =>
                                                        setTemplateComplianceDisclosure(
                                                            event.target.value,
                                                        )
                                                    }
                                                    rows={3}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="template-start-hour">
                                                    Calling start
                                                </Label>
                                                <Select
                                                    value={String(
                                                        templateStartHour,
                                                    )}
                                                    onValueChange={(value) =>
                                                        setTemplateStartHour(
                                                            Number(value),
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger id="template-start-hour">
                                                        <SelectValue placeholder="Start" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {HOURS.map((hour) => (
                                                            <SelectItem
                                                                key={hour}
                                                                value={String(
                                                                    hour,
                                                                )}
                                                            >
                                                                {formatHourTo12Hour(
                                                                    hour,
                                                                )}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="template-end-hour">
                                                    Calling end
                                                </Label>
                                                <Select
                                                    value={String(
                                                        templateEndHour,
                                                    )}
                                                    onValueChange={(value) =>
                                                        setTemplateEndHour(
                                                            Number(value),
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger id="template-end-hour">
                                                        <SelectValue placeholder="End" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {HOURS.map((hour) => (
                                                            <SelectItem
                                                                key={hour}
                                                                value={String(
                                                                    hour,
                                                                )}
                                                            >
                                                                {formatHourTo12Hour(
                                                                    hour,
                                                                )}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="template-max-attempts">
                                                    Max attempts
                                                </Label>
                                                <Input
                                                    id="template-max-attempts"
                                                    type="number"
                                                    min={1}
                                                    value={templateMaxAttempts}
                                                    onChange={(event) =>
                                                        setTemplateMaxAttempts(
                                                            Number(
                                                                event.target
                                                                    .value || 1,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="template-cooldown">
                                                    Cooldown minutes
                                                </Label>
                                                <Input
                                                    id="template-cooldown"
                                                    type="number"
                                                    min={0}
                                                    value={
                                                        templateCooldownMinutes
                                                    }
                                                    onChange={(event) =>
                                                        setTemplateCooldownMinutes(
                                                            Number(
                                                                event.target
                                                                    .value || 0,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground">
                                                Calling days
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {WEEKDAYS.map((weekday) => (
                                                    <Button
                                                        key={weekday.value}
                                                        type="button"
                                                        size="sm"
                                                        variant={
                                                            templateAllowedWeekdays.includes(
                                                                weekday.value,
                                                            )
                                                                ? "default"
                                                                : "outline"
                                                        }
                                                        onClick={() =>
                                                            toggleTemplateWeekday(
                                                                weekday.value,
                                                            )
                                                        }
                                                    >
                                                        {weekday.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3 rounded-md border p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <Label htmlFor="template-sms-enabled">
                                                        Follow-up SMS
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Uses no-answer and voicemail
                                                        outcomes by default.
                                                    </p>
                                                </div>
                                                <Checkbox
                                                    id="template-sms-enabled"
                                                    checked={
                                                        templateFollowUpSmsEnabled
                                                    }
                                                    onCheckedChange={(checked) =>
                                                        setTemplateFollowUpSmsEnabled(
                                                            checked === true,
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="template-sms-body">
                                                    Default SMS template
                                                </Label>
                                                <Textarea
                                                    id="template-sms-body"
                                                    value={
                                                        templateFollowUpSmsTemplate
                                                    }
                                                    onChange={(event) =>
                                                        setTemplateFollowUpSmsTemplate(
                                                            event.target.value,
                                                        )
                                                    }
                                                    disabled={
                                                        !templateFollowUpSmsEnabled
                                                    }
                                                    rows={3}
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                            Outcome routing starts from the selected
                                            buyer or seller defaults. Terminal
                                            outcomes and Retell system settings stay
                                            backend-controlled.
                                        </div>

                                        <div className="flex justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    setIsCreatingTemplate(false)
                                                }
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={handleCreateTemplate}
                                                disabled={isSavingTemplate}
                                            >
                                                {isSavingTemplate ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    "Save Template"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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

                </div>

                <div className="flex shrink-0 items-center justify-between gap-2 border-t pt-4">
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
