"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatHourTo12Hour } from "@/utils/dateandtimes";
import { HOURS, WEEKDAYS, WizardStep } from "./constants";
import type { CampaignTemplate, CreateCampaignInput } from "./types";
import { RuntimeSummaryCard } from "./RuntimeSummaryCard";

export function CampaignCreateWizard({
    templates,
    isCreating,
    onCreate,
}: {
    templates: CampaignTemplate[];
    isCreating: boolean;
    onCreate: (input: CreateCampaignInput) => Promise<void>;
}) {
    const [step, setStep] = useState<"template" | "details">("template");
    const [selectedTemplateKey, setSelectedTemplateKey] = useState<
        CampaignTemplate["key"] | null
    >(templates[0]?.key ?? null);
    const [name, setName] = useState(templates[0]?.defaultName ?? "");
    const [description, setDescription] = useState("");
    const [startHour, setStartHour] = useState(
        templates[0]?.runtimeSummary.callingWindow.start_hour_local ?? 9,
    );
    const [endHour, setEndHour] = useState(
        templates[0]?.runtimeSummary.callingWindow.end_hour_local ?? 18,
    );
    const [allowedWeekdays, setAllowedWeekdays] = useState<number[]>(
        templates[0]?.runtimeSummary.callingWindow.allowed_weekdays ?? [
            1, 2, 3, 4, 5,
        ],
    );
    const [maxAttempts, setMaxAttempts] = useState(
        templates[0]?.runtimeSummary.maxAttempts ?? 3,
    );
    const [cooldownMinutes, setCooldownMinutes] = useState(
        templates[0]?.runtimeSummary.cooldownMinutes ?? 60,
    );
    const [followUpSmsEnabled, setFollowUpSmsEnabled] = useState(
        templates[0]?.runtimeSummary.followUpSms.enabled ?? true,
    );
    const [followUpSmsTemplate, setFollowUpSmsTemplate] = useState(
        templates[0]?.runtimeSummary.followUpSms.defaultTemplate ?? "",
    );

    const selectedTemplate = useMemo(
        () =>
            templates.find((template) => template.key === selectedTemplateKey) ??
            null,
        [selectedTemplateKey, templates],
    );

    const handleCreate = async () => {
        if (!selectedTemplate) {
            toast.error("Select a campaign template.");
            return;
        }
        if (!name.trim()) {
            toast.error("Campaign name is required.");
            return;
        }
        await onCreate({
            name: name.trim(),
            description: description.trim() || undefined,
            template_key: selectedTemplate.key,
            template_version: selectedTemplate.version,
            calling_window: {
                start_hour_local: startHour,
                end_hour_local: endHour,
                allowed_weekdays: allowedWeekdays as Array<
                    0 | 1 | 2 | 3 | 4 | 5 | 6
                >,
            },
            retry_policy: {
                max_attempts: maxAttempts,
                min_minutes_between_attempts: cooldownMinutes,
            },
            follow_up_sms: {
                enabled: followUpSmsEnabled,
                delay_minutes: 3,
                default_template: followUpSmsTemplate.trim() || undefined,
                send_only_on_outcomes: followUpSmsEnabled
                    ? ["no_answer", "voicemail_left"]
                    : [],
            },
        });
        setStep("template");
        setSelectedTemplateKey(templates[0]?.key ?? null);
        setName(templates[0]?.defaultName ?? "");
        setDescription("");
    };

    const applyTemplateDefaults = (template: CampaignTemplate) => {
        setSelectedTemplateKey(template.key);
        setName(template.defaultName);
        setStartHour(template.runtimeSummary.callingWindow.start_hour_local);
        setEndHour(template.runtimeSummary.callingWindow.end_hour_local);
        setAllowedWeekdays(
            template.runtimeSummary.callingWindow.allowed_weekdays,
        );
        setMaxAttempts(template.runtimeSummary.maxAttempts);
        setCooldownMinutes(template.runtimeSummary.cooldownMinutes);
        setFollowUpSmsEnabled(template.runtimeSummary.followUpSms.enabled);
        setFollowUpSmsTemplate(
            template.runtimeSummary.followUpSms.defaultTemplate ?? "",
        );
    };

    const toggleWeekday = (weekday: number) => {
        setAllowedWeekdays((current) =>
            current.includes(weekday)
                ? current.filter((value) => value !== weekday)
                : [...current, weekday].sort((a, b) => a - b),
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <WizardStep
                    active={step === "template"}
                    done={step === "details"}
                    label="Template"
                />
                <WizardStep
                    active={step === "details"}
                    done={false}
                    label="Details"
                />
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
                                    onClick={() => applyTemplateDefaults(template)}
                                    className={`rounded-xl border p-4 text-left transition-colors ${
                                        selected
                                            ? "border-primary bg-primary/5"
                                            : "hover:border-primary/40 hover:bg-muted/30"
                                    }`}
                                >
                                    <p className="text-base font-semibold">
                                        {template.label}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Template v{template.version}
                                    </p>
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        {template.description}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                    <RuntimeSummaryCard
                        summary={selectedTemplate?.runtimeSummary}
                        compact
                    />
                </div>
            )}

            {step === "details" && (
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="campaign-create-name">
                            Campaign name
                        </Label>
                        <Input
                            id="campaign-create-name"
                            placeholder="Campaign name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="campaign-create-description">
                            Description
                        </Label>
                        <Textarea
                            id="campaign-create-description"
                            placeholder="Description (optional)"
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            rows={3}
                        />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="campaign-create-start-hour">
                                Calling window start
                            </Label>
                            <Select
                                value={String(startHour)}
                                onValueChange={(value) =>
                                    setStartHour(Number(value))
                                }
                            >
                                <SelectTrigger id="campaign-create-start-hour">
                                    <SelectValue placeholder="Start hour" />
                                </SelectTrigger>
                                <SelectContent>
                                    {HOURS.map((hour) => (
                                        <SelectItem
                                            key={hour}
                                            value={String(hour)}
                                        >
                                            Start: {formatHourTo12Hour(hour)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="campaign-create-end-hour">
                                Calling window end
                            </Label>
                            <Select
                                value={String(endHour)}
                                onValueChange={(value) =>
                                    setEndHour(Number(value))
                                }
                            >
                                <SelectTrigger id="campaign-create-end-hour">
                                    <SelectValue placeholder="End hour" />
                                </SelectTrigger>
                                <SelectContent>
                                    {HOURS.map((hour) => (
                                        <SelectItem
                                            key={hour}
                                            value={String(hour)}
                                        >
                                            End: {formatHourTo12Hour(hour)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2 rounded-md border p-3">
                        <Label className="text-xs text-muted-foreground">
                            Calling days
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {WEEKDAYS.map((weekday) => (
                                <Button
                                    key={weekday.value}
                                    type="button"
                                    size="sm"
                                    variant={
                                        allowedWeekdays.includes(weekday.value)
                                            ? "default"
                                            : "outline"
                                    }
                                    onClick={() => toggleWeekday(weekday.value)}
                                >
                                    {weekday.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="campaign-create-max-attempts">
                                Max call attempts
                            </Label>
                            <Input
                                id="campaign-create-max-attempts"
                                type="number"
                                min={1}
                                value={maxAttempts}
                                onChange={(event) =>
                                    setMaxAttempts(
                                        Number(event.target.value || 1),
                                    )
                                }
                                placeholder="Max attempts"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="campaign-create-cooldown">
                                Cooldown between attempts (minutes)
                            </Label>
                            <Input
                                id="campaign-create-cooldown"
                                type="number"
                                min={0}
                                value={cooldownMinutes}
                                onChange={(event) =>
                                    setCooldownMinutes(
                                        Number(event.target.value || 0),
                                    )
                                }
                                placeholder="Cooldown minutes"
                            />
                        </div>
                    </div>
                    <div className="space-y-3 rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <Label htmlFor="campaign-create-follow-up-enabled">
                                    Follow-up SMS
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Sends only for no-answer or voicemail outcomes.
                                </p>
                            </div>
                            <Checkbox
                                id="campaign-create-follow-up-enabled"
                                checked={followUpSmsEnabled}
                                onCheckedChange={(checked) =>
                                    setFollowUpSmsEnabled(checked === true)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="campaign-create-follow-up-sms">
                                Default follow-up SMS template
                            </Label>
                            <Textarea
                                id="campaign-create-follow-up-sms"
                                value={followUpSmsTemplate}
                                onChange={(event) =>
                                    setFollowUpSmsTemplate(event.target.value)
                                }
                                disabled={!followUpSmsEnabled}
                                rows={3}
                                placeholder="Default follow-up SMS template"
                            />
                        </div>
                    </div>
                    {selectedTemplate && (
                        <RuntimeSummaryCard
                            summary={selectedTemplate.runtimeSummary}
                            title="Campaign Defaults"
                            compact
                        />
                    )}
                </div>
            )}

            <div className="flex justify-end gap-2">
                {step === "details" && (
                    <Button variant="outline" onClick={() => setStep("template")}>
                        Back
                    </Button>
                )}
                {step === "template" ? (
                    <Button
                        onClick={() => setStep("details")}
                        disabled={!selectedTemplate}
                    >
                        Next
                    </Button>
                ) : (
                    <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
                        {isCreating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Create Campaign"
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}
