import type { Doc } from "../_generated/dataModel";
import { getNextWindowOpenMs, isInsideCallingWindow } from "./callingWindow";
import {
    getOutreachCampaignTemplate,
    type OutreachCampaignTemplateDefinition,
} from "./templates";

const TERMINAL_STOP_OUTCOMES: Array<Doc<"outreachCalls">["outcome"]> = [
    "connected_interested",
    "do_not_call",
    "wrong_number",
];

export type CampaignRuntimeSummary = ReturnType<typeof buildCampaignRuntimeSummary>;

export function buildCampaignRuntimeSummary(args: {
    campaign?: Doc<"outreachCampaigns"> | null;
    template: OutreachCampaignTemplateDefinition;
    now?: number;
}) {
    const now = args.now ?? Date.now();
    const campaign = args.campaign ?? null;
    const callingWindow = campaign?.calling_window ?? args.template.callingWindow;
    const retryPolicy = campaign?.retry_policy ?? args.template.retryPolicy;
    const followUpSms = campaign?.follow_up_sms ?? args.template.followUpSms;
    const outcomeRouting = campaign?.outcome_routing ?? args.template.outcomeRouting;
    const timezone =
        campaign?.timezone ??
        process.env.OUTREACH_DEFAULT_TIMEZONE?.trim() ??
        "America/Los_Angeles";
    const canCallNow = isInsideCallingWindow(now, timezone, callingWindow);

    const normalizedOutcomeRouting = outcomeRouting.map((rule) => ({
        outcome: rule.outcome,
        nextLeadStatus: rule.next_lead_status ?? null,
        nextBuyerPipelineStage: rule.next_buyer_pipeline_stage ?? null,
        nextSellerPipelineStage: rule.next_seller_pipeline_stage ?? null,
        sendFollowUpSms: rule.send_follow_up_sms ?? null,
        hasCustomSmsTemplate: Boolean(rule.custom_sms_template?.trim()),
        customSmsTemplate: rule.custom_sms_template ?? null,
        campaignLeadAction: rule.campaign_lead_action ?? null,
    }));

    return {
        templateKey: args.template.key,
        customTemplateId: args.template.customTemplateId ?? null,
        templateLabel: args.template.label,
        templateVersion: campaign?.template_version ?? args.template.version,
        timezone,
        callingWindow,
        maxAttempts: retryPolicy.max_attempts,
        cooldownMinutes: retryPolicy.min_minutes_between_attempts,
        followUpSms: {
            enabled: followUpSms.enabled,
            delayMinutes: followUpSms.delay_minutes,
            defaultTemplate: followUpSms.default_template ?? null,
            outcomes: followUpSms.send_only_on_outcomes ?? [],
        },
        stopOutcomes: Array.from(
            new Set([
                ...TERMINAL_STOP_OUTCOMES,
                ...normalizedOutcomeRouting
                    .filter((rule) => rule.campaignLeadAction === "stop_calling")
                    .map((rule) => rule.outcome),
            ]),
        ),
        outcomeRouting: normalizedOutcomeRouting,
        dispatchMode: canCallNow ? "immediate" : "next_window",
        nextCallableAt: canCallNow
            ? null
            : getNextWindowOpenMs(now, timezone, callingWindow),
    };
}

export function buildCampaignRuntimeSummaryForTemplate(
    templateKey: OutreachCampaignTemplateDefinition["key"],
) {
    return buildCampaignRuntimeSummary({
        template: getOutreachCampaignTemplate(templateKey),
    });
}
