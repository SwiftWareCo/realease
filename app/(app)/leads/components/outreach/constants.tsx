type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: Array<{ label: string; value: Weekday }> = [
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
    { label: "Sat", value: 6 },
];

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
