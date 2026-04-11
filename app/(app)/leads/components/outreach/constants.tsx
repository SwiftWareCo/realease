import { Badge } from "@/components/ui/badge";
import { OUTREACH_OUTCOME_LABELS } from "@/lib/outreach/outcomes";
import { CheckCircle2, Circle } from "lucide-react";
import type { CampaignStatus, Weekday } from "./types";

export const WEEKDAYS: Array<{ label: string; value: Weekday }> = [
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
    { label: "Sat", value: 6 },
];

export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export const REASON_LABELS: Record<string, string> = {
    invalid_phone: "Invalid Phone",
    do_not_call: "Do Not Call",
    status_not_eligible: "Status Not Eligible",
    active_call_in_progress: "Active Call",
    in_other_active_campaign: "In Another Active Campaign",
    max_attempts_reached: "Max Attempts Reached",
    blocked_by_terminal_outcome: "Terminal Outcome",
    campaign_not_active: "Campaign Not Active",
    lead_not_found: "Lead Not Found",
    already_in_this_campaign: "Already In This Campaign",
    template_mismatch: "Wrong Template",
    outside_calling_window: "Outside Calling Window",
    cooldown_active: "Cooldown Active",
};

export const OUTCOME_LABELS = OUTREACH_OUTCOME_LABELS;

export function getCampaignStatusBadge(status: CampaignStatus) {
    switch (status) {
        case "active":
            return (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    Active
                </Badge>
            );
        case "paused":
            return (
                <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                    Paused
                </Badge>
            );
        case "draft":
            return <Badge variant="secondary">Draft</Badge>;
        case "completed":
            return <Badge variant="outline">Completed</Badge>;
        case "archived":
            return <Badge variant="outline">Archived</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

export function WizardStep({
    active,
    done,
    label,
}: {
    active: boolean;
    done: boolean;
    label: string;
}) {
    return (
        <div className="flex items-center gap-2">
            {done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : active ? (
                <Circle className="h-4 w-4 fill-primary text-primary" />
            ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span
                className={
                    active
                        ? "text-sm font-medium"
                        : "text-sm text-muted-foreground"
                }
            >
                {label}
            </span>
        </div>
    );
}
