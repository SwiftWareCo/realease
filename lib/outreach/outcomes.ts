const OUTREACH_OUTCOME_LABELS = {
    connected_interested: "Interested",
    connected_not_interested: "Not Interested",
    callback_requested: "Callback Requested",
    voicemail_left: "Voicemail Left",
    no_answer: "No Answer",
    wrong_number: "Wrong Number",
    do_not_call: "Do Not Call",
    failed: "Failed",
} as const;

const OUTREACH_OUTCOME_ALIASES: Record<string, keyof typeof OUTREACH_OUTCOME_LABELS> = {
    connected_interested: "connected_interested",
    interested: "connected_interested",
    qualified: "connected_interested",
    connected_not_interested: "connected_not_interested",
    not_interested: "connected_not_interested",
    uninterested: "connected_not_interested",
    no_interest: "connected_not_interested",
    callback_requested: "callback_requested",
    callback: "callback_requested",
    call_back: "callback_requested",
    voicemail_left: "voicemail_left",
    voicemail: "voicemail_left",
    no_answer: "no_answer",
    unanswered: "no_answer",
    wrong_number: "wrong_number",
    do_not_call: "do_not_call",
    dnc: "do_not_call",
    failed: "failed",
    failure: "failed",
};

export type OutreachOutcomeKey = keyof typeof OUTREACH_OUTCOME_LABELS;

export function normalizeOutreachOutcomeKey(
    value: string | null | undefined,
): OutreachOutcomeKey | null {
    const normalized = value
        ?.toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    if (!normalized) {
        return null;
    }

    return OUTREACH_OUTCOME_ALIASES[normalized] ?? null;
}

export function getOutreachOutcomeLabel(
    value: string | null | undefined,
): string | null {
    const normalized = normalizeOutreachOutcomeKey(value);
    if (!normalized) {
        return value?.trim() || null;
    }
    return OUTREACH_OUTCOME_LABELS[normalized];
}

export { OUTREACH_OUTCOME_LABELS };
