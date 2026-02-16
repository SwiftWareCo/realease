# Outbound Lead Qualification MVP Implementation Plan

## Goal

Ship a reliable MVP for outbound lead qualification using Retell voice calls and Twilio SMS follow-up, with campaign-driven routing into lead funnel updates.

## Scope

In scope:
- Manual lead intake for initial operations
- Manual campaign start for smoke testing
- Retell webhook ingestion with idempotency and processing status
- Outcome normalization and lead routing updates
- Optional follow-up SMS on allowed outcomes
- Cron-driven automation after manual flow is proven

Out of scope (for this plan):
- Campaign-lead enrollment state machine
- Separate funnel transition audit table
- Complex retry queue beyond `outreachCalls` records

## MVP Milestones And Acceptance Gates

### Milestone 0: Environment Readiness

Build:
- Retell agent created and published
- Post-call analysis fields configured (`normalized_outcome`, `qualification_notes`, `best_callback_time`)
- Convex env vars configured for Retell/Twilio as needed

Acceptance checklist:
- [ ] Retell agent can complete a test conversation in dashboard
- [ ] `normalized_outcome` selector values match schema enum exactly
- [ ] At least 3 test scenarios validated in Retell (`interested`, `callback`, `do_not_call`)

Exit criteria:
- Team can run deterministic call tests before backend wiring.

### Milestone 1: Manual Lead Intake

Build:
- Use existing manual lead creation flow as the only source for outreach candidates
- Define and enforce locked eligibility criteria for campaign lead selection

Locked eligibility contract:
- `selectable` (shown in campaign lead picker):
  - lead has a non-empty, valid phone number
  - `do_not_call !== true`
  - `status` is `new` or `contacted`
  - no active call exists for the lead (`queued`, `ringing`, `in_progress`)
  - attempts for the lead in this campaign are below `retry_policy.max_attempts`
  - latest campaign outcome is not `do_not_call` and not `wrong_number`
- `callable_now` (checked again when user clicks Start Outreach):
  - campaign `status` is `active`
  - current local campaign time is inside `calling_window`
  - last attempt is older than `retry_policy.min_minutes_between_attempts`
  - still no active call exists for the lead

Acceptance checklist:
- [ ] Leads can be manually created with valid phone numbers
- [ ] `do_not_call` leads are excluded from eligibility
- [ ] Campaign lead picker returns `selectable` + reason codes for skipped leads
- [ ] Small seed batch exists (5-10 leads) for campaign testing

Exit criteria:
- You can produce a stable candidate list without adding new lead-ingestion scope.

### Milestone 2: Manual Campaign Start (No Cron)

Build:
- Create campaign record in `outreachCampaigns`
- Implement or use manual trigger to place outbound calls for selected leads
- Create `outreachCalls` row before provider call placement

Acceptance checklist:
- [ ] Call attempts are persisted with `call_status=queued` then updated as events arrive
- [ ] `retell_call_id` is stored on matching `outreachCalls` rows
- [ ] At least 3 manually triggered calls created and trackable

Exit criteria:
- Call placement path works end-to-end for controlled, low volume tests.

### Milestone 3: Webhook Ingestion (Raw + Idempotent)

Build:
- Add Retell webhook endpoint in `convex/http.ts`
- Verify webhook signature
- Persist every delivery in `outreachWebhookEvents`
- Enforce idempotency using `retell_event_id` when present

Acceptance checklist:
- [ ] Invalid signatures are rejected
- [ ] Valid events are stored with `processing_status=received`
- [ ] Duplicate deliveries do not produce duplicate side effects
- [ ] Endpoint returns 2xx on accepted events fast enough for provider retries

Exit criteria:
- Event capture is reliable and replay-safe.

### Milestone 4: Webhook Processing + Outcome Routing

Build:
- Map provider payload into normalized `outcome` enum
- Update `outreachCalls` fields (`status`, timestamps, transcript/summary, `outcome`)
- Update lead shortcuts (`last_outreach_call_id`, `last_call_outcome`)
- Apply campaign `outcome_routing` to lead status/pipeline stage

Acceptance checklist:
- [ ] Each normalized outcome can be produced by at least one tested scenario
- [ ] `outreachCalls` and `leads` updates are consistent for the same call
- [ ] `processing_status` transitions to `processed` or `failed` with error details

Exit criteria:
- Outcomes are deterministic and funnel updates are automated from webhook data.

### Milestone 5: Follow-Up SMS Integration

Build:
- Send SMS only when allowed by campaign + compliance flags + outcome rules
- Store Twilio results back to `outreachCalls` (`follow_up_sms_status`, sid/error)

Acceptance checklist:
- [ ] `sms_opt_out=true` prevents SMS sends
- [ ] Success and failure states are persisted on `outreachCalls`
- [ ] Message content is traceable to campaign default/custom template path

Exit criteria:
- Follow-up behavior is predictable and observable.

### Milestone 6: Cron Automation

Build:
- Add cron job that selects eligible leads per campaign window/timezone/retry policy
- Cron reuses manual call-placement logic (no duplicate orchestration path)
- Add safety cap per run to control spend and blast radius

Acceptance checklist:
- [ ] Cron only calls leads inside campaign calling window
- [ ] Retry spacing and max attempts are respected
- [ ] Run cap prevents unexpected large batches
- [ ] Manual trigger and cron produce identical `outreachCalls` behavior

Exit criteria:
- Automated calling is safe to run unattended in production windows.

## Validation Matrix (Minimum)

Required scenario set before production rollout:
- [ ] `connected_interested`
- [ ] `connected_not_interested`
- [ ] `callback_requested`
- [ ] `voicemail_left`
- [ ] `no_answer`
- [ ] `wrong_number`
- [ ] `do_not_call`
- [ ] `failed`

For each scenario, verify:
- [ ] webhook event persisted
- [ ] `outreachCalls.outcome` correct
- [ ] lead shortcut fields updated
- [ ] follow-up SMS behavior matches routing/compliance rules

## Definition Of Done (MVP)

MVP is done when:
- [ ] A manually created lead can be called from a campaign
- [ ] Retell webhook drives normalized outcome updates
- [ ] Lead funnel fields update from campaign routing
- [ ] SMS follow-up behavior is recorded and compliant
- [ ] Cron can safely run the same workflow on schedule

## Rollout Order

1. Internal test campaign with team-owned phone numbers
2. Limited production pilot (small daily cap)
3. Full production activation after 1 week of stable webhook + cron behavior
