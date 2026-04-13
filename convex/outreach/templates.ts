import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";

export const OUTREACH_CAMPAIGN_TEMPLATE_KEYS = [
    "buyer_outreach",
    "buyer_reengagement",
    "seller_outreach",
    "seller_reengagement",
] as const;

export type OutreachCampaignTemplateKey =
    (typeof OUTREACH_CAMPAIGN_TEMPLATE_KEYS)[number];

export const outreachCampaignTemplateKeyValidator = v.union(
    v.literal("buyer_outreach"),
    v.literal("buyer_reengagement"),
    v.literal("seller_outreach"),
    v.literal("seller_reengagement"),
);

export const outreachTemplateLeadTypeValidator = v.union(
    v.literal("buyer"),
    v.literal("seller"),
);

export const outreachCampaignCategoryValidator = v.union(
    v.literal("acquisition"),
    v.literal("reactivation"),
    v.literal("listing"),
    v.literal("retention"),
);

export const outreachCampaignChannelValidator = v.union(
    v.literal("voice_ai"),
    v.literal("sms_ai"),
    v.literal("voice_and_sms"),
);

export const outreachCampaignFocusValidator = v.object({
    profile_key: v.string(),
    label: v.string(),
    category: outreachCampaignCategoryValidator,
    channel: outreachCampaignChannelValidator,
    audience: v.string(),
    goal: v.string(),
    success_metric: v.optional(v.string()),
    recommended_lead_type: v.optional(outreachTemplateLeadTypeValidator),
});

export type OutreachCampaignFocus = {
    profile_key: string;
    label: string;
    category: "acquisition" | "reactivation" | "listing" | "retention";
    channel: "voice_ai" | "sms_ai" | "voice_and_sms";
    audience: string;
    goal: string;
    success_metric?: string;
    recommended_lead_type?: "buyer" | "seller";
};

export const outreachAgentInstructionsValidator = v.object({
    call_objective: v.string(),
    opening_line: v.string(),
    tone: v.string(),
    qualification_questions: v.array(v.string()),
    objection_handling_notes: v.string(),
    voicemail_guidance: v.string(),
    compliance_disclosure: v.optional(v.string()),
});

export type OutreachAgentInstructions = {
    call_objective: string;
    opening_line: string;
    tone: string;
    qualification_questions: string[];
    objection_handling_notes: string;
    voicemail_guidance: string;
    compliance_disclosure?: string;
};

export type OutreachCampaignTemplateDefinition = {
    key: OutreachCampaignTemplateKey;
    version: number;
    label: string;
    shortLabel: string;
    description: string;
    recommendedLeadType: "buyer" | "seller";
    defaultNamePrefix: string;
    focus: OutreachCampaignFocus;
    callingWindow: Doc<"outreachCampaigns">["calling_window"];
    retryPolicy: Doc<"outreachCampaigns">["retry_policy"];
    followUpSms: NonNullable<Doc<"outreachCampaigns">["follow_up_sms"]>;
    outcomeRouting: NonNullable<Doc<"outreachCampaigns">["outcome_routing"]>;
    agentInstructions: OutreachAgentInstructions;
    customTemplateId?: Id<"outreachCampaignTemplates"> | null;
};

const BUYER_REENGAGEMENT_CALLING_WINDOW: Doc<"outreachCampaigns">["calling_window"] =
    {
        start_hour_local: 10,
        start_minute_local: 0,
        end_hour_local: 17,
        end_minute_local: 0,
        allowed_weekdays: [2, 3, 4, 5, 6],
    };

const SELLER_OUTREACH_CALLING_WINDOW: Doc<"outreachCampaigns">["calling_window"] =
    {
        start_hour_local: 10,
        start_minute_local: 30,
        end_hour_local: 19,
        end_minute_local: 0,
        allowed_weekdays: [1, 2, 3, 4, 5],
    };

const SELLER_REENGAGEMENT_CALLING_WINDOW: Doc<"outreachCampaigns">["calling_window"] =
    {
        start_hour_local: 11,
        start_minute_local: 0,
        end_hour_local: 16,
        end_minute_local: 30,
        allowed_weekdays: [2, 3, 4, 6],
    };

const DEFAULT_RETRY_POLICY: Doc<"outreachCampaigns">["retry_policy"] = {
    max_attempts: 3,
    min_minutes_between_attempts: 60,
};

function buildBuyerRouting() {
    return [
        {
            outcome: "connected_interested" as const,
            next_lead_status: "qualified" as const,
            next_buyer_pipeline_stage: "showings" as const,
            send_follow_up_sms: false,
            campaign_lead_action: "stop_calling" as const,
        },
        {
            outcome: "connected_not_interested" as const,
            next_lead_status: "contacted" as const,
            send_follow_up_sms: false,
            campaign_lead_action: "stop_calling" as const,
        },
        {
            outcome: "callback_requested" as const,
            next_lead_status: "contacted" as const,
            next_buyer_pipeline_stage: "searching" as const,
            send_follow_up_sms: false,
            campaign_lead_action: "pause_for_realtor" as const,
        },
        {
            outcome: "no_answer" as const,
            next_lead_status: "contacted" as const,
            send_follow_up_sms: true,
            campaign_lead_action: "continue" as const,
        },
        {
            outcome: "voicemail_left" as const,
            next_lead_status: "contacted" as const,
            send_follow_up_sms: true,
            campaign_lead_action: "continue" as const,
        },
        {
            outcome: "wrong_number" as const,
            send_follow_up_sms: false,
        },
        {
            outcome: "do_not_call" as const,
            send_follow_up_sms: false,
        },
    ];
}

function buildSellerRouting() {
    return [
        {
            outcome: "connected_interested" as const,
            next_lead_status: "qualified" as const,
            next_seller_pipeline_stage: "pre_listing" as const,
            send_follow_up_sms: false,
            campaign_lead_action: "stop_calling" as const,
        },
        {
            outcome: "connected_not_interested" as const,
            next_lead_status: "contacted" as const,
            send_follow_up_sms: false,
            campaign_lead_action: "stop_calling" as const,
        },
        {
            outcome: "callback_requested" as const,
            next_lead_status: "contacted" as const,
            next_seller_pipeline_stage: "pre_listing" as const,
            send_follow_up_sms: false,
            campaign_lead_action: "pause_for_realtor" as const,
        },
        {
            outcome: "no_answer" as const,
            next_lead_status: "contacted" as const,
            send_follow_up_sms: true,
            campaign_lead_action: "continue" as const,
        },
        {
            outcome: "voicemail_left" as const,
            next_lead_status: "contacted" as const,
            send_follow_up_sms: true,
            campaign_lead_action: "continue" as const,
        },
        {
            outcome: "wrong_number" as const,
            send_follow_up_sms: false,
        },
        {
            outcome: "do_not_call" as const,
            send_follow_up_sms: false,
        },
    ];
}

const BUYER_OUTREACH_INSTRUCTIONS: OutreachAgentInstructions = {
    call_objective:
        "Qualify new buyer inquiries quickly, confirm motivation, and hand off high-intent leads for a live realtor follow-up.",
    opening_line:
        "Hi {{lead_name}}, this is {{agent_name}} following up on your home search. Do you have two minutes right now?",
    tone: "Confident, polished, and efficient without sounding rushed.",
    qualification_questions: [
        "Are you actively planning to buy in the next three months?",
        "Which neighborhoods and property types are at the top of your list?",
        "Do you already have financing or a pre-approval in place?",
        "Would you like a realtor to line up matching listings or a showing?",
    ],
    objection_handling_notes:
        "If timing is unclear, move the lead toward a soft follow-up instead of forcing a booking. If the lead is already represented, acknowledge it and end the call cleanly.",
    voicemail_guidance:
        "Leave a brief message referencing their inquiry, invite a text reply, and keep the callback request under 20 seconds.",
    compliance_disclosure:
        "If the lead asks not to be contacted, acknowledge it immediately and mark the outcome as do_not_call.",
};

const BUYER_REENGAGEMENT_INSTRUCTIONS: OutreachAgentInstructions = {
    call_objective:
        "Re-activate older buyer leads that cooled off, surface new timing, and reopen the pipeline with a specific reason to respond.",
    opening_line:
        "Hi {{lead_name}}, this is {{agent_name}} checking back in on your search. We have a few new matches and I wanted to see if your timing has changed.",
    tone: "Warm, strategic, and lightly consultative.",
    qualification_questions: [
        "Are you still planning to purchase this year?",
        "What changed since we last spoke: timing, budget, or location?",
        "Would updated inventory or pricing guidance be useful right now?",
        "Should a realtor follow up with a tighter shortlist for you?",
    ],
    objection_handling_notes:
        "Use curiosity rather than pressure. If they are paused, secure permission for a later check-in and keep the relationship positive.",
    voicemail_guidance:
        "Reference a market update or new inventory so the voicemail feels useful rather than generic.",
    compliance_disclosure:
        "Respect opt-out requests immediately and record do_not_call when requested.",
};

const SELLER_OUTREACH_INSTRUCTIONS: OutreachAgentInstructions = {
    call_objective:
        "Qualify homeowners for listing intent, uncover timing, and convert strong prospects into valuation or listing appointments.",
    opening_line:
        "Hi {{lead_name}}, this is {{agent_name}} reaching out with a quick market update for your property area. Is this still a good number for you?",
    tone: "Direct, authoritative, and service-led.",
    qualification_questions: [
        "Are you considering selling or repositioning this property in the next six months?",
        "Have you looked at recent pricing or demand in your immediate area?",
        "What would need to happen for you to seriously consider a move?",
        "Would a private valuation review be useful this week?",
    ],
    objection_handling_notes:
        "If the owner is hesitant, pivot from a listing ask to a low-friction valuation or market briefing. Never sound transactional.",
    voicemail_guidance:
        "Leave a concise market-update voicemail and mention that you can send a quick valuation snapshot by text.",
    compliance_disclosure:
        "If the lead declines further contact, log do_not_call immediately and stop the sequence.",
};

const SELLER_REENGAGEMENT_INSTRUCTIONS: OutreachAgentInstructions = {
    call_objective:
        "Reconnect with past clients and older seller opportunities around equity, anniversary, or market timing moments to create new listing conversations.",
    opening_line:
        "Hi {{lead_name}}, this is {{agent_name}} checking in because there have been a few meaningful market moves in your area and I thought a quick update might be useful.",
    tone: "Relationship-first, polished, and advisory.",
    qualification_questions: [
        "Have your housing plans changed since we last connected?",
        "Would an updated valuation or neighborhood demand snapshot help you right now?",
        "Are you thinking about refinancing, selling, or holding for now?",
        "Should a realtor prepare a custom review for you?",
    ],
    objection_handling_notes:
        "Keep the call framed as service, not pressure. The goal is to reopen a relationship and earn permission for a human follow-up.",
    voicemail_guidance:
        "Use a friendly anniversary or market-check language and offer to send a quick follow-up note by text.",
    compliance_disclosure:
        "Honor any request to stop contact immediately.",
};

function createTemplateDefinition(
    input: Omit<OutreachCampaignTemplateDefinition, "version">,
): OutreachCampaignTemplateDefinition {
    return {
        ...input,
        version: 2,
    };
}

function createFocus(input: OutreachCampaignFocus): OutreachCampaignFocus {
    return input;
}

export const OUTREACH_CAMPAIGN_TEMPLATES: Record<
    OutreachCampaignTemplateKey,
    OutreachCampaignTemplateDefinition
> = {
    buyer_outreach: createTemplateDefinition({
        key: "buyer_outreach",
        label: "Cold Buyer Outreach",
        shortLabel: "Buyer",
        description:
            "Fast-response outreach for newly captured buyer leads from forms, QR codes, and portal traffic.",
        recommendedLeadType: "buyer",
        defaultNamePrefix: "Cold Buyer Outreach",
        focus: createFocus({
            profile_key: "cold-buyer-outreach",
            label: "Cold Buyer Outreach",
            category: "acquisition",
            channel: "voice_and_sms",
            audience: "Net-new buyers and active search leads.",
            goal: "Convert fresh buyer inquiries into qualified showings.",
            success_metric: "Showings booked",
            recommended_lead_type: "buyer",
        }),
        callingWindow: {
            start_hour_local: 9,
            start_minute_local: 0,
            end_hour_local: 18,
            end_minute_local: 30,
            allowed_weekdays: [1, 2, 3, 4, 5, 6],
        },
        retryPolicy: DEFAULT_RETRY_POLICY,
        followUpSms: {
            enabled: true,
            delay_minutes: 3,
            default_template:
                "Hi {{lead_name}}, this is {{campaign_name}}. Sorry we missed you. Reply with a good time to talk, or STOP to opt out.",
            send_only_on_outcomes: ["no_answer", "voicemail_left"],
        },
        agentInstructions: BUYER_OUTREACH_INSTRUCTIONS,
        outcomeRouting: buildBuyerRouting(),
    }),
    buyer_reengagement: createTemplateDefinition({
        key: "buyer_reengagement",
        label: "Buyer Re-engagement",
        shortLabel: "Buyer Reactivation",
        description:
            "Revives buyer leads that went quiet by repositioning the outreach around new inventory and market movement.",
        recommendedLeadType: "buyer",
        defaultNamePrefix: "Buyer Re-engagement",
        focus: createFocus({
            profile_key: "buyer-reengagement",
            label: "Buyer Re-engagement",
            category: "reactivation",
            channel: "voice_and_sms",
            audience: "Dormant buyer leads with prior activity.",
            goal: "Restart conversations and route interested buyers back to an agent.",
            success_metric: "Reactivated conversations",
            recommended_lead_type: "buyer",
        }),
        callingWindow: BUYER_REENGAGEMENT_CALLING_WINDOW,
        retryPolicy: {
            max_attempts: 2,
            min_minutes_between_attempts: 180,
        },
        followUpSms: {
            enabled: true,
            delay_minutes: 3,
            default_template:
                "Hi {{lead_name}}, this is {{campaign_name}} with a quick market update. Reply if you want a refreshed shortlist or a callback. STOP to opt out.",
            send_only_on_outcomes: ["no_answer", "voicemail_left"],
        },
        agentInstructions: BUYER_REENGAGEMENT_INSTRUCTIONS,
        outcomeRouting: buildBuyerRouting(),
    }),
    seller_outreach: createTemplateDefinition({
        key: "seller_outreach",
        label: "Luxury Listing Outreach",
        shortLabel: "Listing",
        description:
            "Seller-first calling sequence tuned for valuation-driven conversations and listing appointments.",
        recommendedLeadType: "seller",
        defaultNamePrefix: "Luxury Listing Outreach",
        focus: createFocus({
            profile_key: "luxury-listing-outreach",
            label: "Luxury Listing Outreach",
            category: "listing",
            channel: "voice_and_sms",
            audience: "Homeowners and seller prospects with listing potential.",
            goal: "Book valuation reviews and listing consultations.",
            success_metric: "Listing appointments",
            recommended_lead_type: "seller",
        }),
        callingWindow: SELLER_OUTREACH_CALLING_WINDOW,
        retryPolicy: DEFAULT_RETRY_POLICY,
        followUpSms: {
            enabled: true,
            delay_minutes: 3,
            default_template:
                "Hi {{lead_name}}, this is {{campaign_name}}. I can send a quick valuation snapshot or market brief if helpful. Reply STOP to opt out.",
            send_only_on_outcomes: ["no_answer", "voicemail_left"],
        },
        agentInstructions: SELLER_OUTREACH_INSTRUCTIONS,
        outcomeRouting: buildSellerRouting(),
    }),
    seller_reengagement: createTemplateDefinition({
        key: "seller_reengagement",
        label: "Past Client Anniversary",
        shortLabel: "Anniversary",
        description:
            "Retention playbook for past clients and older homeowners, centered on relationship check-ins and equity conversations.",
        recommendedLeadType: "seller",
        defaultNamePrefix: "Past Client Anniversary",
        focus: createFocus({
            profile_key: "past-client-anniversary",
            label: "Past Client Anniversary",
            category: "retention",
            channel: "voice_and_sms",
            audience: "Past clients, sphere contacts, and aging homeowner leads.",
            goal: "Create new valuation and re-listing conversations from the sphere.",
            success_metric: "Warm handoffs created",
            recommended_lead_type: "seller",
        }),
        callingWindow: SELLER_REENGAGEMENT_CALLING_WINDOW,
        retryPolicy: {
            max_attempts: 2,
            min_minutes_between_attempts: 240,
        },
        followUpSms: {
            enabled: true,
            delay_minutes: 3,
            default_template:
                "Hi {{lead_name}}, this is {{campaign_name}} checking in with a quick market snapshot. Reply if you'd like an updated value review. STOP to opt out.",
            send_only_on_outcomes: ["no_answer", "voicemail_left"],
        },
        agentInstructions: SELLER_REENGAGEMENT_INSTRUCTIONS,
        outcomeRouting: buildSellerRouting(),
    }),
};

export function getOutreachCampaignTemplate(
    key: OutreachCampaignTemplateKey,
): OutreachCampaignTemplateDefinition {
    return OUTREACH_CAMPAIGN_TEMPLATES[key];
}

export function getDefaultAgentInstructions(
    key: OutreachCampaignTemplateKey,
): OutreachAgentInstructions {
    return getOutreachCampaignTemplate(key).agentInstructions;
}

export function getDefaultCampaignFocus(
    key: OutreachCampaignTemplateKey,
): OutreachCampaignFocus {
    return getOutreachCampaignTemplate(key).focus;
}

export function buildTemplateDefinitionFromCustomTemplate(
    template: Doc<"outreachCampaignTemplates">,
): OutreachCampaignTemplateDefinition {
    const baseTemplate = getOutreachCampaignTemplate(template.base_template_key);
    return {
        key: template.base_template_key,
        version: 2,
        label: template.label,
        shortLabel: template.short_label,
        description: template.description,
        recommendedLeadType: template.recommended_lead_type,
        defaultNamePrefix: template.default_name_prefix,
        focus: template.campaign_focus ?? baseTemplate.focus,
        callingWindow: template.calling_window,
        retryPolicy: template.retry_policy,
        followUpSms: template.follow_up_sms,
        outcomeRouting: template.outcome_routing,
        agentInstructions: template.agent_instructions,
        customTemplateId: template._id,
    };
}

export function normalizeAgentInstructions(
    instructions: OutreachAgentInstructions,
): OutreachAgentInstructions {
    const qualificationQuestions = instructions.qualification_questions
        .map((question) => question.trim())
        .filter(Boolean)
        .slice(0, 8);

    return {
        call_objective: instructions.call_objective.trim(),
        opening_line: instructions.opening_line.trim(),
        tone: instructions.tone.trim(),
        qualification_questions:
            qualificationQuestions.length > 0
                ? qualificationQuestions
                : ["Confirm whether this lead is interested in a realtor follow-up."],
        objection_handling_notes: instructions.objection_handling_notes.trim(),
        voicemail_guidance: instructions.voicemail_guidance.trim(),
        compliance_disclosure:
            instructions.compliance_disclosure?.trim() || undefined,
    };
}

export function buildRetellCampaignInstructions(
    instructions: OutreachAgentInstructions,
): string {
    const normalized = normalizeAgentInstructions(instructions);
    const questions = normalized.qualification_questions
        .map((question, index) => `${index + 1}. ${question}`)
        .join("\n");
    const compliance = normalized.compliance_disclosure
        ? `\nCompliance: ${normalized.compliance_disclosure}`
        : "";

    return [
        `Call objective: ${normalized.call_objective}`,
        `Opening line: ${normalized.opening_line}`,
        `Tone: ${normalized.tone}`,
        `Qualification questions:\n${questions}`,
        `Objection handling: ${normalized.objection_handling_notes}`,
        `Voicemail guidance: ${normalized.voicemail_guidance}${compliance}`,
    ].join("\n\n");
}

export function buildDefaultCampaignName(
    key: OutreachCampaignTemplateKey,
    timestampMs = Date.now(),
): string {
    const template = getOutreachCampaignTemplate(key);
    const date = new Date(timestampMs);
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${template.defaultNamePrefix} ${yyyy}-${mm}-${dd}`;
}

export function resolveCampaignTemplateKey(
    campaign:
        | Pick<Doc<"outreachCampaigns">, "template_key" | "name" | "description">
        | null
        | undefined,
): OutreachCampaignTemplateKey | null {
    if (campaign?.template_key) {
        return campaign.template_key;
    }

    const haystack = `${campaign?.name ?? ""} ${campaign?.description ?? ""}`
        .trim()
        .toLowerCase();
    if (haystack.includes("anniversary") || haystack.includes("past client")) {
        return "seller_reengagement";
    }
    if (
        haystack.includes("reactivation") ||
        haystack.includes("re-engagement") ||
        haystack.includes("reengagement")
    ) {
        return haystack.includes("seller")
            ? "seller_reengagement"
            : "buyer_reengagement";
    }
    if (haystack.includes("listing") || haystack.includes("seller")) {
        return "seller_outreach";
    }
    if (haystack.includes("buyer")) {
        return "buyer_outreach";
    }
    return null;
}
