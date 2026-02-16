# Outbound Lead Qualification (MVP)

## Feature overview

This feature is end-to-end outbound lead qualification for RealEase using Retell AI voice calls and Twilio SMS follow-up.

MVP goal:
- Automatically place outbound qualification calls to eligible leads
- Capture call outcomes in a normalized format
- Update lead funnel status/stage based on campaign routing rules
- Send follow-up SMS when allowed and configured

Runtime components for this feature:
- Campaign configuration and call/outcome persistence (schema in this document)
- Call initiation logic (scheduler + manual triggers)
- Retell webhook ingestion and outcome mapping
- Lead routing updates and optional Twilio follow-up SMS

As of February 16, 2026, this document is focused on the schema contracts for that feature. Schema is one part of the full implementation.

## Current implementation status (February 16, 2026)

- Retell outbound qualification agent has been created in the Retell dashboard.
- Agent behavior has been tested in `Test LLM` and validated with real call tests.
- Post-call extraction has been configured to support normalized outcomes and CRM updates.
- Outbound Retell phone number has not been purchased/configured yet, so production outbound calling is not ready.
- Webhook processing and cron-based outbound automation are the next backend milestones.

## Retell agent contract (for future development)

The current Retell agent is expected to:
- Start with a short introduction and confirm if it is a good time to talk.
- Qualify lead intent and readiness (buyer/seller/investor, timeline, core context).
- Handle negative/compliance outcomes safely (`do_not_call`, `wrong_number`, no-interest flows).
- Detect voicemail/no-answer style outcomes and close quickly.
- Produce post-call analysis outputs used by backend routing.

Expected post-call analysis payloads used by RealEase:
- Built-in analysis: `call_summary`, `call_successful`, `user_sentiment`
- Custom analysis: `normalized_outcome`, `qualification_notes`, `best_callback_time` (and optional enrichment fields)

Backend should treat `normalized_outcome` as the primary routing signal and use other analysis fields as supporting context.

## Schema scope in this document

This document describes the condensed schema for outbound calling with Retell AI and follow-up SMS with Twilio.

Scope for this MVP:

- Define when and how outbound calls should run (campaign-level config)
- Store each outbound call and its normalized outcome
- Ingest Retell webhook events in a predictable way
- Link outcomes back to leads so funnel stages can be updated by backend logic

As of February 16, 2026, this schema intentionally excludes advanced enrollment state machines and separate transition audit tables.

## Tables overview

### `outreachCampaigns`

Purpose:
- Stores campaign-level rules and provider configuration.

Key fields:
- `name`, `status`
- `retell_agent_id`, `retell_phone_number_id`
- `twilio_messaging_service_sid`
- `timezone`
- `calling_window` (start/end local hour + allowed weekdays)
- `retry_policy`
- `follow_up_sms` defaults
- `outcome_routing` rules (map call outcome to next lead status/pipeline stage + optional SMS behavior)

Primary usage:
- Scheduler reads campaign settings to decide whether to place calls.
- Webhook processor reads `outcome_routing` to move leads through the funnel predictably.

### `outreachCalls`

Purpose:
- One record per outbound call attempt.

Key fields:
- `lead_id`, `campaign_id`
- `retell_call_id`, `retell_conversation_id`
- `call_status` (`queued`, `ringing`, `in_progress`, `completed`, etc.)
- `initiated_at`, `started_at`, `ended_at`, `duration_seconds`
- `transcript`, `summary`, `recording_url`, `extracted_data`
- `outcome` (normalized enum)
- `follow_up_sms_status`, `follow_up_sms_sid`, `follow_up_sms_error`

Primary usage:
- Source of truth for call history and results.
- Input for lead updates (for example `last_call_outcome` and `last_outreach_call_id`).

### `outreachWebhookEvents`

Purpose:
- Stores raw Retell webhook deliveries and processing state.

Key fields:
- `retell_event_id` (idempotency key when present)
- `retell_call_id`, `call_id`, `lead_id`, `campaign_id`
- `event_type`, `event_timestamp`
- `payload` (raw body)
- `processing_status` (`received`, `processed`, `ignored`, `failed`)
- `processing_error`, `received_at`, `processed_at`

Primary usage:
- Idempotency and replay safety.
- Operational reliability and reconciliation with `outreachCalls`.
- Debugging is a use case, but not the only one.

## Lead schema linkage

The `leads` table includes minimal outreach fields:

- `do_not_call`
- `sms_opt_out`
- `last_outreach_call_id`
- `last_call_outcome`

These fields support compliance filtering and quick UI/API reads without scanning full call history.

## Normalized outcomes

Current outcome enum:

- `connected_interested`
- `connected_not_interested`
- `callback_requested`
- `voicemail_left`
- `no_answer`
- `wrong_number`
- `do_not_call`
- `failed`

Retell event payloads should be mapped into this enum inside webhook processing logic.

## Runtime flow (MVP)

1. A campaign is created in `outreachCampaigns` with calling window, retry policy, and outcome routing.
2. Scheduler or manual trigger creates an `outreachCalls` row when placing a call.
3. Retell sends webhook events; each delivery is stored in `outreachWebhookEvents`.
4. Webhook logic updates the related `outreachCalls` row and computes final normalized `outcome`.
5. Backend applies campaign `outcome_routing` and updates lead funnel fields/stages.
6. If needed and allowed, Twilio follow-up SMS is sent and result fields are written on `outreachCalls`.

## Deferred for later phases

These are intentionally out of MVP scope:

- Separate campaign-lead enrollment table/state machine
- Separate lead funnel transition audit table
- Per-attempt retry queue records beyond what `outreachCalls` already stores

If scale or reporting needs increase, those can be added without changing current core contracts.

## Source files

- `convex/outreach/outreach.schema.ts`
- `convex/leads/lead.schema.ts`
- `convex/schema.ts`
