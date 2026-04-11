import type { Doc } from "../_generated/dataModel";
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
        outcomeRouting: [
            {
                outcome: "connected_interested",
                next_lead_status: "qualified",
                next_buyer_pipeline_stage: "showings",
                send_follow_up_sms: false,
            },
            {
                outcome: "connected_not_interested",
                next_lead_status: "contacted",
                send_follow_up_sms: false,
            },
            {
                outcome: "callback_requested",
                next_lead_status: "contacted",
                next_buyer_pipeline_stage: "searching",
                send_follow_up_sms: false,
            },
            {
                outcome: "no_answer",
                next_lead_status: "contacted",
                send_follow_up_sms: true,
            },
            {
                outcome: "voicemail_left",
                next_lead_status: "contacted",
                send_follow_up_sms: true,
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
        outcomeRouting: [
            {
                outcome: "connected_interested",
                next_lead_status: "qualified",
                next_seller_pipeline_stage: "pre_listing",
                send_follow_up_sms: false,
            },
            {
                outcome: "connected_not_interested",
                next_lead_status: "contacted",
                send_follow_up_sms: false,
            },
            {
                outcome: "callback_requested",
                next_lead_status: "contacted",
                next_seller_pipeline_stage: "pre_listing",
                send_follow_up_sms: false,
            },
            {
                outcome: "no_answer",
                next_lead_status: "contacted",
                send_follow_up_sms: true,
            },
            {
                outcome: "voicemail_left",
                next_lead_status: "contacted",
                send_follow_up_sms: true,
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
