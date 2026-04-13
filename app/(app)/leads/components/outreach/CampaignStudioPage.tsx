"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Edit3,
    ListFilter,
    Loader2,
    Radio,
    RefreshCcw,
    Save,
    Search,
    Send,
    Sparkles,
    Trash2,
    UserCheck,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { REASON_LABELS, WEEKDAYS } from "./constants";
import type { CampaignRow, CampaignTemplate, PickerData, PickerLead } from "./types";
import {
    CampaignBottomBar,
    CampaignFocusBadge,
    CampaignSectionHeading,
    CampaignStatusBadge,
    WizardStepIndicator,
    formatCampaignCategory,
    formatCampaignChannel,
} from "./campaign-ui";
import { CampaignTimePicker } from "./CampaignTimePicker";
import { formatMinutesFromMidnightTo12Hour } from "@/utils/dateandtimes";
import { fromMinutes, getEndMinutes, getStartMinutes, toMinutes } from "./time-utils";

type WizardStep = 1 | 2 | 3 | 4;
type StrategyEditorType = "question" | "objection";
type AudienceClassificationFilter = "all" | PickerLead["classification"];
type AudienceStatusFilter = "all" | PickerLead["status"];
type AudienceTypeFilter = "all" | "buyer" | "seller" | "investor" | "unknown";

const TONE_PRESETS = [
    {
        value: "Sophisticated, direct, and professional.",
        label: "Sophisticated",
        description: "High-trust, polished, and executive.",
    },
    {
        value: "Warm, consultative, and reassuring.",
        label: "Consultative",
        description: "Calm guidance without pressure.",
    },
    {
        value: "Confident, fast-moving, and conversion-focused.",
        label: "Assertive",
        description: "Urgent, sharp, and momentum-driven.",
    },
    {
        value: "Relationship-first, personable, and conversational.",
        label: "Relationship",
        description: "Friendly, human, and easygoing.",
    },
    {
        value: "Luxury-market, composed, and advisory.",
        label: "Luxury Advisory",
        description: "Premium, restrained, and high-touch.",
    },
] as const;

interface WizardFormState {
    selectedTemplateSelectionKey: string | null;
    name: string;
    description: string;
    startTimeMinutes: number;
    endTimeMinutes: number;
    allowedWeekdays: number[];
    maxAttempts: number;
    cooldownMinutes: number;
    followUpSmsEnabled: boolean;
    followUpSmsTemplate: string;
    callObjective: string;
    openingLine: string;
    tone: string;
    questions: string[];
    objectionHandling: string[];
    voicemailGuidance: string;
    search: string;
    audienceClassificationFilter: AudienceClassificationFilter;
    audienceStatusFilter: AudienceStatusFilter;
    audienceTypeFilter: AudienceTypeFilter;
    selectedLeadIds: string[];
    currentStep: WizardStep;
}

interface StrategyEditorState {
    open: boolean;
    type: StrategyEditorType;
    index: number | null;
    value: string;
}

const INITIAL_FORM_STATE: WizardFormState = {
    selectedTemplateSelectionKey: null,
    name: "",
    description: "",
    startTimeMinutes: toMinutes(9, 0),
    endTimeMinutes: toMinutes(18, 0),
    allowedWeekdays: [1, 2, 3, 4, 5],
    maxAttempts: 3,
    cooldownMinutes: 60,
    followUpSmsEnabled: true,
    followUpSmsTemplate: "",
    callObjective: "",
    openingLine: "",
    tone: "",
    questions: [""],
    objectionHandling: [""],
    voicemailGuidance: "",
    search: "",
    audienceClassificationFilter: "all",
    audienceStatusFilter: "all",
    audienceTypeFilter: "all",
    selectedLeadIds: [],
    currentStep: 1,
};

function normalizeEditableList(items: string[]): string[] {
    const normalized = items.map((item) => item.trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : [""];
}

function splitTextToList(value: string) {
    return value
        .split("\n")
        .map((question) => question.trim())
        .filter(Boolean);
}

function buildFollowUpOutcomes(enabled: boolean) {
    return enabled
        ? (["no_answer", "voicemail_left"] as Array<
              "no_answer" | "voicemail_left"
          >)
        : ([] as Array<"no_answer" | "voicemail_left">);
}

function resolveTonePresetValue(value: string | undefined): string {
    const normalized = value?.trim().toLowerCase() ?? "";
    const exact = TONE_PRESETS.find(
        (preset) => preset.value.toLowerCase() === normalized,
    );
    if (exact) {
        return exact.value;
    }
    if (normalized.includes("luxury") || normalized.includes("advisory")) {
        return TONE_PRESETS[4].value;
    }
    if (normalized.includes("warm") || normalized.includes("consult")) {
        return TONE_PRESETS[1].value;
    }
    if (
        normalized.includes("confident") ||
        normalized.includes("fast") ||
        normalized.includes("direct")
    ) {
        return TONE_PRESETS[2].value;
    }
    if (
        normalized.includes("relationship") ||
        normalized.includes("personable") ||
        normalized.includes("friendly")
    ) {
        return TONE_PRESETS[3].value;
    }
    return TONE_PRESETS[0].value;
}

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

function StudioSkeleton() {
    return (
        <div className="space-y-6 p-6 md:p-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <Skeleton className="h-24 rounded-[1.8rem]" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-[540px] rounded-[1.8rem]" />
                    <Skeleton className="h-[540px] rounded-[1.8rem]" />
                </div>
            </div>
        </div>
    );
}

function validateStep(step: WizardStep, form: WizardFormState): string | null {
    switch (step) {
        case 1:
            if (!form.name.trim()) return "Campaign name is required.";
            if (!form.selectedTemplateSelectionKey)
                return "Choose a predefined playbook first.";
            return null;
        case 2:
            if (form.allowedWeekdays.length === 0)
                return "Choose at least one active day.";
            if (form.startTimeMinutes >= form.endTimeMinutes)
                return "Start time must be before end time.";
            return null;
        case 3:
            if (!form.callObjective.trim())
                return "Call objective is required.";
            if (normalizeEditableList(form.questions).filter(Boolean).length === 0)
                return "Add at least one qualification question.";
            return null;
        case 4:
            return null;
    }
}

export function CampaignStudioPage({
    mode,
    campaignId,
    initialTemplateSelectionKey = null,
}: {
    mode: "create" | "edit";
    campaignId?: string;
    initialTemplateSelectionKey?: string | null;
}) {
    const router = useRouter();
    const templatesRaw = useQuery(api.outreach.queries.getCampaignTemplates, {});
    const campaignsRaw = useQuery(api.outreach.queries.getCampaignsForPicker, {
        includeInactive: true,
    });
    const createCampaign = useMutation(api.outreach.mutations.createCampaign);
    const updateCampaign = useMutation(api.outreach.mutations.updateCampaignSettings);
    const startOutreach = useAction(api.outreach.actions.startCampaignOutreach);

    const templates = templatesRaw as CampaignTemplate[] | undefined;
    const campaigns = campaignsRaw as CampaignRow[] | undefined;
    const existingCampaign = useMemo(
        () =>
            campaigns?.find(
                (campaign) => campaign._id === (campaignId as Id<"outreachCampaigns">),
            ) ?? null,
        [campaignId, campaigns],
    );

    const [form, setForm] = useState<WizardFormState>(INITIAL_FORM_STATE);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isLaunching, setIsLaunching] = useState(false);
    const [didInitialize, setDidInitialize] = useState(false);
    const [stepTransitionClass, setStepTransitionClass] = useState(
        "animate-in fade-in-0 slide-in-from-right-4 duration-300",
    );
    const [strategyEditor, setStrategyEditor] = useState<StrategyEditorState>({
        open: false,
        type: "question",
        index: null,
        value: "",
    });

    const updateForm = (patch: Partial<WizardFormState>) =>
        setForm((prev) => ({ ...prev, ...patch }));

    const removeQuestion = (index: number) => {
        updateForm({
            questions:
                form.questions.length > 1
                    ? form.questions.filter((_, itemIndex) => itemIndex !== index)
                    : [""],
        });
    };

    const removeObjection = (index: number) => {
        updateForm({
            objectionHandling:
                form.objectionHandling.length > 1
                    ? form.objectionHandling.filter(
                          (_, itemIndex) => itemIndex !== index,
                      )
                    : [""],
        });
    };

    const activeTemplate = useMemo(
        () =>
            templates?.find(
                (template) =>
                    template.selectionKey === form.selectedTemplateSelectionKey,
            ) ?? null,
        [form.selectedTemplateSelectionKey, templates],
    );

    const pickerDataRaw = useQuery(
        api.outreach.queries.getOutreachLeadPicker,
        mode === "create" && activeTemplate
            ? {
                  templateKey: activeTemplate.key,
                  customTemplateId: activeTemplate.templateId ?? undefined,
                  limit: 500,
              }
            : "skip",
    );
    const pickerData = pickerDataRaw as PickerData | undefined;

    useEffect(() => {
        if (didInitialize || !templates || !campaigns) {
            return;
        }

        const applyTemplate = (template: CampaignTemplate): Partial<WizardFormState> => ({
            selectedTemplateSelectionKey: template.selectionKey,
            name: template.defaultName,
            description: template.description,
            startTimeMinutes: getStartMinutes(template.runtimeSummary.callingWindow),
            endTimeMinutes: getEndMinutes(template.runtimeSummary.callingWindow),
            allowedWeekdays: template.runtimeSummary.callingWindow.allowed_weekdays,
            maxAttempts: template.runtimeSummary.maxAttempts,
            cooldownMinutes: template.runtimeSummary.cooldownMinutes,
            followUpSmsEnabled: template.runtimeSummary.followUpSms.enabled,
            followUpSmsTemplate: template.runtimeSummary.followUpSms.defaultTemplate ?? "",
            callObjective: template.agentInstructions.call_objective,
            openingLine: template.agentInstructions.opening_line,
            tone: resolveTonePresetValue(template.agentInstructions.tone),
            questions: normalizeEditableList(
                template.agentInstructions.qualification_questions,
            ),
            objectionHandling: normalizeEditableList(
                splitTextToList(
                    template.agentInstructions.objection_handling_notes,
                ),
            ),
            voicemailGuidance: template.agentInstructions.voicemail_guidance,
        });

        if (mode === "edit" && existingCampaign) {
            updateForm({
                selectedTemplateSelectionKey: existingCampaign.templateSelectionKey,
                name: existingCampaign.name,
                description: existingCampaign.description ?? "",
                startTimeMinutes: getStartMinutes(existingCampaign.callingWindow),
                endTimeMinutes: getEndMinutes(existingCampaign.callingWindow),
                allowedWeekdays: existingCampaign.callingWindow.allowed_weekdays,
                maxAttempts: existingCampaign.retryPolicy.max_attempts,
                cooldownMinutes: existingCampaign.retryPolicy.min_minutes_between_attempts,
                followUpSmsEnabled: existingCampaign.followUpSms.enabled,
                followUpSmsTemplate: existingCampaign.followUpSms.default_template ?? "",
                callObjective: existingCampaign.agentInstructions?.call_objective ?? "",
                openingLine: existingCampaign.agentInstructions?.opening_line ?? "",
                tone: resolveTonePresetValue(existingCampaign.agentInstructions?.tone),
                questions: normalizeEditableList(
                    existingCampaign.agentInstructions?.qualification_questions ?? [],
                ),
                objectionHandling: normalizeEditableList(
                    splitTextToList(
                        existingCampaign.agentInstructions?.objection_handling_notes ?? "",
                    ),
                ),
                voicemailGuidance:
                    existingCampaign.agentInstructions?.voicemail_guidance ?? "",
            });
            setDidInitialize(true);
            return;
        }

        const templateFromQuery =
            templates.find(
                (template) => template.selectionKey === initialTemplateSelectionKey,
            ) ?? templates[0];
        if (templateFromQuery) {
            updateForm(applyTemplate(templateFromQuery));
        }
        setDidInitialize(true);
    }, [
        campaigns,
        didInitialize,
        existingCampaign,
        initialTemplateSelectionKey,
        mode,
        templates,
    ]);

    const filteredLeads = useMemo(() => {
        if (!pickerData) {
            return [] as PickerLead[];
        }
        const query = form.search.trim().toLowerCase();
        return pickerData.leads.filter((lead) => {
            const audience = getLeadAudienceValue(lead);
            const matchesClassification =
                form.audienceClassificationFilter === "all" ||
                lead.classification === form.audienceClassificationFilter;
            const matchesStatus =
                form.audienceStatusFilter === "all" ||
                lead.status === form.audienceStatusFilter;
            const matchesAudience =
                form.audienceTypeFilter === "all" ||
                audience === form.audienceTypeFilter;
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
        pickerData,
        form.audienceClassificationFilter,
        form.audienceStatusFilter,
        form.audienceTypeFilter,
        form.search,
    ]);

    const audienceStats = useMemo(() => {
        const leads = pickerData?.leads ?? [];
        return {
            total: leads.length,
            eligible: leads.filter((lead) => lead.classification === "eligible")
                .length,
            conflict: leads.filter((lead) => lead.classification === "conflict")
                .length,
            blocked: leads.filter((lead) => lead.classification === "ineligible")
                .length,
            visible: filteredLeads.length,
        };
    }, [filteredLeads.length, pickerData?.leads]);

    const selectedLeadCount = form.selectedLeadIds.length;
    const estimatedTouches = selectedLeadCount * Math.max(form.maxAttempts, 1);
    const canEditRuntime = mode === "create" || existingCampaign?.status !== "active";
    const activeDayLabels = WEEKDAYS.filter((weekday) =>
        form.allowedWeekdays.includes(weekday.value),
    ).map((weekday) => weekday.label);
    const visibleSelectableLeadIds = useMemo(
        () =>
            filteredLeads
                .filter((lead) => lead.selectable)
                .map((lead) => String(lead.leadId)),
        [filteredLeads],
    );

    const handleTemplateSelection = (template: CampaignTemplate) => {
        if (mode === "edit") return;
        updateForm({
            selectedLeadIds: [],
            search: "",
            audienceClassificationFilter: "all",
            audienceStatusFilter: "all",
            audienceTypeFilter: "all",
            selectedTemplateSelectionKey: template.selectionKey,
            name: template.defaultName,
            description: template.description,
            startTimeMinutes: getStartMinutes(template.runtimeSummary.callingWindow),
            endTimeMinutes: getEndMinutes(template.runtimeSummary.callingWindow),
            allowedWeekdays: template.runtimeSummary.callingWindow.allowed_weekdays,
            maxAttempts: template.runtimeSummary.maxAttempts,
            cooldownMinutes: template.runtimeSummary.cooldownMinutes,
            followUpSmsEnabled: template.runtimeSummary.followUpSms.enabled,
            followUpSmsTemplate: template.runtimeSummary.followUpSms.defaultTemplate ?? "",
            callObjective: template.agentInstructions.call_objective,
            openingLine: template.agentInstructions.opening_line,
            tone: resolveTonePresetValue(template.agentInstructions.tone),
            questions: normalizeEditableList(
                template.agentInstructions.qualification_questions,
            ),
            objectionHandling: normalizeEditableList(
                splitTextToList(template.agentInstructions.objection_handling_notes),
            ),
            voicemailGuidance: template.agentInstructions.voicemail_guidance,
        });
    };

    const openStrategyEditor = (
        type: StrategyEditorType,
        index: number | null = null,
    ) => {
        const source = type === "question" ? form.questions : form.objectionHandling;
        setStrategyEditor({
            open: true,
            type,
            index,
            value: index === null ? "" : source[index] ?? "",
        });
    };

    const closeStrategyEditor = () => {
        setStrategyEditor((current) => ({ ...current, open: false, value: "" }));
    };

    const saveStrategyEditor = () => {
        const nextValue = strategyEditor.value.trim();
        if (!nextValue) {
            toast.error(
                strategyEditor.type === "question"
                    ? "Question copy is required."
                    : "Objection path copy is required.",
            );
            return;
        }

        if (strategyEditor.type === "question") {
            const nextQuestions =
                strategyEditor.index === null
                    ? [...normalizeEditableList(form.questions).filter(Boolean), nextValue]
                    : form.questions.map((item, itemIndex) =>
                          itemIndex === strategyEditor.index ? nextValue : item,
                      );
            updateForm({ questions: nextQuestions });
        } else {
            const nextObjections =
                strategyEditor.index === null
                    ? [
                          ...normalizeEditableList(form.objectionHandling).filter(
                              Boolean,
                          ),
                          nextValue,
                      ]
                    : form.objectionHandling.map((item, itemIndex) =>
                          itemIndex === strategyEditor.index ? nextValue : item,
                      );
            updateForm({ objectionHandling: nextObjections });
        }

        closeStrategyEditor();
    };

    const toggleWeekday = (weekday: number) => {
        if (!canEditRuntime) return;
        updateForm({
            allowedWeekdays: form.allowedWeekdays.includes(weekday)
                ? form.allowedWeekdays.filter((v) => v !== weekday)
                : [...form.allowedWeekdays, weekday].sort((a, b) => a - b),
        });
    };

    const toggleLead = (leadId: string) => {
        updateForm({
            selectedLeadIds: form.selectedLeadIds.includes(leadId)
                ? form.selectedLeadIds.filter((v) => v !== leadId)
                : [...form.selectedLeadIds, leadId],
        });
    };

    const selectVisibleLeads = () => {
        updateForm({
            selectedLeadIds: Array.from(
                new Set([...form.selectedLeadIds, ...visibleSelectableLeadIds]),
            ),
        });
    };

    const clearSelectedLeads = () => {
        updateForm({ selectedLeadIds: [] });
    };

    const buildCampaignPayload = () => {
        const qualificationQuestions = normalizeEditableList(form.questions).filter(
            Boolean,
        );
        const objectionHandlingNotes = normalizeEditableList(
            form.objectionHandling,
        ).filter(Boolean);
        if (!form.name.trim()) {
            throw new Error("Campaign name is required.");
        }
        if (!form.selectedTemplateSelectionKey || !activeTemplate) {
            throw new Error("Choose a predefined playbook first.");
        }
        if (form.allowedWeekdays.length === 0) {
            throw new Error("Choose at least one day in the calling window.");
        }
        if (qualificationQuestions.length === 0) {
            throw new Error("Add at least one qualification question.");
        }

        return {
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            calling_window: {
                start_hour_local: fromMinutes(form.startTimeMinutes).hour,
                start_minute_local: fromMinutes(form.startTimeMinutes).minute,
                end_hour_local: fromMinutes(form.endTimeMinutes).hour,
                end_minute_local: fromMinutes(form.endTimeMinutes).minute,
                allowed_weekdays: form.allowedWeekdays as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>,
            },
            retry_policy: {
                max_attempts: form.maxAttempts,
                min_minutes_between_attempts: form.cooldownMinutes,
            },
            follow_up_sms: {
                enabled: form.followUpSmsEnabled,
                delay_minutes: 3,
                default_template: form.followUpSmsTemplate.trim() || undefined,
                send_only_on_outcomes: buildFollowUpOutcomes(form.followUpSmsEnabled),
            },
            agent_instructions: {
                call_objective: form.callObjective.trim(),
                opening_line: form.openingLine.trim(),
                tone: form.tone.trim(),
                qualification_questions: qualificationQuestions,
                objection_handling_notes: objectionHandlingNotes.join("\n"),
                voicemail_guidance: form.voicemailGuidance.trim(),
            },
            template_key: activeTemplate.key,
            custom_template_id: activeTemplate.templateId ?? undefined,
            template_version: activeTemplate.version,
        };
    };

    const handleSaveDraft = async () => {
        try {
            const payload = buildCampaignPayload();
            setIsSavingDraft(true);
            if (mode === "edit" && existingCampaign) {
                if (!canEditRuntime) {
                    throw new Error("Pause this campaign before editing runtime settings.");
                }
                await updateCampaign({
                    campaignId: existingCampaign._id,
                    name: payload.name,
                    description: payload.description ?? null,
                    calling_window: payload.calling_window,
                    retry_policy: payload.retry_policy,
                    follow_up_sms: payload.follow_up_sms,
                    agent_instructions: payload.agent_instructions,
                });
                toast.success("Campaign strategy updated.");
                startTransition(() => {
                    router.push(`/leads/outreach/${existingCampaign._id}`);
                });
                return;
            }

            const newCampaignId = await createCampaign({
                ...payload,
                status: "draft",
            });
            toast.success("Campaign draft saved.");
            startTransition(() => {
                router.push(`/leads/outreach/${newCampaignId}`);
            });
        } catch (error) {
            console.error(error);
            toast.error(
                error instanceof Error ? error.message : "Failed to save campaign draft.",
            );
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleLaunch = async () => {
        try {
            const payload = buildCampaignPayload();
            setIsLaunching(true);
            const newCampaignId = await createCampaign({
                ...payload,
                status: "active",
            });
            if (form.selectedLeadIds.length > 0) {
                await startOutreach({
                    campaignId: newCampaignId,
                    leadIds: form.selectedLeadIds as Id<"leads">[],
                });
            }
            toast.success(
                form.selectedLeadIds.length > 0
                    ? `Campaign launched with ${form.selectedLeadIds.length} leads.`
                    : "Campaign launched. Add leads from the campaign detail page when ready.",
            );
            startTransition(() => {
                router.push(`/leads/outreach/${newCampaignId}`);
            });
        } catch (error) {
            console.error(error);
            toast.error(
                error instanceof Error ? error.message : "Failed to launch campaign.",
            );
        } finally {
            setIsLaunching(false);
        }
    };

    const handleNextStep = () => {
        const error = validateStep(form.currentStep, form);
        if (error) {
            toast.error(error);
            return;
        }
        if (form.currentStep < 4) {
            setStepTransitionClass(
                "animate-in fade-in-0 slide-in-from-right-4 duration-300",
            );
            updateForm({ currentStep: (form.currentStep + 1) as WizardStep });
        }
    };

    const handlePrevStep = () => {
        if (form.currentStep > 1) {
            setStepTransitionClass(
                "animate-in fade-in-0 slide-in-from-left-4 duration-300",
            );
            updateForm({ currentStep: (form.currentStep - 1) as WizardStep });
        }
    };

    if (templates === undefined || campaigns === undefined || !didInitialize) {
        return <StudioSkeleton />;
    }

    if (mode === "edit" && !existingCampaign) {
        return (
            <div className="p-6 md:p-8">
                <Card className="rounded-[1.8rem] border-border/70 bg-card/90">
                    <CardContent className="space-y-4 px-8 py-14 text-center">
                        <h1 className="text-2xl font-semibold text-foreground">
                            Campaign not found
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            This campaign could not be loaded for editing.
                        </p>
                        <Button asChild className="rounded-full">
                            <Link href="/leads/outreach">Back to campaigns</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isCreate = mode === "create";

    const renderStep1 = () => (
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            {/* Left: Playbook selection (wider) */}
            <Card className="rounded-[1.8rem] border-border/60 bg-card/95 shadow-xl shadow-black/10">
                <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                                <Sparkles className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.28em] text-primary/90">
                                    Playbook selection
                                </p>
                                <CardTitle className="mt-1 text-2xl font-semibold tracking-tight">
                                    Campaign focus
                                </CardTitle>
                            </div>
                        </div>
                        {mode === "edit" && existingCampaign ? (
                            <CampaignStatusBadge status={existingCampaign.status} />
                        ) : null}
                    </div>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                    {templates.map((template) => {
                        const selected =
                            template.selectionKey === form.selectedTemplateSelectionKey;
                        return (
                            <button
                                key={template.selectionKey}
                                type="button"
                                onClick={() => handleTemplateSelection(template)}
                                disabled={mode === "edit"}
                                aria-pressed={selected}
                                className={cn(
                                    "flex w-full items-start gap-4 rounded-[1.5rem] border p-4 text-left transition",
                                    selected
                                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                                        : "border-border/60 bg-muted/20 hover:border-primary/30 hover:bg-primary/[0.04]",
                                    mode === "edit"
                                        ? "cursor-default"
                                        : "cursor-pointer",
                                )}
                            >
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CampaignFocusBadge
                                            label={formatCampaignCategory(
                                                template.campaignFocus.category,
                                            )}
                                        />
                                        <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                            {formatCampaignChannel(
                                                template.campaignFocus.channel,
                                            )}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        {template.label}
                                    </h3>
                                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                                        {template.description}
                                    </p>
                                </div>
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border transition",
                                        selected
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border/70 bg-transparent",
                                    )}
                                >
                                    {selected ? (
                                        <Check className="size-3.5" strokeWidth={3} />
                                    ) : null}
                                </span>
                            </button>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Right: Identity + Audience + Success metric */}
            <div className="flex flex-col gap-4">
                <Card className="rounded-[1.8rem] border-border/60 bg-card/95 shadow-xl shadow-black/10">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                                <Radio className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.28em] text-primary/90">
                                    Identity
                                </p>
                                <CardTitle className="mt-1 text-xl font-semibold tracking-tight">
                                    Campaign identity
                                </CardTitle>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="campaign-name">Campaign name</Label>
                            <Input
                                id="campaign-name"
                                value={form.name}
                                onChange={(e) => updateForm({ name: e.target.value })}
                                placeholder="e.g. Q2 Luxury Seller Reactivation"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="campaign-description">Description</Label>
                            <Textarea
                                id="campaign-description"
                                value={form.description}
                                onChange={(e) =>
                                    updateForm({ description: e.target.value })
                                }
                                rows={3}
                                placeholder="Describe the business intent for this campaign and the type of lead motion you expect."
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="rounded-[1.4rem] border border-border/60 bg-muted/30 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Primary audience
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                        {activeTemplate?.campaignFocus.audience ??
                            existingCampaign?.campaignFocus?.audience ??
                            "Configured audience"}
                    </p>
                </div>
                <div className="rounded-[1.4rem] border border-border/60 bg-muted/30 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Success metric
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                        {activeTemplate?.campaignFocus.success_metric ??
                            existingCampaign?.campaignFocus?.success_metric ??
                            "Lead progress"}
                    </p>
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <section className="rounded-[2rem] border border-border/60 bg-gradient-to-b from-card to-muted/30 p-6 shadow-xl md:p-8">
            <div className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-primary/90">
                                Runtime design
                            </p>
                            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                                Scheduling & runtime
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Playbook presets seed the default contact window,
                                cadence, and missed-call SMS behavior. Fine-tune
                                them here before launch.
                            </p>
                        </div>
                    </div>

                    {!canEditRuntime && (
                        <div className="rounded-[1.25rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                            Pause this campaign before saving runtime or strategy edits.
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        <CampaignTimePicker
                            label="Calling window start"
                            value={form.startTimeMinutes}
                            onChange={(nextValue) =>
                                updateForm({ startTimeMinutes: nextValue })
                            }
                            disabled={!canEditRuntime}
                        />
                        <CampaignTimePicker
                            label="Calling window end"
                            value={form.endTimeMinutes}
                            onChange={(nextValue) =>
                                updateForm({ endTimeMinutes: nextValue })
                            }
                            disabled={!canEditRuntime}
                        />
                    </div>

                    <div className="rounded-[1.45rem] border border-border/60 bg-muted/30 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                    Active days
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Calls only dispatch inside the days and times you enable.
                                </p>
                            </div>
                            <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground">
                                {activeDayLabels.length > 0
                                    ? activeDayLabels.join(" / ")
                                    : "No days selected"}
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {WEEKDAYS.map((weekday) => {
                                const active = form.allowedWeekdays.includes(weekday.value);
                                return (
                                    <button
                                        key={weekday.value}
                                        type="button"
                                        onClick={() => toggleWeekday(weekday.value)}
                                        disabled={!canEditRuntime}
                                        className={cn(
                                            "rounded-full border px-4 py-2 text-sm transition",
                                            active
                                                ? "border-primary/40 bg-primary/15 text-primary"
                                                : "border-border/70 bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted/50",
                                            !canEditRuntime &&
                                                "cursor-not-allowed opacity-60",
                                        )}
                                    >
                                        {weekday.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[1.45rem] border border-border/60 bg-muted/30 p-4">
                            <div className="flex items-center gap-3">
                                <span className="flex size-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                                    <RefreshCcw className="size-5" />
                                </span>
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                        Retry cadence
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Control how hard the campaign should press after a miss.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="max-attempts">Max attempts</Label>
                                    <Input
                                        id="max-attempts"
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={form.maxAttempts}
                                        onChange={(e) =>
                                            updateForm({
                                                maxAttempts: Number(e.target.value) || 1,
                                            })
                                        }
                                        disabled={!canEditRuntime}
                                        className="border-border/70 bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cooldown-minutes">
                                        Cooldown minutes
                                    </Label>
                                    <Input
                                        id="cooldown-minutes"
                                        type="number"
                                        min={0}
                                        value={form.cooldownMinutes}
                                        onChange={(e) =>
                                            updateForm({
                                                cooldownMinutes:
                                                    Number(e.target.value) || 0,
                                            })
                                        }
                                        disabled={!canEditRuntime}
                                        className="border-border/70 bg-background"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[1.45rem] border border-border/60 bg-muted/30 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                        Follow-up SMS
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Keep SMS enabled when missed calls should immediately roll
                                        into a text reply path.
                                    </p>
                                </div>
                                <Checkbox
                                    checked={form.followUpSmsEnabled}
                                    onCheckedChange={(checked) =>
                                        updateForm({
                                            followUpSmsEnabled: Boolean(checked),
                                        })
                                    }
                                    disabled={!canEditRuntime}
                                />
                            </div>
                            <div className="mt-4 space-y-2">
                                <Label htmlFor="sms-template">Default SMS copy</Label>
                                <Textarea
                                    id="sms-template"
                                    rows={4}
                                    value={form.followUpSmsTemplate}
                                    onChange={(e) =>
                                        updateForm({
                                            followUpSmsTemplate: e.target.value,
                                        })
                                    }
                                    placeholder="Hi {{lead_name}}, this is {{campaign_name}}..."
                                    disabled={!canEditRuntime || !form.followUpSmsEnabled}
                                    className="border-border/70 bg-background"
                                />
                            </div>
                        </div>
                    </div>
            </div>
        </section>
    );

    const renderStep3 = () => (
        <section className="rounded-[2rem] border border-border/60 bg-gradient-to-b from-card to-muted/30 shadow-xl">
            <div className="space-y-5 p-6 xl:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-primary/90">
                                Intelligence layer
                            </p>
                            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                                AI Script & Strategy
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                This playbook-owned script defines what the AI is trying to
                                accomplish, how it sounds, and which checkpoints it has to
                                clear before the lead earns a handoff.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[1.4rem] border border-border/60 bg-card p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                Call objective
                            </p>
                            <Textarea
                                id="call-objective"
                                rows={4}
                                value={form.callObjective}
                                onChange={(e) =>
                                    updateForm({ callObjective: e.target.value })
                                }
                                disabled={!canEditRuntime}
                                className="mt-3 border-border/70 bg-background"
                            />
                        </div>
                        <div className="rounded-[1.4rem] border border-border/60 bg-card p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                Opening line
                            </p>
                            <Textarea
                                id="opening-line"
                                rows={4}
                                value={form.openingLine}
                                onChange={(e) =>
                                    updateForm({ openingLine: e.target.value })
                                }
                                disabled={!canEditRuntime}
                                className="mt-3 border-border/70 bg-background"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[1.4rem] border border-border/60 bg-card p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                Tone / persona
                            </p>
                            <Select
                                value={form.tone}
                                onValueChange={(value) => updateForm({ tone: value })}
                                disabled={!canEditRuntime}
                            >
                                <SelectTrigger
                                    id="tone"
                                    className="mt-3 border-border/70 bg-background"
                                >
                                    <SelectValue placeholder="Choose tone" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TONE_PRESETS.map((preset) => (
                                        <SelectItem key={preset.value} value={preset.value}>
                                            {preset.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {TONE_PRESETS.find((preset) => preset.value === form.tone)
                                    ?.description ?? ""}
                            </p>
                        </div>
                        <div className="rounded-[1.4rem] border border-border/60 bg-card p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                Voicemail guidance
                            </p>
                            <Textarea
                                id="voicemail"
                                rows={3}
                                value={form.voicemailGuidance}
                                onChange={(e) =>
                                    updateForm({
                                        voicemailGuidance: e.target.value,
                                    })
                                }
                                disabled={!canEditRuntime}
                                className="mt-3 border-border/70 bg-background"
                            />
                        </div>
                    </div>

                    <div className="rounded-[1.45rem] border border-border/60 bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                    Qualification questions
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Keep these ordered. The agent should move top to bottom,
                                    not improvise the sequence.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-full border-border/70 bg-transparent"
                                onClick={() => openStrategyEditor("question")}
                                disabled={!canEditRuntime}
                            >
                                Add question
                            </Button>
                        </div>

                        <div className="mt-4 space-y-3">
                            {normalizeEditableList(form.questions)
                                .filter(Boolean)
                                .map((question, index) => (
                                    <div
                                        key={`question-${index}`}
                                        className="flex items-center gap-3 rounded-[1.1rem] border border-border/60 bg-background p-3"
                                    >
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
                                            {index + 1}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openStrategyEditor("question", index)
                                            }
                                            disabled={!canEditRuntime}
                                            className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-not-allowed"
                                        >
                                            <p className="truncate text-sm text-foreground">
                                                {question}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Click to edit
                                            </p>
                                        </button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                            onClick={() => openStrategyEditor("question", index)}
                                            disabled={!canEditRuntime}
                                        >
                                            <Edit3 className="size-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                            onClick={() => removeQuestion(index)}
                                            disabled={!canEditRuntime}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                ))}
                        </div>
                    </div>

                    <div className="rounded-[1.45rem] border border-border/60 bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                    Objection handling
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Keep counters explicit so the AI knows the response move,
                                    not just the topic.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-full border-border/70 bg-transparent"
                                onClick={() => openStrategyEditor("objection")}
                                disabled={!canEditRuntime}
                            >
                                Add objection path
                            </Button>
                        </div>

                        <div className="mt-4 space-y-3">
                            {normalizeEditableList(form.objectionHandling)
                                .filter(Boolean)
                                .map((item, index) => (
                                    <div
                                        key={`objection-${index}`}
                                        className="flex items-center gap-3 rounded-[1.1rem] border border-border/60 bg-background p-3"
                                    >
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-sm font-semibold text-amber-800 dark:text-amber-200">
                                            {index + 1}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openStrategyEditor("objection", index)
                                            }
                                            disabled={!canEditRuntime}
                                            className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-not-allowed"
                                        >
                                            <p className="truncate text-sm text-foreground">
                                                {item}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Click to edit
                                            </p>
                                        </button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                            onClick={() =>
                                                openStrategyEditor("objection", index)
                                            }
                                            disabled={!canEditRuntime}
                                        >
                                            <Edit3 className="size-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                            onClick={() => removeObjection(index)}
                                            disabled={!canEditRuntime}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                ))}
                        </div>
                    </div>

            </div>
        </section>
    );

    const strategyEditorTitle =
        strategyEditor.type === "question"
            ? strategyEditor.index === null
                ? "Add qualification question"
                : "Edit qualification question"
            : strategyEditor.index === null
              ? "Add objection path"
              : "Edit objection path";

    const renderStep4 = () => (
        <Card className="overflow-hidden rounded-[2rem] border-border/60 bg-card/95 shadow-xl shadow-black/10">
            <CardContent className="space-y-5 p-5 md:p-6">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-border/70 bg-transparent"
                            onClick={selectVisibleLeads}
                            disabled={visibleSelectableLeadIds.length === 0}
                        >
                            <UserCheck className="h-4 w-4" />
                            Select visible
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            onClick={clearSelectedLeads}
                            disabled={selectedLeadCount === 0}
                        >
                            Clear
                        </Button>
                    </div>
                </div>

                <div className="rounded-[1.35rem] border border-border/60 bg-muted/20 p-3">
                    <div className="grid gap-3 lg:grid-cols-[minmax(260px,1.4fr)_repeat(3,minmax(160px,1fr))]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={form.search}
                                onChange={(event) =>
                                    updateForm({ search: event.target.value })
                                }
                                placeholder="Search name, phone, reason, or campaign"
                                className="h-10 rounded-full border-border/70 bg-background pl-9"
                            />
                        </div>
                        <Select
                            value={form.audienceClassificationFilter}
                            onValueChange={(value) =>
                                updateForm({
                                    audienceClassificationFilter:
                                        value as AudienceClassificationFilter,
                                })
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
                            value={form.audienceStatusFilter}
                            onValueChange={(value) =>
                                updateForm({
                                    audienceStatusFilter:
                                        value as AudienceStatusFilter,
                                })
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
                            value={form.audienceTypeFilter}
                            onValueChange={(value) =>
                                updateForm({
                                    audienceTypeFilter: value as AudienceTypeFilter,
                                })
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
                                const selected = form.selectedLeadIds.includes(leadId);
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
            </CardContent>
        </Card>
    );

    const renderStepContent = (step: WizardStep) => {
        switch (step) {
            case 1:
                return renderStep1();
            case 2:
                return renderStep2();
            case 3:
                return renderStep3();
            case 4:
                return renderStep4();
        }
    };

    const stepTitles: Record<WizardStep, { eyebrow: string; title: string; description: string }> = {
        1: {
            eyebrow: "Step 1 of 4",
            title: "Campaign Identity",
            description: "Choose a playbook and define your campaign's name and purpose.",
        },
        2: {
            eyebrow: "Step 2 of 4",
            title: "Scheduling & Runtime",
            description: "Set the calling window, retry policy, and follow-up SMS rules.",
        },
        3: {
            eyebrow: "Step 3 of 4",
            title: "AI Script & Strategy",
            description: "Configure the AI agent's script, tone, and qualification criteria.",
        },
        4: {
            eyebrow: "Step 4 of 4",
            title: "Audience Selection",
            description: "Pick the initial leads to enroll when the campaign launches.",
        },
    };
    const editStepTitles: Record<1 | 2 | 3, { eyebrow: string; title: string; description: string }> = {
        1: {
            eyebrow: "Edit 1 of 3",
            title: "Campaign Identity",
            description:
                "Review the playbook, campaign name, and business purpose without changing enrolled leads.",
        },
        2: {
            eyebrow: "Edit 2 of 3",
            title: "Scheduling & Runtime",
            description:
                "Adjust calling windows, retry cadence, and follow-up SMS rules after pausing active campaigns.",
        },
        3: {
            eyebrow: "Edit 3 of 3",
            title: "AI Script & Strategy",
            description:
                "Refine the agent objective, tone, qualification questions, and objection handling.",
        },
    };
    const maxWizardStep = isCreate ? 4 : 3;
    const visibleStep = (
        form.currentStep > maxWizardStep ? maxWizardStep : form.currentStep
    ) as WizardStep;
    const activeStepTitle = isCreate
        ? stepTitles[visibleStep]
        : editStepTitles[visibleStep as 1 | 2 | 3];

    return (
        <div className="flex min-h-full flex-col bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_28%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.14),transparent_24%)] px-6 pb-0 pt-6 md:px-8 md:pb-0 md:pt-8">
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
                <CampaignSectionHeading
                    eyebrow={activeStepTitle.eyebrow}
                    title={activeStepTitle.title}
                    description={activeStepTitle.description}
                />
                <div
                    key={`${mode}-${visibleStep}`}
                    className={cn("motion-reduce:animate-none", stepTransitionClass)}
                >
                    {renderStepContent(visibleStep)}
                </div>
            </div>

            {isCreate ? (
                <CampaignBottomBar
                    left={<WizardStepIndicator currentStep={form.currentStep} />}
                    center={
                        <div className="hidden min-w-0 items-center gap-2 overflow-hidden lg:flex">
                            {activeTemplate?.label ? (
                                <Badge
                                    variant="outline"
                                    className="hidden shrink-0 rounded-full border-border/70 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground 2xl:inline-flex"
                                >
                                    {activeTemplate.label}
                                </Badge>
                            ) : null}
                            <Badge
                                variant="outline"
                                className="shrink-0 rounded-full border-border/70 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                            >
                                {selectedLeadCount} leads
                            </Badge>
                            <Badge
                                variant="outline"
                                className="hidden shrink-0 rounded-full border-border/70 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground 2xl:inline-flex"
                            >
                                {estimatedTouches} touches
                            </Badge>
                            <Badge
                                variant="outline"
                                className="shrink-0 rounded-full border-border/70 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                            >
                                Window {formatMinutesFromMidnightTo12Hour(form.startTimeMinutes)} -{" "}
                                {formatMinutesFromMidnightTo12Hour(form.endTimeMinutes)}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="hidden shrink-0 rounded-full border-border/70 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground 2xl:inline-flex"
                            >
                                {form.allowedWeekdays.length} day
                                {form.allowedWeekdays.length === 1 ? "" : "s"}
                            </Badge>
                        </div>
                    }
                    right={
                        <>
                            {form.currentStep === 1 ? (
                                <Button
                                    asChild
                                    variant="outline"
                                    className="rounded-full border-border/70 bg-transparent"
                                >
                                    <Link href="/leads/outreach">
                                        <ArrowLeft className="h-4 w-4" />
                                        Back
                                    </Link>
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-full border-border/70 bg-transparent"
                                    onClick={handlePrevStep}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-full border-border/70 bg-transparent"
                                onClick={handleSaveDraft}
                                disabled={isSavingDraft || isLaunching}
                            >
                                {isSavingDraft ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Save Draft
                            </Button>
                            {form.currentStep < 4 ? (
                                <Button
                                    type="button"
                                    className="rounded-full"
                                    onClick={handleNextStep}
                                >
                                    Next
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    className="rounded-full"
                                    onClick={handleLaunch}
                                    disabled={isSavingDraft || isLaunching}
                                >
                                    {isLaunching ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                    Launch campaign
                                </Button>
                            )}
                        </>
                    }
                />
            ) : (
                <CampaignBottomBar
                    left={
                        <WizardStepIndicator
                            currentStep={visibleStep}
                            maxStep={3}
                        />
                    }
                    center={
                        <div className="hidden min-w-0 items-center gap-2 overflow-hidden lg:flex">
                            {existingCampaign?.status ? (
                                <CampaignStatusBadge status={existingCampaign.status} />
                            ) : null}
                            <Badge
                                variant="outline"
                                className="shrink-0 rounded-full border-border/70 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                            >
                                Step {visibleStep} of 3
                            </Badge>
                        </div>
                    }
                    right={
                        <>
                            {visibleStep === 1 ? (
                                <Button
                                    asChild
                                    variant="outline"
                                    className="rounded-full border-border/70 bg-transparent"
                                >
                                    <Link href="/leads/outreach">
                                        <ArrowLeft className="h-4 w-4" />
                                        Back
                                    </Link>
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-full border-border/70 bg-transparent"
                                    onClick={handlePrevStep}
                                >
                                    Back
                                </Button>
                            )}
                            {visibleStep > 1 && (
                                <Button
                                    asChild
                                    variant="outline"
                                    className="rounded-full border-border/70 bg-transparent"
                                >
                                    <Link href={`/leads/outreach/${existingCampaign?._id}`}>
                                        Campaign
                                    </Link>
                                </Button>
                            )}
                            {visibleStep < 3 ? (
                                <Button
                                    type="button"
                                    className="rounded-full"
                                    onClick={handleNextStep}
                                >
                                    Next
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    className="rounded-full"
                                    onClick={handleSaveDraft}
                                    disabled={isSavingDraft}
                                >
                                    {isSavingDraft ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    Save Changes
                                </Button>
                            )}
                        </>
                    }
                />
            )}

            <Dialog
                open={strategyEditor.open}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        closeStrategyEditor();
                    }
                }}
            >
                <DialogContent className="border-border/70 bg-card text-foreground sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>{strategyEditorTitle}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {strategyEditor.type === "question"
                                ? "Keep the checkpoint clear and answerable in one response."
                                : "Describe the pushback and the exact redirect the AI should use."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="strategy-editor-copy">
                            {strategyEditor.type === "question"
                                ? "Question copy"
                                : "Objection path copy"}
                        </Label>
                        <Textarea
                            id="strategy-editor-copy"
                            rows={4}
                            value={strategyEditor.value}
                            onChange={(event) =>
                                setStrategyEditor((current) => ({
                                    ...current,
                                    value: event.target.value,
                                }))
                            }
                            className="border-border/70 bg-background"
                        />
                    </div>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            className="text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            onClick={closeStrategyEditor}
                        >
                            Cancel
                        </Button>
                        <Button type="button" className="rounded-full" onClick={saveStrategyEditor}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
