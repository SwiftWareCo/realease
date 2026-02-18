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

This document tracks both schema contracts and runtime implementation status for the MVP.

## Current implementation status (February 17, 2026)

- Retell outbound qualification agent has been created in the Retell dashboard.
- Agent behavior has been tested in `Test LLM` and validated with real call tests.
- Post-call extraction has been configured to support normalized outcomes and CRM updates.
- Manual campaign start and outbound dispatch are implemented (`convex/outreach/actions.ts`, `convex/outreach/mutations.ts`).
- Retell webhook signature verification and ingestion are implemented (`convex/http.ts`).
- Milestone 4 processing is implemented for `call_started`, `call_ended`, and `call_analyzed`:
  - webhook payloads persist to `outreachWebhookEvents`
  - `outreachCalls` status/outcome/transcript/summary fields are updated
  - lead shortcut fields (`last_outreach_call_id`, `last_call_outcome`) are updated
- `outcome_routing` application is implemented for final outcomes and patches lead funnel fields when rule fields are configured.
- Compliance override is implemented: `do_not_call` outcome enforces `leads.do_not_call = true`.
- Stale active-call cleanup guard is implemented (`internal.outreach.mutations.cleanupStaleActiveCalls`).
- Stale cleanup is scheduled in cron every 10 minutes (`convex/crons.ts`) to prevent permanent active-call lockouts.
- Follow-up SMS send logic for outreach calls is not implemented yet.
- Full outreach campaign orchestration cron is not implemented yet (lead selection/dispatch remains manual-triggered).
- Outbound Retell phone number is still a readiness dependency for production calling.

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

## Outcome routing application (exact behavior)

Yes: this means after a call reaches a final normalized outcome, backend logic should move lead funnel fields according to campaign rules.

Target behavior:
1. Resolve final `outcome` for the call from webhook payload (`normalized_outcome` first, fallback mapping).
2. Load `campaign.outcome_routing` and find the matching rule for that `outcome`.
3. Patch lead fields when rule values are present:
   - `leads.status <- next_lead_status`
   - `leads.buyer_pipeline_stage <- next_buyer_pipeline_stage` (when applicable)
   - `leads.seller_pipeline_stage <- next_seller_pipeline_stage` (when applicable)
4. Apply compliance overrides:
   - if outcome is `do_not_call`, enforce `leads.do_not_call = true`
   - do not send SMS when `leads.sms_opt_out = true`
5. Keep lead shortcut updates (`last_outreach_call_id`, `last_call_outcome`) even when no routing rule matches.

If no matching routing rule exists for an outcome, backend should leave funnel stage/status unchanged and still persist the call outcome.

## Stale active-call cleanup guard (required)

Why this matters:
- Eligibility checks treat `queued`, `ringing`, and `in_progress` as active.
- If provider/webhook failure leaves a call in an active state, the lead can be blocked forever from retries.

Required guard behavior:
1. Periodically scan active calls.
2. Auto-close stale calls by timeout policy (for example: long-stuck `queued` / `ringing` / `in_progress`).
3. Set terminal fields (`call_status=failed`, `outcome=failed`, `ended_at`, `error_message`).
4. Preserve auditability (do not delete rows), so operations can reconcile failures.

This guard should run before and during cron rollout, not after.

## SMS channel decision for MVP

Milestone 5 currently assumes Twilio for outreach follow-up because:
- schema already carries `twilio_messaging_service_sid`
- outreach call records already model Twilio delivery artifacts (`follow_up_sms_sid`, error/status fields)
- existing app patterns already include Twilio SMS actions

Using Retell SMS or Retell chat is possible as a future channel decision, but it is a scope expansion for this MVP unless provider contracts, compliance handling, and persistence fields are updated intentionally.

## Cron role (Milestone 6)

Cron should be the automation orchestrator for outreach timing decisions:
- decide when a lead is callable and queue calls using the same manual path logic
- decide when a follow-up SMS is due and allowed, then send via the milestone-5 SMS path

The goal is one shared decision engine reused by manual triggers and cron, not two divergent implementations.

## Runtime flow (MVP)

1. A campaign is created in `outreachCampaigns` with calling window, retry policy, and outcome routing.
2. Scheduler or manual trigger creates an `outreachCalls` row when placing a call.
3. Retell sends webhook events; each delivery is stored in `outreachWebhookEvents`.
4. Webhook logic updates the related `outreachCalls` row and computes final normalized `outcome`.
5. Backend applies campaign `outcome_routing` and updates lead funnel fields/stages (`status`, buyer/seller pipeline stage).
6. If needed and allowed, Twilio follow-up SMS is sent and result fields are written on `outreachCalls`.

## Immediate next steps (February 17, 2026)

1. Implement Milestone 5 SMS rules + Twilio result persistence on `outreachCalls`.
2. Run the full validation matrix and confirm each outcome scenario maps to expected call + lead state.
3. Implement Milestone 6 campaign orchestration cron (lead selection + dispatch reuse of manual path).

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
- `convex/http.ts`
- `convex/outreach/actions.ts`
- `convex/outreach/mutations.ts`
- `convex/outreach/queries.ts`
- `convex/crons.ts`
