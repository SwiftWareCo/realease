"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Save } from "lucide-react";
import { formatHourTo12Hour } from "@/utils/dateandtimes";
import { HOURS, WEEKDAYS } from "./constants";
import type {
    CampaignRow,
    CampaignSettingsInput,
    CampaignStatus,
    OutcomeRoutingRule,
    Weekday,
} from "./types";
import { RuntimeSummaryCard } from "./RuntimeSummaryCard";
import { getOutreachOutcomeLabel } from "@/lib/outreach/outcomes";

const EMPTY_SELECT_VALUE = "__none";
const SMS_SELECT_INHERIT_VALUE = "__inherit";
const LEAD_STATUS_OPTIONS = ["new", "contacted", "qualified"] as const;
const BUYER_STAGE_OPTIONS = [
    "searching",
    "showings",
    "offer_out",
    "under_contract",
    "closed",
] as const;
const SELLER_STAGE_OPTIONS = [
    "pre_listing",
    "on_market",
    "offer_in",
    "under_contract",
    "sold",
] as const;
const TERMINAL_OUTCOMES = new Set(["do_not_call", "wrong_number"]);
const SMS_TRIGGER_OUTCOMES = new Set(["no_answer", "voicemail_left"]);
const CAMPAIGN_ACTION_OPTIONS = [
    {
        value: "continue",
        label: "Continue campaign calls",
        description: "Use retry rules after this result.",
    },
    {
        value: "stop_calling",
        label: "Stop calling this lead",
        description: "Mark this lead done within this campaign.",
    },
    {
        value: "pause_for_realtor",
        label: "Pause for realtor review",
        description: "Stop scheduler retries until a realtor reviews the lead.",
    },
] as const;

export function CampaignSettingsForm({
    campaign,
    isSaving,
    onSave,
}: {
    campaign: CampaignRow;
    isSaving: boolean;
    onSave: (input: CampaignSettingsInput) => Promise<void>;
}) {
    const [name, setName] = useState(campaign.name);
    const [description, setDescription] = useState(campaign.description ?? "");
    const [status, setStatus] = useState<CampaignStatus>(campaign.status);
    const [startHour, setStartHour] = useState(
        campaign.callingWindow.start_hour_local,
    );
    const [endHour, setEndHour] = useState(
        campaign.callingWindow.end_hour_local,
    );
    const [allowedWeekdays, setAllowedWeekdays] = useState<Weekday[]>(
        campaign.callingWindow.allowed_weekdays,
    );
    const [maxAttempts, setMaxAttempts] = useState(
        campaign.retryPolicy.max_attempts,
    );
    const [cooldownMinutes, setCooldownMinutes] = useState(
        campaign.retryPolicy.min_minutes_between_attempts,
    );
    const [followUpSmsEnabled, setFollowUpSmsEnabled] = useState(
        campaign.followUpSms.enabled,
    );
    const [followUpSmsDefaultTemplate, setFollowUpSmsDefaultTemplate] =
        useState(campaign.followUpSms.default_template ?? "");
    const [outcomeRouting, setOutcomeRouting] = useState<OutcomeRoutingRule[]>(
        campaign.runtimeSummary?.outcomeRouting ?? [],
    );
    const isRunning = campaign.status === "active";

    const saveDisabled =
        isSaving ||
        isRunning ||
        !name.trim() ||
        allowedWeekdays.length === 0 ||
        maxAttempts < 1 ||
        cooldownMinutes < 0;

    const followUpHint =
        "Milestone 5 policy: follow-up SMS sends only after 3 no-answer attempts.";

    const smsTemplatePlaceholder =
        "Hi {{lead_name}}, sorry we missed you. This is {{campaign_name}}. Reply STOP to opt out.";
    const smsTemplateHelper =
        "Available variables: {{lead_name}}, {{campaign_name}}, {{outcome}}, {{call_summary}}.";

    const handleFollowUpSmsEnabledToggle = (
        checked: boolean | "indeterminate",
    ) => {
        setFollowUpSmsEnabled(checked === true);
    };

    const handleFollowUpSmsTemplateChange = (value: string) => {
        setFollowUpSmsDefaultTemplate(value);
    };

    const handleSave = async () => {
        await onSave({
            name,
            description,
            status,
            startHour,
            endHour,
            allowedWeekdays,
            maxAttempts,
            cooldownMinutes,
            followUpSmsEnabled,
            followUpSmsDefaultTemplate,
            outcomeRouting: outcomeRouting.map((rule) =>
                TERMINAL_OUTCOMES.has(rule.outcome) ||
                !SMS_TRIGGER_OUTCOMES.has(rule.outcome)
                    ? {
                          ...rule,
                          nextLeadStatus: TERMINAL_OUTCOMES.has(rule.outcome)
                              ? null
                              : rule.nextLeadStatus,
                          nextBuyerPipelineStage: TERMINAL_OUTCOMES.has(
                              rule.outcome,
                          )
                              ? null
                              : rule.nextBuyerPipelineStage,
                          nextSellerPipelineStage: TERMINAL_OUTCOMES.has(
                              rule.outcome,
                          )
                              ? null
                              : rule.nextSellerPipelineStage,
                          sendFollowUpSms: false,
                          customSmsTemplate: null,
                          hasCustomSmsTemplate: false,
                      }
                    : rule,
            ),
        });
    };

    const updateOutcomeRule = (
        outcome: OutcomeRoutingRule["outcome"],
        updates: Partial<OutcomeRoutingRule>,
    ) => {
        setOutcomeRouting((current) =>
            current.map((rule) =>
                rule.outcome === outcome ? { ...rule, ...updates } : rule,
            ),
        );
    };

    const followUpSmsSection = (
        <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <Label
                        htmlFor="follow-up-sms-enabled"
                        className="text-sm font-medium"
                    >
                        Follow-up SMS enabled
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        {followUpHint}
                    </p>
                </div>
                <Checkbox
                    id="follow-up-sms-enabled"
                    checked={followUpSmsEnabled}
                    onCheckedChange={handleFollowUpSmsEnabledToggle}
                />
            </div>

            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Follow-up SMS sends 3 minutes after final call outcome.
            </p>

            <div className="space-y-2">
                <Label
                    htmlFor="follow-up-sms-template"
                    className="text-xs text-muted-foreground"
                >
                    Default follow-up SMS template
                </Label>
                <Textarea
                    id="follow-up-sms-template"
                    value={followUpSmsDefaultTemplate}
                    onChange={(event) =>
                        handleFollowUpSmsTemplateChange(event.target.value)
                    }
                    rows={3}
                    disabled={!followUpSmsEnabled}
                    placeholder={smsTemplatePlaceholder}
                />
                <p className="text-[11px] text-muted-foreground">
                    {smsTemplateHelper}
                </p>
            </div>
        </div>
    );

    const toggleWeekday = (weekday: Weekday) => {
        setAllowedWeekdays((prev) =>
            prev.includes(weekday)
                ? prev.filter((value) => value !== weekday)
                : [...prev, weekday].sort((a, b) => a - b),
        );
    };

    const outcomeRoutingSection = (
        <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-1">
                <p className="text-sm font-medium">
                    What happens after each result
                </p>
                <p className="text-xs text-muted-foreground">
                    Edit safe routing fields only. Terminal outcomes stay
                    guarded and stop outreach.
                </p>
            </div>

            <div className="space-y-3">
                {outcomeRouting
                    .filter((rule) => !TERMINAL_OUTCOMES.has(rule.outcome))
                    .map((rule) => {
                    const terminalOutcome = TERMINAL_OUTCOMES.has(rule.outcome);
                    const smsSupportedOutcome = SMS_TRIGGER_OUTCOMES.has(
                        rule.outcome,
                    );
                    const smsValue =
                        rule.sendFollowUpSms === null
                            ? SMS_SELECT_INHERIT_VALUE
                            : rule.sendFollowUpSms
                              ? "send"
                              : "skip";

                    return (
                        <div
                            key={rule.outcome}
                            className="space-y-3 rounded-md border bg-background/60 p-3"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-medium">
                                        {getOutreachOutcomeLabel(rule.outcome) ??
                                            rule.outcome}
                                    </p>
                                    {terminalOutcome && (
                                        <p className="text-xs text-muted-foreground">
                                            Guarded terminal outcome. Outreach
                                            stops and follow-up SMS stays off.
                                        </p>
                                    )}
                                </div>
                                {!terminalOutcome && !smsSupportedOutcome && (
                                    <Badge variant="outline">
                                        SMS not supported
                                    </Badge>
                                )}
                            </div>

                            <div className="space-y-2 rounded-md border border-dashed p-3">
                                <Label className="text-xs text-muted-foreground">
                                    Internal campaign action
                                </Label>
                                <Select
                                    value={
                                        rule.campaignLeadAction ?? "continue"
                                    }
                                    onValueChange={(value) =>
                                        updateOutcomeRule(rule.outcome, {
                                            campaignLeadAction:
                                                value as OutcomeRoutingRule["campaignLeadAction"],
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Internal campaign action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CAMPAIGN_ACTION_OPTIONS.map(
                                            (option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">
                                    {CAMPAIGN_ACTION_OPTIONS.find(
                                        (option) =>
                                            option.value ===
                                            (rule.campaignLeadAction ??
                                                "continue"),
                                    )?.description ?? ""}
                                </p>
                            </div>

                            <div className="space-y-1 rounded-md border border-dashed p-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Lead-management updates
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Retell selects the result. RealEase maps the
                                    result to these status/stage updates; Retell
                                    is not choosing buyer or seller stage.
                                </p>
                            </div>

                            <div className="grid gap-2 md:grid-cols-2">
                                <Select
                                    value={
                                        rule.nextLeadStatus ??
                                        EMPTY_SELECT_VALUE
                                    }
                                    disabled={terminalOutcome}
                                    onValueChange={(value) =>
                                        updateOutcomeRule(rule.outcome, {
                                            nextLeadStatus:
                                                value === EMPTY_SELECT_VALUE
                                                    ? null
                                                    : (value as OutcomeRoutingRule["nextLeadStatus"]),
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Lead status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={EMPTY_SELECT_VALUE}>
                                            No status change
                                        </SelectItem>
                                        {LEAD_STATUS_OPTIONS.map((status) => (
                                            <SelectItem
                                                key={status}
                                                value={status}
                                            >
                                                Status: {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={
                                        rule.nextBuyerPipelineStage ??
                                        EMPTY_SELECT_VALUE
                                    }
                                    disabled={terminalOutcome}
                                    onValueChange={(value) =>
                                        updateOutcomeRule(rule.outcome, {
                                            nextBuyerPipelineStage:
                                                value === EMPTY_SELECT_VALUE
                                                    ? null
                                                    : (value as OutcomeRoutingRule["nextBuyerPipelineStage"]),
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Buyer stage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={EMPTY_SELECT_VALUE}>
                                            No buyer stage change
                                        </SelectItem>
                                        {BUYER_STAGE_OPTIONS.map((stage) => (
                                            <SelectItem
                                                key={stage}
                                                value={stage}
                                            >
                                                Buyer: {stage}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={
                                        rule.nextSellerPipelineStage ??
                                        EMPTY_SELECT_VALUE
                                    }
                                    disabled={terminalOutcome}
                                    onValueChange={(value) =>
                                        updateOutcomeRule(rule.outcome, {
                                            nextSellerPipelineStage:
                                                value === EMPTY_SELECT_VALUE
                                                    ? null
                                                    : (value as OutcomeRoutingRule["nextSellerPipelineStage"]),
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seller stage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={EMPTY_SELECT_VALUE}>
                                            No seller stage change
                                        </SelectItem>
                                        {SELLER_STAGE_OPTIONS.map((stage) => (
                                            <SelectItem
                                                key={stage}
                                                value={stage}
                                            >
                                                Seller: {stage}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={
                                        terminalOutcome || !smsSupportedOutcome
                                            ? "skip"
                                            : smsValue
                                    }
                                    disabled={
                                        terminalOutcome || !smsSupportedOutcome
                                    }
                                    onValueChange={(value) =>
                                        updateOutcomeRule(rule.outcome, {
                                            sendFollowUpSms:
                                                value ===
                                                SMS_SELECT_INHERIT_VALUE
                                                    ? null
                                                    : value === "send",
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="SMS behavior" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem
                                            value={SMS_SELECT_INHERIT_VALUE}
                                        >
                                            Use campaign SMS policy
                                        </SelectItem>
                                        <SelectItem value="send">
                                            Send follow-up SMS
                                        </SelectItem>
                                        <SelectItem value="skip">
                                            Do not send SMS
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Textarea
                                value={rule.customSmsTemplate ?? ""}
                                onChange={(event) =>
                                    updateOutcomeRule(rule.outcome, {
                                        customSmsTemplate:
                                            event.target.value || null,
                                        hasCustomSmsTemplate: Boolean(
                                            event.target.value.trim(),
                                        ),
                                    })
                                }
                                rows={2}
                                disabled={
                                    terminalOutcome ||
                                    !smsSupportedOutcome ||
                                    rule.sendFollowUpSms === false
                                }
                                placeholder="Optional custom SMS template for this outcome"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="space-y-3">
            <RuntimeSummaryCard
                summary={campaign.runtimeSummary}
                title="Current Runtime Rules"
                compact
            />
            {isRunning && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    This campaign is active. Pause it before editing runtime
                    settings or outcome rules.
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="campaign-settings-name">Campaign name</Label>
                <Input
                    id="campaign-settings-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Campaign name"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="campaign-settings-description">
                    Description
                </Label>
                <Textarea
                    id="campaign-settings-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    placeholder="Description"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="campaign-settings-status">Status</Label>
                <Select
                    value={status}
                    onValueChange={(value) =>
                        setStatus(value as CampaignStatus)
                    }
                >
                    <SelectTrigger id="campaign-settings-status">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="campaign-settings-start-hour">
                        Calling window start
                    </Label>
                    <Select
                        value={String(startHour)}
                        onValueChange={(value) => setStartHour(Number(value))}
                    >
                        <SelectTrigger id="campaign-settings-start-hour">
                            <SelectValue placeholder="Start hour" />
                        </SelectTrigger>
                        <SelectContent>
                            {HOURS.map((hour) => (
                                <SelectItem
                                    key={`start-${hour}`}
                                    value={String(hour)}
                                >
                                    Start: {formatHourTo12Hour(hour)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="campaign-settings-end-hour">
                        Calling window end
                    </Label>
                    <Select
                        value={String(endHour)}
                        onValueChange={(value) => setEndHour(Number(value))}
                    >
                        <SelectTrigger id="campaign-settings-end-hour">
                            <SelectValue placeholder="End hour" />
                        </SelectTrigger>
                        <SelectContent>
                            {HOURS.map((hour) => (
                                <SelectItem
                                    key={`end-${hour}`}
                                    value={String(hour)}
                                >
                                    End: {formatHourTo12Hour(hour)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                    Allowed weekdays
                </p>
                <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((weekday) => {
                        const checked = allowedWeekdays.includes(weekday.value);
                        return (
                            <Button
                                key={weekday.value}
                                type="button"
                                size="sm"
                                variant={checked ? "default" : "outline"}
                                onClick={() => toggleWeekday(weekday.value)}
                            >
                                {weekday.label}
                            </Button>
                        );
                    })}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="campaign-settings-max-attempts">
                        Max call attempts
                    </Label>
                    <Input
                        id="campaign-settings-max-attempts"
                        type="number"
                        min={1}
                        value={maxAttempts}
                        onChange={(event) =>
                            setMaxAttempts(Number(event.target.value || 1))
                        }
                        placeholder="Max attempts"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="campaign-settings-cooldown">
                        Cooldown between attempts (minutes)
                    </Label>
                    <Input
                        id="campaign-settings-cooldown"
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

            {followUpSmsSection}
            {outcomeRoutingSection}

            <Button
                className="w-full"
                onClick={handleSave}
                disabled={saveDisabled}
            >
                {isSaving ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Settings
                    </>
                )}
            </Button>
        </div>
    );
}
