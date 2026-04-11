import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";

export const OUTREACH_CAMPAIGN_TEMPLATE_KEYS = [
    "buyer_outreach",
    "seller_outreach",
] as const;

export type OutreachCampaignTemplateKey =
    (typeof OUTREACH_CAMPAIGN_TEMPLATE_KEYS)[number];

export const outreachCampaignTemplateKeyValidator = v.union(
    v.literal("buyer_outreach"),
    v.literal("seller_outreach"),
);

export const outreachTemplateLeadTypeValidator = v.union(
    v.literal("buyer"),
    v.literal("seller"),
);

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
    callingWindow: Doc<"outreachCampaigns">["calling_window"];
    retryPolicy: Doc<"outreachCampaigns">["retry_policy"];
    followUpSms: NonNullable<Doc<"outreachCampaigns">["follow_up_sms"]>;
    outcomeRouting: NonNullable<Doc<"outreachCampaigns">["outcome_routing"]>;
    agentInstructions: OutreachAgentInstructions;
    customTemplateId?: Id<"outreachCampaignTemplates"> | null;
};

const DEFAULT_CALLING_WINDOW: Doc<"outreachCampaigns">["calling_window"] = {
    start_hour_local: 9,
    end_hour_local: 18,
    allowed_weekdays: [1, 2, 3, 4, 5],
};

const DEFAULT_RETRY_POLICY: Doc<"outreachCampaigns">["retry_policy"] = {
    max_attempts: 3,
    min_minutes_between_attempts: 60,
};

const BUYER_AGENT_INSTRUCTIONS: OutreachAgentInstructions = {
    call_objective:
        "Qualify whether the lead is actively looking to buy, understand timeline and budget, and identify whether a realtor should follow up.",
    opening_line:
        "Hi {{lead_name}}, this is {{agent_name}} calling about your home search. Do you have a minute?",
    tone: "Professional, concise, warm, and respectful of the lead's time.",
    qualification_questions: [
        "Are you actively looking to buy a home right now?",
        "What timeline are you hoping for?",
        "What area and price range are you considering?",
        "Are you already working with an agent?",
    ],
    objection_handling_notes:
        "If the lead is busy, ask for a better time. If they are not interested, acknowledge it and end politely. Do not pressure the lead.",
    voicemail_guidance:
        "Leave a brief voicemail with the campaign name and invite the lead to call back or reply by SMS.",
    compliance_disclosure:
        "If the lead asks not to be contacted, acknowledge and mark the outcome as do_not_call.",
};

const SELLER_AGENT_INSTRUCTIONS: OutreachAgentInstructions = {
    call_objective:
        "Qualify whether the lead is considering selling, understand timing and property context, and identify whether a realtor should follow up.",
    opening_line:
        "Hi {{lead_name}}, this is {{agent_name}} calling about your property plans. Do you have a minute?",
    tone: "Helpful, direct, calm, and consultative.",
    qualification_questions: [
        "Are you considering selling your property?",
        "What timeline are you thinking about?",
        "Have you had a recent valuation or market estimate?",
        "Are you already working with an agent?",
    ],
    objection_handling_notes:
        "If the lead is uncertain, offer a low-pressure follow-up with market information. If they are not interested, end politely.",
    voicemail_guidance:
        "Leave a brief voicemail offering a property-value or market follow-up and invite the lead to call back or reply by SMS.",
    compliance_disclosure:
        "If the lead asks not to be contacted, acknowledge and mark the outcome as do_not_call.",
};

export const OUTREACH_CAMPAIGN_TEMPLATES: Record<
    OutreachCampaignTemplateKey,
    OutreachCampaignTemplateDefinition
> = {
    buyer_outreach: {
        key: "buyer_outreach",
        version: 1,
        label: "Buyer Outreach",
        shortLabel: "Buyer",
        description:
            "Qualify buyer leads with a standard weekday call cadence and buyer-focused follow-up messaging.",
        recommendedLeadType: "buyer",
        defaultNamePrefix: "Buyer Outreach",
        callingWindow: DEFAULT_CALLING_WINDOW,
        retryPolicy: DEFAULT_RETRY_POLICY,
        followUpSms: {
            enabled: true,
            delay_minutes: 3,
            default_template:
                "Hi {{lead_name}}, this is {{campaign_name}}. Sorry we missed you. Reply with a good time to talk, or STOP to opt out.",
            send_only_on_outcomes: ["no_answer", "voicemail_left"],
        },
        agentInstructions: BUYER_AGENT_INSTRUCTIONS,
        outcomeRouting: [
            {
                outcome: "connected_interested",
                next_lead_status: "qualified",
                next_buyer_pipeline_stage: "showings",
                send_follow_up_sms: false,
                campaign_lead_action: "stop_calling",
            },
            {
                outcome: "connected_not_interested",
                next_lead_status: "contacted",
                send_follow_up_sms: false,
                campaign_lead_action: "stop_calling",
            },
            {
                outcome: "callback_requested",
                next_lead_status: "contacted",
                next_buyer_pipeline_stage: "searching",
                send_follow_up_sms: false,
                campaign_lead_action: "pause_for_realtor",
            },
            {
                outcome: "no_answer",
                next_lead_status: "contacted",
                send_follow_up_sms: true,
                campaign_lead_action: "continue",
            },
            {
                outcome: "voicemail_left",
                next_lead_status: "contacted",
                send_follow_up_sms: true,
                campaign_lead_action: "continue",
            },
            {
                outcome: "wrong_number",
                send_follow_up_sms: false,
            },
            {
                outcome: "do_not_call",
                send_follow_up_sms: false,
            },
        ],
    },
    seller_outreach: {
        key: "seller_outreach",
        version: 1,
        label: "Seller Outreach",
        shortLabel: "Seller",
        description:
            "Qualify seller leads with the same operating guardrails and seller-oriented routing defaults.",
        recommendedLeadType: "seller",
        defaultNamePrefix: "Seller Outreach",
        callingWindow: DEFAULT_CALLING_WINDOW,
        retryPolicy: DEFAULT_RETRY_POLICY,
        followUpSms: {
            enabled: true,
            delay_minutes: 3,
            default_template:
                "Hi {{lead_name}}, this is {{campaign_name}}. We missed you and can follow up when it works for you. Reply STOP to opt out.",
            send_only_on_outcomes: ["no_answer", "voicemail_left"],
        },
        agentInstructions: SELLER_AGENT_INSTRUCTIONS,
        outcomeRouting: [
            {
                outcome: "connected_interested",
                next_lead_status: "qualified",
                next_seller_pipeline_stage: "pre_listing",
                send_follow_up_sms: false,
                campaign_lead_action: "stop_calling",
            },
            {
                outcome: "connected_not_interested",
                next_lead_status: "contacted",
                send_follow_up_sms: false,
                campaign_lead_action: "stop_calling",
            },
            {
                outcome: "callback_requested",
                next_lead_status: "contacted",
                next_seller_pipeline_stage: "pre_listing",
                send_follow_up_sms: false,
                campaign_lead_action: "pause_for_realtor",
            },
            {
                outcome: "no_answer",
                next_lead_status: "contacted",
                send_follow_up_sms: true,
                campaign_lead_action: "continue",
            },
            {
                outcome: "voicemail_left",
                next_lead_status: "contacted",
                send_follow_up_sms: true,
                campaign_lead_action: "continue",
            },
            {
                outcome: "wrong_number",
                send_follow_up_sms: false,
            },
            {
                outcome: "do_not_call",
                send_follow_up_sms: false,
            },
        ],
    },
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

export function buildTemplateDefinitionFromCustomTemplate(
    template: Doc<"outreachCampaignTemplates">,
): OutreachCampaignTemplateDefinition {
    return {
        key: template.base_template_key,
        version: 1,
        label: template.label,
        shortLabel: template.short_label,
        description: template.description,
        recommendedLeadType: template.recommended_lead_type,
        defaultNamePrefix: template.default_name_prefix,
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
    if (haystack.includes("seller")) {
        return "seller_outreach";
    }
    if (haystack.includes("buyer")) {
        return "buyer_outreach";
    }
    return null;
}
