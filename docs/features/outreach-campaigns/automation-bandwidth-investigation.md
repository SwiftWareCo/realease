# Outreach Automation Investigation and Plan

Last updated: 2026-03-25

## Context and constraints

This doc captures the investigation into high Convex DB bandwidth from outreach automation and defines the target architecture.

Project constraints:
- There are currently no users.
- Existing outreach data can be deleted — no production migration or backfill required.

Goals:
- Solve the core DB bandwidth problem.
- Keep autonomous call/SMS reliability.
- Implement campaigns as explicit lead collections with deterministic contact rules.

## Root cause diagnosis

### The problem

Current automation (`runOutreachAutomation`, 5-minute cron) repeatedly materializes large historical datasets every poll. The cost scales with historical call volume, not with due work.

Key code paths:
- `convex/outreach/queries.ts:694` — `getCronLeadCandidatesForCampaign`
- `convex/outreach/mutations.ts:570` — `queueCampaignOutreach`
- `convex/crons.ts:42` — 5-minute cron trigger

### Why it's expensive

1. **Unbounded `.collect()` on `outreachCalls`**: Both the candidate query and the queue mutation collect all campaign calls (including large fields: `transcript`, `summary`, `extracted_data`).
2. **N+1 per-lead history scans**: Both functions loop over candidate leads and `.collect()` each lead's full call history.
3. **No explicit enrollment**: Campaign-lead relationships are inferred from call history, requiring full-history scans to derive state.
4. **Polling cadence multiplies cost**: 288 ticks/day at 5-minute intervals amplifies every scan.

### Confirmed bandwidth

- `outreach/mutations.queueCampaignOutreach`: 706.97 MB
- `outreach/queries.getCronLeadCandidatesForCampaign`: 341.01 MB
- Combined: 1,047.98 MB

### Impact estimate

Without fix (1,000 historical calls, 20 candidates, avg 8 calls/lead):
- ~2,510 docs per tick per campaign
- 288 ticks/day → ~722,880 docs/day/campaign
- At ~2 KB avg payload → ~1.38 GB/day/campaign

With fix (state table + scheduled functions):
- ~6-12 docs per due attempt
- 400 due attempts/day → ~2,400-4,800 docs/day
- Order-of-magnitude reduction

## Target architecture

### 1. Explicit campaign lead state table

New table: `outreachCampaignLeadStates`

Fields:
- `campaign_id`
- `lead_id`
- `state` — see state machine below
- `next_action_at_ms` (nullable) — when to evaluate next
- `attempts_in_campaign` — total call attempts made
- `no_answer_or_voicemail_count` — for 3-attempt SMS threshold rule
- `last_attempt_at` (nullable)
- `last_outcome` (nullable)
- `active_call_id` (nullable)
- `last_error` (nullable) — descriptive error for `error` state
- `_creationTime` (automatic)

Indexes:
- `by_campaign_id`
- `by_campaign_id_and_state`
- `by_campaign_id_and_next_action_at_ms`
- `by_next_action_at_ms`
- `by_lead_id`
- `by_campaign_id_and_lead_id`

### 2. Cross-campaign exclusivity

Enforcement: at enrollment time, query `by_lead_id` on the state table. If any non-terminal row exists (`state` not in `done`, `terminal_blocked`), reject enrollment.

No denormalized field on the leads table. The state table is the single source of truth.

Re-enrollment: allowed after a lead reaches `done` or `terminal_blocked` in a previous campaign.

### 3. Event-driven scheduling

Primary call orchestration uses scheduled functions:
- `runAfter(0)` when a lead is immediately eligible and within calling window.
- `runAt(next_action_at_ms)` for cooldown expiry, window-aligned retries, and delayed evaluations.

Cron becomes reconciliation/watchdog only:
- Stale call cleanup (existing 10-minute cadence).
- Due-state reconciliation every 15-30 minutes to recover missed schedules.

### 4. SMS behavior (hardening, not rewrite)

Follow-up SMS is already event-driven via `ctx.scheduler.runAfter` (mutations.ts:1171). No rewrite needed.

Changes:
- Track `no_answer_or_voicemail_count` in state row for 3-attempt threshold.
- Keep/add low-frequency reconciliation for missed SMS edge cases.

### 5. Outcome routing

Outcome routing remains a lead-level concern, orthogonal to campaign state.

On call completion, outcome routing updates the lead record (status, pipeline stages, `do_not_call` flag) as it does today (mutations.ts:1279-1300). The campaign state row only reacts to terminal call outcomes (`do_not_call` → `terminal_blocked`, `wrong_number` → `terminal_blocked`).

## State machine

### States

| State | Meaning |
|-------|---------|
| `eligible` | Lead is enrolled and waiting for next evaluation |
| `queued` | Call record created, awaiting provider dispatch |
| `in_progress` | Call is active with provider |
| `cooldown` | Call completed, waiting for retry cooldown to expire |
| `sms_pending` | SMS threshold met, follow-up SMS scheduled |
| `error` | Permanent dispatch failure, requires user action |
| `terminal_blocked` | Terminal outcome (do_not_call, wrong_number), no further contact |
| `done` | Campaign lifecycle complete for this lead |

### Transitions

```
[manual enroll] → eligible
    precondition: no active (non-terminal) state row for this lead
    set next_action_at_ms = now (if in window) or next window open time

eligible → queued
    trigger: scheduled handler fires, slot available, within calling window
    action: create call record, reserve concurrency slot

eligible → eligible (reschedule)
    trigger: scheduled handler fires but outside calling window
    action: compute next window open time via getNextWindowOpenMs(), runAt()

eligible → done
    trigger: max_attempts reached on re-evaluation

queued → in_progress
    trigger: call_started webhook from provider

queued → eligible (transient retry)
    trigger: dispatch fails with transient error (API rate limit, timeout, 5xx)
    action: set next_action_at_ms = now + backoff, does NOT increment attempts

queued → error
    trigger: dispatch fails with permanent error (invalid phone, out of service, config error)
    action: set last_error with descriptive message, does NOT increment attempts

queued → eligible (stale cleanup)
    trigger: reconciliation cron finds queued row older than 20 min with no provider response

in_progress → cooldown
    trigger: call ended — no_answer, voicemail, callback_requested, connected_not_interested, failed
    action: increment attempts, increment no_answer_or_voicemail_count if applicable,
            set next_action_at_ms = now + cooldown_minutes

in_progress → sms_pending
    trigger: call ended + no_answer_or_voicemail_count >= 3 + SMS enabled on campaign
    action: increment attempts, schedule SMS dispatch via runAfter

in_progress → done
    trigger: call ended — connected_interested (or campaign-defined terminal success)

in_progress → terminal_blocked
    trigger: call ended — do_not_call, wrong_number

in_progress → eligible (stale cleanup)
    trigger: reconciliation finds in_progress row older than 2 hours with no webhook

cooldown → eligible
    trigger: cooldown expired (next_action_at_ms <= now), attempts < max
    action: recompute next_action_at_ms for calling window

cooldown → done
    trigger: cooldown expired but max_attempts reached

sms_pending → cooldown
    trigger: SMS sent or failed, attempts < max_attempts
    action: set next_action_at_ms for next retry window

sms_pending → done
    trigger: SMS sent or failed, max_attempts reached

error → eligible
    trigger: user manually retries

error → done
    trigger: user manually removes from campaign

terminal_blocked → (no automatic transitions)

done → (no automatic transitions — lead can be enrolled in new campaign)
```

### Campaign pause behavior

No `paused` state. When a campaign is paused, scheduled handlers still fire but early-return when `campaign.status !== "active"`. When the campaign resumes, the reconciliation cron picks up stale rows and re-schedules due leads. This is cheaper than bulk state transitions (~1 read per handler vs ~N reads + N writes for bulk mutation).

## Contact criteria (evaluation order)

For each state row, the scheduled handler evaluates in this order:

1. **Campaign status**: skip if campaign is not `active`.
2. **Compliance**: block if `lead.do_not_call` or `lead.sms_opt_out` (for SMS path).
3. **Calling window**: skip and reschedule if outside campaign timezone/day/hour window.
4. **Active call guard**: skip if `active_call_id` is set (call in progress).
5. **Retry policy**: check `max_attempts` and `min_minutes_between_attempts`.
6. **Terminal outcomes**: stop on `do_not_call`, `wrong_number`.
7. **Due-time gate**: run only when `next_action_at_ms <= now`.

## Concurrency and race handling

Risk: multiple scheduled handlers fire near-simultaneously and exceed campaign concurrency limits.

Mitigation: a single mutation gate `tryReserveCallSlotAndQueue`:
- Use `by_campaign_id_and_state` index with `.take(maxConcurrency + 1)` to check active count without unbounded scan.
- If under limit: reserve slot + create call record atomically.
- If at limit: move row to `cooldown` with short retry delay (`runAfter(60_000)`).

This keeps slot enforcement transactional and race-safe within Convex's mutation guarantees.

## Error classification

### Transient errors (auto-retry with backoff)

- Provider API 429 (rate limit)
- Provider API 5xx (server error)
- Network timeout
- Temporary provider unavailability

Behavior: move to `eligible` with `next_action_at_ms = now + backoff`. Does not count as an attempt. Backoff increases with consecutive transient failures.

### Permanent errors (→ `error` state)

- Invalid phone number format
- Phone disconnected / out of service
- Missing provider config (agent ID, phone number ID)
- Unknown/unrecoverable API error

Behavior: move to `error` with descriptive `last_error`. Requires user action to retry or remove.

## New utility: getNextWindowOpenMs

When a lead is eligible but outside the calling window, compute the next valid UTC timestamp.

Inputs: `campaign.timezone`, `campaign.calling_window.start_hour`, `campaign.calling_window.end_hour`, `campaign.calling_window.days_of_week`, `now`.

Logic:
1. Convert `now` to campaign timezone.
2. If today is a valid day and current hour < `start_hour`, return today at `start_hour`.
3. Otherwise, find the next valid day of week and return that day at `start_hour`.
4. Convert back to UTC ms.

Companion to existing `isInsideCallingWindow` (mutations.ts:707-720).

## Suggested handler split

- `internalMutation: evaluateCampaignLeadState` — reads state row + campaign, applies contact criteria, transitions state
- `internalMutation: tryReserveCallSlotAndQueue` — concurrency check + call record creation
- `internalAction: dispatchQueuedCampaignCall` — calls provider API, handles transient/permanent errors
- `internalAction: dispatchFollowUpSms` — existing SMS dispatch (keep as-is)
- `internalMutation: reconcileDueCampaignLeadStates` — watchdog for stale/missed states

## Scheduled function safety rules

1. Schedule internal functions only.
2. All handlers must be idempotent — safe to run more than once for the same state row.
3. All handlers must check campaign status and early-return if not `active` (handles pause without a dedicated state).
4. All handlers must re-read the state row and validate it hasn't already transitioned (handles duplicate/late scheduled runs).
5. Schedule mutation-based state transitions first, then trigger external-call actions.

## User-facing query optimization

Also refactor heavy UI queries that use broad `.collect()` over call history:
- `getCampaignLeadPicker` (queries.ts:85) — replace with state table reads
- `getCampaignCallAttempts` (queries.ts:294) — use bounded/paginated call-history queries

Rule for this project: no unbounded `.collect()` on `outreachCalls` in hot paths. Prefer `.take(n)`, `.paginate()`, or point lookups.

## `.collect()` guidance

`.collect()` is acceptable only for small, bounded result sets (e.g., state rows for a single campaign, which are bounded by lead count).

For `outreachCalls`: always use `.first()`, `.take(n)`, `.paginate()`, or filter with tight index ranges.

## Aggregate component

Deferred. Not required for core fix. Consider later for dashboard counters and analytics.

## Implementation phases

### Phase 1: Schema, state primitives, and data reset

Since there are no users, delete existing outreach runtime data and start fresh.

- Add `outreachCampaignLeadStates` table + indexes to schema.
- Add internal mutations: enroll, unenroll, evaluate eligibility, reserve slot, release on terminal/exit.
- Implement `getNextWindowOpenMs` utility.
- Delete existing outreach test data.

Exit criteria:
- State transitions pass unit tests.
- Enrollment exclusivity check works.
- Clean environment on new model.

### Phase 2: Call orchestration cutover

- Route new call decisions through state table and scheduler.
- Replace old candidate query and queue mutation with state-driven flow.
- Implement `tryReserveCallSlotAndQueue` with `.take(n)` concurrency check.
- Keep existing provider dispatch layer (Retell API calls).

Exit criteria:
- Calls are queued/placed without global campaign-history scans.
- Concurrency limits hold under parallel scheduled runs.
- Transient errors auto-retry, permanent errors go to `error` state.

### Phase 3: SMS hardening

- Track `no_answer_or_voicemail_count` in state row to enforce 3-attempt threshold.
- Keep existing event-driven SMS dispatch.
- Add 15-30 min reconciliation for missed SMS.

Exit criteria:
- 3-attempt threshold behavior preserved.
- Reconciliation catches missed cases.

### Phase 4: UI/query optimization

- Move picker/status queries to state table reads.
- Bound/paginate detailed call history queries.

Exit criteria:
- No unbounded `.collect()` on `outreachCalls` in user-facing hot paths.

### Phase 5: Cron simplification and validation

- Remove 5-minute global call orchestration cron.
- Keep only watchdog/reconciliation crons.
- Measure bandwidth and compare against baseline.

Exit criteria:
- Bandwidth drop validated against 1,047.98 MB baseline.
- Reliability equal or better — no missed due calls in validation window.

## Open decisions

1. **Final state enum and terminal semantics** — resolve in Phase 1 design review. Criterion: all existing skip reasons map to a state or enrollment rejection.
2. **Call-start SLA** — resolve before Phase 2 cutover. Criterion: agreed latency target (e.g., <= 2 minutes from slot availability to provider call).
3. **Reconciliation cadence (15 vs 30 min)** — resolve in Phase 3. Criterion: missed-task recovery meets SLA with acceptable bandwidth.

## Scope guardrails

In scope:
- Explicit campaign lead enrollment/state.
- Call scheduling via runAfter/runAt.
- Enrollment-time exclusivity check.
- SMS threshold tracking.
- Query/path performance cleanup.
- Measured bandwidth and reliability validation.

Out of scope:
- Analytics dashboard overhaul.
- Provider abstraction redesign.
- Non-essential UI redesign.
- Unrelated schema refactors.

## Change log

- 2026-03-25: Initial investigation and plan.
- 2026-03-25: Critique-integrated rewrite with exclusivity, SMS-threshold, rollback, race handling.
- 2026-03-25: Full revision incorporating review session decisions: manual enrollment, enrollment-time exclusivity via state table, handlers-skip pause, auto-retry transient / manual permanent errors, complete state machine, calling window scheduling, error classification, dropped feature flags, consolidated phases.
