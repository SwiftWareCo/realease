import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
    outreachAgentInstructionsValidator,
    outreachCampaignTemplateKeyValidator,
    outreachTemplateLeadTypeValidator,
} from "./templates";

const weekdaySchema = v.union(
    v.literal(0),
    v.literal(1),
    v.literal(2),
    v.literal(3),
    v.literal(4),
    v.literal(5),
    v.literal(6),
);

const leadStatusSchema = v.union(
    v.literal("new"),
    v.literal("contacted"),
    v.literal("qualified"),
);

const buyerPipelineStageSchema = v.union(
    v.literal("searching"),
    v.literal("showings"),
    v.literal("offer_out"),
    v.literal("under_contract"),
    v.literal("closed"),
);

const sellerPipelineStageSchema = v.union(
    v.literal("pre_listing"),
    v.literal("on_market"),
    v.literal("offer_in"),
    v.literal("under_contract"),
    v.literal("sold"),
);

const campaignLeadOutcomeActionSchema = v.union(
    v.literal("continue"),
    v.literal("stop_calling"),
    v.literal("pause_for_realtor"),
);

export const outreachCampaignStatusSchema = v.union(
    v.literal("draft"),
    v.literal("active"),
    v.literal("paused"),
    v.literal("completed"),
    v.literal("archived"),
);

export const outreachCallStatusSchema = v.union(
    v.literal("queued"),
    v.literal("ringing"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("canceled"),
);

export const outreachCallOutcomeSchema = v.union(
    v.literal("connected_interested"),
    v.literal("connected_not_interested"),
    v.literal("callback_requested"),
    v.literal("voicemail_left"),
    v.literal("no_answer"),
    v.literal("wrong_number"),
    v.literal("do_not_call"),
    v.literal("failed"),
);

const followUpSmsStatusSchema = v.union(
    v.literal("not_needed"),
    v.literal("pending"),
    v.literal("sent"),
    v.literal("failed"),
    v.literal("opted_out"),
);

const outreachSmsDirectionSchema = v.union(
    v.literal("inbound"),
    v.literal("outbound"),
);

const outreachSmsStatusSchema = v.union(
    v.literal("queued"),
    v.literal("accepted"),
    v.literal("sending"),
    v.literal("sent"),
    v.literal("delivered"),
    v.literal("undelivered"),
    v.literal("failed"),
    v.literal("receiving"),
    v.literal("received"),
    v.literal("read"),
    v.literal("canceled"),
    v.literal("unknown"),
);

export const outreachCampaignsTable = defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: outreachCampaignStatusSchema,
    template_key: v.optional(outreachCampaignTemplateKeyValidator),
    custom_template_id: v.optional(v.id("outreachCampaignTemplates")),
    template_version: v.optional(v.number()),
    agent_instructions: v.optional(outreachAgentInstructionsValidator),
    retell_agent_id: v.string(),
    retell_phone_number_id: v.optional(v.string()),
    twilio_messaging_service_sid: v.optional(v.string()),
    timezone: v.string(), // IANA timezone, e.g. "America/Los_Angeles"
    calling_window: v.object({
        start_hour_local: v.number(), // 0-23
        end_hour_local: v.number(), // 0-23
        allowed_weekdays: v.array(weekdaySchema), // 0=Sun ... 6=Sat
    }),
    retry_policy: v.object({
        max_attempts: v.number(),
        min_minutes_between_attempts: v.number(),
    }),
    follow_up_sms: v.optional(
        v.object({
            enabled: v.boolean(),
            delay_minutes: v.number(),
            default_template: v.optional(v.string()),
            send_only_on_outcomes: v.optional(
                v.array(outreachCallOutcomeSchema),
            ),
        }),
    ),
    outcome_routing: v.optional(
        v.array(
            v.object({
                outcome: outreachCallOutcomeSchema,
                next_lead_status: v.optional(leadStatusSchema),
                next_buyer_pipeline_stage: v.optional(buyerPipelineStageSchema),
                next_seller_pipeline_stage: v.optional(
                    sellerPipelineStageSchema,
                ),
                send_follow_up_sms: v.optional(v.boolean()),
                custom_sms_template: v.optional(v.string()),
                campaign_lead_action: v.optional(
                    campaignLeadOutcomeActionSchema,
                ),
            }),
        ),
    ),
    created_by_user_id: v.optional(v.id("users")),
    created_at: v.number(),
    updated_at: v.number(),
})
    .index("by_status", ["status"])
    .index("by_retell_agent_id", ["retell_agent_id"])
    .index("by_created_by_user_id", ["created_by_user_id"])
    .index("by_custom_template_id", ["custom_template_id"]);

export const outreachCampaignTemplatesTable = defineTable({
    owner_user_id: v.id("users"),
    base_template_key: outreachCampaignTemplateKeyValidator,
    label: v.string(),
    short_label: v.string(),
    description: v.string(),
    recommended_lead_type: outreachTemplateLeadTypeValidator,
    default_name_prefix: v.string(),
    calling_window: v.object({
        start_hour_local: v.number(),
        end_hour_local: v.number(),
        allowed_weekdays: v.array(weekdaySchema),
    }),
    retry_policy: v.object({
        max_attempts: v.number(),
        min_minutes_between_attempts: v.number(),
    }),
    follow_up_sms: v.object({
        enabled: v.boolean(),
        delay_minutes: v.number(),
        default_template: v.optional(v.string()),
        send_only_on_outcomes: v.optional(v.array(outreachCallOutcomeSchema)),
    }),
    outcome_routing: v.array(
        v.object({
            outcome: outreachCallOutcomeSchema,
            next_lead_status: v.optional(leadStatusSchema),
            next_buyer_pipeline_stage: v.optional(buyerPipelineStageSchema),
            next_seller_pipeline_stage: v.optional(sellerPipelineStageSchema),
            send_follow_up_sms: v.optional(v.boolean()),
            custom_sms_template: v.optional(v.string()),
            campaign_lead_action: v.optional(campaignLeadOutcomeActionSchema),
        }),
    ),
    agent_instructions: outreachAgentInstructionsValidator,
    created_at: v.number(),
    updated_at: v.number(),
})
    .index("by_owner_user_id", ["owner_user_id"])
    .index("by_owner_user_id_and_base_template_key", [
        "owner_user_id",
        "base_template_key",
    ]);

export const outreachCallsTable = defineTable({
    lead_id: v.id("leads"),
    campaign_id: v.optional(v.id("outreachCampaigns")),
    retell_call_id: v.optional(v.string()),
    retell_conversation_id: v.optional(v.string()),
    call_status: outreachCallStatusSchema,
    call_direction: v.literal("outbound"),
    initiated_at: v.number(),
    started_at: v.optional(v.number()),
    ended_at: v.optional(v.number()),
    duration_seconds: v.optional(v.number()),
    recording_url: v.optional(v.string()),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    extracted_data: v.optional(v.any()),
    outcome: v.optional(outreachCallOutcomeSchema),
    outcome_reason: v.optional(v.string()),
    follow_up_sms_status: v.optional(followUpSmsStatusSchema),
    follow_up_sms_sent_at: v.optional(v.number()),
    follow_up_sms_sid: v.optional(v.string()),
    follow_up_sms_error: v.optional(v.string()),
    error_message: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
})
    .index("by_lead_id", ["lead_id"])
    .index("by_campaign_id", ["campaign_id"])
    .index("by_retell_call_id", ["retell_call_id"])
    .index("by_call_status", ["call_status"])
    .index("by_follow_up_sms_status", ["follow_up_sms_status"])
    .index("by_outcome", ["outcome"])
    .index("by_campaign_id_and_initiated_at", ["campaign_id", "initiated_at"])
    .index("by_campaign_id_and_lead_id_and_initiated_at", [
        "campaign_id",
        "lead_id",
        "initiated_at",
    ]);

export const outreachWebhookEventsTable = defineTable({
    call_id: v.optional(v.id("outreachCalls")),
    campaign_id: v.optional(v.id("outreachCampaigns")),
    lead_id: v.optional(v.id("leads")),
    retell_call_id: v.optional(v.string()),
    retell_event_id: v.optional(v.string()), // use for idempotency when available
    event_type: v.string(),
    event_timestamp: v.optional(v.number()),
    payload: v.any(),
    processing_status: v.union(
        v.literal("received"),
        v.literal("processed"),
        v.literal("ignored"),
        v.literal("failed"),
    ),
    processing_error: v.optional(v.string()),
    received_at: v.number(),
    processed_at: v.optional(v.number()),
})
    .index("by_call_id", ["call_id"])
    .index("by_campaign_id", ["campaign_id"])
    .index("by_lead_id", ["lead_id"])
    .index("by_retell_call_id", ["retell_call_id"])
    .index("by_retell_event_id", ["retell_event_id"])
    .index("by_event_type", ["event_type"])
    .index("by_processing_status", ["processing_status"])
    .index("by_received_at", ["received_at"]);

export const outreachSmsMessagesTable = defineTable({
    lead_id: v.optional(v.id("leads")),
    campaign_id: v.optional(v.id("outreachCampaigns")),
    call_id: v.optional(v.id("outreachCalls")),
    provider: v.literal("twilio"),
    provider_message_sid: v.optional(v.string()),
    provider_account_sid: v.optional(v.string()),
    provider_messaging_service_sid: v.optional(v.string()),
    direction: outreachSmsDirectionSchema,
    body: v.string(),
    from_number: v.string(),
    to_number: v.string(),
    status: outreachSmsStatusSchema,
    error_code: v.optional(v.string()),
    error_message: v.optional(v.string()),
    sent_at: v.optional(v.number()),
    received_at: v.optional(v.number()),
    raw_payload: v.optional(v.any()),
    created_at: v.number(),
    updated_at: v.number(),
})
    .index("by_lead_id", ["lead_id"])
    .index("by_campaign_id", ["campaign_id"])
    .index("by_call_id", ["call_id"])
    .index("by_provider_message_sid", ["provider_message_sid"])
    .index("by_lead_id_and_created_at", ["lead_id", "created_at"])
    .index("by_campaign_id_and_lead_id_and_created_at", [
        "campaign_id",
        "lead_id",
        "created_at",
    ]);

export const campaignLeadStateSchema = v.union(
    v.literal("eligible"),
    v.literal("queued"),
    v.literal("in_progress"),
    v.literal("cooldown"),
    v.literal("sms_pending"),
    v.literal("paused_for_realtor"),
    v.literal("error"),
    v.literal("terminal_blocked"),
    v.literal("done"),
);

export const outreachCampaignLeadStatesTable = defineTable({
    campaign_id: v.id("outreachCampaigns"),
    lead_id: v.id("leads"),
    state: campaignLeadStateSchema,
    next_action_at_ms: v.optional(v.number()),
    attempts_in_campaign: v.number(),
    no_answer_or_voicemail_count: v.number(),
    last_attempt_at: v.optional(v.number()),
    last_outcome: v.optional(outreachCallOutcomeSchema),
    active_call_id: v.optional(v.id("outreachCalls")),
    last_error: v.optional(v.string()),
})
    .index("by_campaign_id", ["campaign_id"])
    .index("by_campaign_id_and_state", ["campaign_id", "state"])
    .index("by_campaign_id_and_next_action_at_ms", [
        "campaign_id",
        "next_action_at_ms",
    ])
    .index("by_next_action_at_ms", ["next_action_at_ms"])
    .index("by_lead_id", ["lead_id"])
    .index("by_campaign_id_and_lead_id", ["campaign_id", "lead_id"]);
