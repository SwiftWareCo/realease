"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { HOURS, WEEKDAYS } from "./constants";
import type { CampaignRow, CampaignSettingsInput, CampaignStatus, Weekday } from "./types";

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
    const [timezone, setTimezone] = useState(campaign.timezone);
    const [startHour, setStartHour] = useState(
        campaign.callingWindow.start_hour_local,
    );
    const [endHour, setEndHour] = useState(campaign.callingWindow.end_hour_local);
    const [allowedWeekdays, setAllowedWeekdays] = useState<Weekday[]>(
        campaign.callingWindow.allowed_weekdays,
    );
    const [maxAttempts, setMaxAttempts] = useState(
        campaign.retryPolicy.max_attempts,
    );
    const [cooldownMinutes, setCooldownMinutes] = useState(
        campaign.retryPolicy.min_minutes_between_attempts,
    );
    const [retellAgentId, setRetellAgentId] = useState(campaign.retellAgentId);
    const [retellPhoneNumberId, setRetellPhoneNumberId] = useState(
        campaign.retellPhoneNumberId ?? "",
    );
    const [twilioMessagingServiceSid, setTwilioMessagingServiceSid] = useState(
        campaign.twilioMessagingServiceSid ?? "",
    );

    const toggleWeekday = (weekday: Weekday) => {
        setAllowedWeekdays((prev) =>
            prev.includes(weekday)
                ? prev.filter((value) => value !== weekday)
                : [...prev, weekday].sort((a, b) => a - b),
        );
    };

    const saveDisabled =
        isSaving ||
        !name.trim() ||
        !timezone.trim() ||
        allowedWeekdays.length === 0 ||
        maxAttempts < 1 ||
        cooldownMinutes < 0;

    return (
        <div className="space-y-3">
            <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Campaign name"
            />
            <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                placeholder="Description"
            />
            <Select
                value={status}
                onValueChange={(value) => setStatus(value as CampaignStatus)}
            >
                <SelectTrigger>
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
            <Input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="Timezone"
            />

            <div className="grid gap-3 sm:grid-cols-2">
                <Select
                    value={String(startHour)}
                    onValueChange={(value) => setStartHour(Number(value))}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Start hour" />
                    </SelectTrigger>
                    <SelectContent>
                        {HOURS.map((hour) => (
                            <SelectItem key={`start-${hour}`} value={String(hour)}>
                                Start: {hour}:00
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={String(endHour)}
                    onValueChange={(value) => setEndHour(Number(value))}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="End hour" />
                    </SelectTrigger>
                    <SelectContent>
                        {HOURS.map((hour) => (
                            <SelectItem key={`end-${hour}`} value={String(hour)}>
                                End: {hour}:00
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Allowed weekdays</p>
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
                <Input
                    type="number"
                    min={1}
                    value={maxAttempts}
                    onChange={(event) => setMaxAttempts(Number(event.target.value || 1))}
                    placeholder="Max attempts"
                />
                <Input
                    type="number"
                    min={0}
                    value={cooldownMinutes}
                    onChange={(event) =>
                        setCooldownMinutes(Number(event.target.value || 0))
                    }
                    placeholder="Cooldown minutes"
                />
            </div>

            <Input
                value={retellAgentId}
                onChange={(event) => setRetellAgentId(event.target.value)}
                placeholder="Retell agent ID"
            />
            <Input
                value={retellPhoneNumberId}
                onChange={(event) => setRetellPhoneNumberId(event.target.value)}
                placeholder="Retell outbound number (E.164, blank = default)"
            />
            <Input
                value={twilioMessagingServiceSid}
                onChange={(event) => setTwilioMessagingServiceSid(event.target.value)}
                placeholder="Twilio messaging SID (blank = default)"
            />

            <Button
                className="w-full"
                onClick={() =>
                    onSave({
                        name,
                        description,
                        status,
                        timezone,
                        startHour,
                        endHour,
                        allowedWeekdays,
                        maxAttempts,
                        cooldownMinutes,
                        retellAgentId,
                        retellPhoneNumberId,
                        twilioMessagingServiceSid,
                    })
                }
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
