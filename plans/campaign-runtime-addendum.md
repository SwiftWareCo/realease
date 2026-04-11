# Outreach Campaign Runtime Findings And Plan Addendum

## Purpose
This document extends [plan.md](/home/braille/projects/RealEase/plans/plan.md) with:

1. Current-state findings from the implemented MVP.
2. A completion audit against the original plan.
3. A Phase 2 planning addendum for runtime visibility, post-outcome editing, and state explainability.

This is planning only. It does not change implementation scope by itself.

## Current Runtime Model
Based on the current implementation, a campaign now consists of:

1. A selected lead cohort.
2. Template metadata:
   - `template_key`
   - `template_version`
3. Operational settings stored on the campaign:
   - `calling_window`
   - `retry_policy`
   - `follow_up_sms`
   - `outcome_routing`
4. Per-lead runtime state stored in `outreachCampaignLeadStates`.

The current per-lead state machine includes:

1. `eligible`
2. `queued`
3. `in_progress`
4. `cooldown`
5. `sms_pending`
6. `error`
7. `terminal_blocked`
8. `done`

Retell call outcomes then drive:

1. `outreachCalls` updates
2. lead updates such as `status`, pipeline stage, `do_not_call`
3. campaign lead-state transitions
4. follow-up SMS scheduling decisions

## Key Findings

### 1. Campaign runtime behavior is only partially visible in the UI
The launch flow now handles template selection, lead selection, validation, and confirmation well.

What is still weak is runtime explainability. The user cannot clearly see, before launch:

1. how many attempts will be made
2. how much time will pass between attempts
3. which outcomes stop further outreach
4. which outcomes trigger follow-up SMS
5. which outcomes update lead status or pipeline stage
6. when calls will start if outside the active window

### 2. Post-outcome behavior exists in backend config, but is not a first-class editing surface
The product already stores `outcome_routing` and `follow_up_sms` on campaigns.

That means the system already has a configurable model for:

1. lead status changes
2. buyer/seller pipeline stage changes
3. follow-up SMS policy
4. some outcome-specific overrides

But that behavior is still mostly hidden behind backend implementation rather than surfaced as an explicit, safe campaign logic editor.

### 3. Current campaign settings are too narrow for the actual runtime model
The current campaign settings form exposes:

1. name and description
2. status
3. calling window
4. max attempts
5. cooldown
6. follow-up SMS enabled
7. default follow-up SMS template

It does not expose:

1. per-outcome routing
2. per-outcome SMS decisions
3. terminal outcome handling rules
4. a readable summary of how the runtime state machine will behave

### 4. Latest outcome display has improved but is not fully normalized across all surfaces
The campaign detail route now prefers the latest campaign call record for lead-level `latestOutcome`, `latestCallStatus`, and `latestInitiatedAt`.

However, at least one review/eligibility path still uses `outreachCampaignLeadStates.last_outcome` when determining a lead's latest campaign outcome.

Implication:

1. the main campaign run page is closer to correct
2. some enrollment or add-leads flows may still show stale outcome data
3. "latest campaign outcome" is not yet sourced from one normalized backend helper

### 5. The runtime state machine is not explained to the user
Today the backend meaningfully distinguishes:

1. queued now
2. in progress
3. cooling down before retry
4. waiting on SMS step
5. terminally blocked
6. done

That distinction matters operationally, but users currently do not get enough explanation about:

1. why a lead is in a given state
2. what happens next
3. what rule caused the next transition

## Audit Against The Original Plan

### Completed
The following goals from [plan.md](/home/braille/projects/RealEase/plans/plan.md) are effectively complete:

1. one obvious global `Start Outreach` CTA
2. buyer vs seller templates are selectable at start
3. lead-first wizard flow
4. explicit final confirmation before enrollment
5. structured review step with `eligible`, `conflict`, and `ineligible`
6. inline creation of a new campaign from template defaults
7. management-first campaign table actions
8. single-campaign membership enforced at mutation level
9. campaign detail route remains the execution hub
10. `Add Leads` reuses the same enrollment validation flow
11. template metadata is strongly typed and versioned

### Partially Completed
These areas are only partially complete:

1. outcome correctness
   - shared outcome labels exist
   - main campaign detail query prefers latest call rows
   - some other code paths still rely on state-row `last_outcome`
2. editable campaign logic
   - safe timing fields are editable
   - post-outcome routing is stored but not meaningfully editable in UI
3. user understanding of campaign operation
   - launch flow validates enrollment well
   - launch flow does not yet explain runtime behavior well

### Still Missing Relative To Product Intent
These items were implied by the broader product direction, but are not yet truly delivered:

1. strong runtime transparency during campaign setup
2. first-class editing of what happens after specific outcomes or states
3. a normalized source of truth for "latest outcome"
4. user-facing explanations for lead state transitions

## Planning Decision
Keep the existing MVP launch flow from [plan.md](/home/braille/projects/RealEase/plans/plan.md), and add a second planning layer focused on campaign runtime clarity and safe automation editing.

This should be treated as **Phase 2: Runtime Visibility And Post-Outcome Logic**.

## Implementation Update
The first two Phase 2 implementation slices are complete:

1. A shared latest-call resolver now reads latest campaign call snapshots from `outreachCalls`.
2. `outreachCalls` now has a `by_campaign_id_and_lead_id_and_initiated_at` index for efficient per-lead latest-call lookup within a campaign.
3. The enrollment eligibility/review path now uses latest campaign call outcome data instead of `outreachCampaignLeadStates.last_outcome` for user-facing latest outcome display and terminal-outcome eligibility checks.
4. Campaign detail lead rows now use the same latest-call sourcing and no longer fall back to state-row `last_outcome` for `latestOutcome`.
5. Backend queries now return a normalized `runtimeSummary` for templates, campaign picker rows, enrollment review targets, lead picker payloads, and campaign detail payloads.
6. Read-only runtime summary UI is now shown in template selection, inline campaign selection/create, final review, standalone campaign create, campaign settings, and campaign detail.
7. Campaign detail now embeds compact runtime rules in the campaign header box with the campaign name, status, summary counts, and `Add Leads` action.
8. Campaign create and edit dialogs now use wider, scrollable layouts to prevent runtime summary and rule editor overflow.
9. Campaign settings now exposes a guarded post-outcome rule editor for safe routing fields:
   - next lead status
   - next buyer pipeline stage
   - next seller pipeline stage
   - supported follow-up SMS decisions
   - optional custom SMS template
10. Outcome routing now separates lead-management updates from internal campaign behavior through `campaign_lead_action`:
   - `continue`
   - `stop_calling`
   - `pause_for_realtor`
11. Terminal outcomes such as `do_not_call` and `wrong_number` are guarded, hidden from the edit UI, and sanitized server-side so they stop outreach and cannot re-enable SMS.
12. Campaign detail lead rows now include query-level state explainability fields:
   - `campaignState`
   - `stateReason`
   - `nextActionAt`
   - `nextActionLabel`
   - `stopReason`
13. Campaign creation now allows editing campaign name, description, calling window, retry policy, and follow-up SMS before creating the campaign. Timezone remains backend/default configuration rather than a visible user control.

New finding:

1. `outreachCampaignLeadStates.last_outcome` is still useful as scheduler/runtime state, especially while processing corrections and retries, but should remain non-authoritative for user-facing "latest outcome" display.
2. Retell currently supplies call result/outcome data. Buyer/seller pipeline stage changes are chosen by RealEase campaign outcome rules, not directly by the Retell agent.
3. `pause_for_realtor` currently pauses the lead inside the campaign and surfaces the state in campaign detail. A separate notification/task system would be needed for real push/email/in-app realtor notifications.

Still pending:

1. deeper UX polish for the post-outcome editor after real usage
2. broader campaign analytics beyond per-lead state explainability
3. a safe Retell agent-instruction editor for campaign templates
4. advanced workflow branching or free-form scripting, which remains intentionally out of scope

## Retell Agent Behavior Editing Addendum

Campaign outcome routing and Retell agent behavior should stay separate in the product model:

1. Retell agent behavior controls what the voice agent says, asks, and how it handles the conversation.
2. RealEase campaign outcome rules control what happens after Retell returns a result, such as lead status changes, pipeline stage changes, campaign pausing, retries, and follow-up SMS decisions.

Recommended approach:

1. Do not expose raw Retell agent configuration or arbitrary prompt scripting in the campaign create flow.
2. Add a later guarded "Agent Instructions" template editor for safe campaign-copy fields:
   - call objective
   - opening line
   - tone/persona
   - required qualification questions
   - objection-handling notes
   - voicemail guidance
   - compliance/disclosure copy, if required
3. Store those fields as versioned RealEase template metadata first, then compile them into Retell agent variables or Retell agent versions.
4. Require a preview/review step before publishing a changed template so existing running campaigns are not silently changed.
5. Keep unsafe runtime controls backend-owned:
   - Retell agent ID selection
   - phone number assignment
   - outcome enum contract
   - webhook handling
   - scheduler behavior

This should be a separate Phase 3-style slice unless the product requires user-editable calling scripts before more runtime analytics work.

## Phase 2 Goals

### Goal 1. Make campaign runtime behavior visible before launch
Users should understand how the campaign operates before they confirm enrollment.

### Goal 2. Expose safe post-outcome behavior as a first-class editing surface
Users should be able to control what happens after supported outcomes without editing unsafe backend behavior.

### Goal 3. Make current lead state explainable on the campaign detail route
Users should be able to understand why a lead is waiting, blocked, or done.

### Goal 4. Normalize "latest outcome" sourcing
User-facing latest outcome fields should use the latest campaign call record rather than stale state-row values.

## Phase 2 Scope

### Frontend
1. Add a read-only "How This Campaign Runs" panel to launch/create/review flows.
2. Add a read-only runtime summary block to campaign settings and campaign detail.
3. Add a safe post-outcome logic editor for campaign outcome rules.
4. Add state explainability UI on campaign detail lead views.

### Backend
1. Introduce a normalized helper for latest campaign call snapshot per lead.
2. Update all user-facing latest-outcome reads to use that helper.
3. Return runtime summary data directly from queries used by launch/review/settings/detail UI.
4. Support validated updates to safe per-outcome routing fields.

### Copy
1. Use clear operational language:
   - "attempts"
   - "cooldown"
   - "calling window"
   - "stops outreach"
   - "sends follow-up SMS"
   - "next action"
2. Avoid abstract state-machine terminology unless needed for debugging.

## Phase 2 UX Requirements

### A. "How This Campaign Runs" summary
Add a compact but explicit summary in the campaign start flow and settings.

The summary should show:

1. template label and version
2. calling days
3. calling hours in 12-hour format
4. maximum attempts
5. minutes between attempts
6. which outcomes trigger follow-up SMS
7. which outcomes stop further outreach
8. which outcomes update lead stage/status
9. whether selected leads will start now or queue for the next valid window

Timezone should not be shown or editable in the standard campaign UI. Keep it as backend/default configuration unless a dedicated advanced operations surface is introduced later.

This should appear in:

1. template selection step
2. campaign selection/create step
3. final review step
4. campaign settings page

### B. Post-outcome logic editor
Expose campaign outcome rules as "What happens after each result."

Editable safe fields per outcome:

1. next lead status
2. next buyer pipeline stage
3. next seller pipeline stage
4. send follow-up SMS
5. optional custom SMS template

Rules:

1. editing must stay within validated fields already supported by schema
2. unsafe or structurally sensitive runtime behavior should remain backend-controlled
3. terminal outcomes such as `do_not_call` and `wrong_number` should remain strongly guarded

### C. State explainability on campaign detail
For each lead shown on the campaign detail route, surface:

1. current campaign state
2. last call status
3. last call outcome
4. last attempt time
5. next action time, if any
6. reason for current state
7. what will happen next

Example user-facing explanations:

1. "Cooling down until 11:00 AM local before retry attempt 2 of 3."
2. "Blocked because latest outcome was Do Not Call."
3. "Waiting to send follow-up SMS after final no-answer sequence."
4. "Done because maximum attempts were reached."

## Backend Design Recommendations

### 1. Separate display sourcing from scheduling state
Keep `outreachCampaignLeadStates` as an operational scheduling table.

Do not treat it as the primary display source for:

1. latest call status
2. latest outcome
3. latest initiated timestamp

Instead:

1. compute those from the latest campaign `outreachCalls` row for that lead
2. keep state-row fields for scheduler/runtime convenience only

### 2. Introduce one shared latest-call resolver
Create a shared backend helper that returns the latest campaign call snapshot per lead.

This helper should power:

1. campaign detail sidebar
2. `Last Outcome` and `Last Status` UI
3. add-leads review
4. lead eligibility review
5. any future analytics summary that says "latest"

### 3. Keep runtime logic editable only where safe
Editable fields should remain constrained to:

1. cadence
2. calling window
3. follow-up SMS policy
4. post-outcome routing fields already represented in schema

Do not expose arbitrary workflow scripting in this phase.

### 4. Return explainability metadata from queries
The detail route should not reverse-engineer runtime meaning in the UI.

Queries should return explicit fields such as:

1. `stateReason`
2. `nextActionAt`
3. `nextActionLabel`
4. `stopReason`
5. `runtimeSummary`

## Proposed Implementation Order

### Step 1. Normalize latest-outcome sourcing
Fix remaining stale-outcome reads first.

Status: completed for the known user-facing review/add-leads/detail latest outcome paths.

Why first:

1. avoids building more UI on inconsistent data
2. directly affects trust in campaign behavior
3. closes remaining add-leads/latest-outcome inconsistencies

### Step 2. Add read-only runtime summary surfaces
Implement visibility before editing.

Status: completed for launch template selection, inline campaign selection/create, final review, standalone create, settings, and detail surfaces.

Why second:

1. faster to ship
2. improves trust immediately
3. reveals whether users still need deeper editing controls

### Step 3. Add safe post-outcome editor
Expose outcome routing with strong validation and guardrails.

Status: completed for safe schema-backed routing fields. Terminal outcomes are guarded in UI and sanitized server-side.

Why third:

1. builds on the now-visible runtime model
2. prevents users from editing logic they cannot yet understand

### Step 4. Add state explainability on the campaign detail route
Show why each lead is where it is and what will happen next.

Status: completed for campaign detail lead rows and selected-lead detail header.

Why fourth:

1. completes the feedback loop after editing and launch
2. makes campaign operation auditable from the execution hub

## Suggested Acceptance Criteria For Phase 2

1. Users can see how many calls a campaign will attempt and when those calls may occur.
2. Users can see what happens after each supported outcome before launching a campaign.
3. Users can edit safe post-outcome behavior without editing unsafe runtime internals.
4. Campaign detail explains why each lead is queued, cooling down, SMS-pending, blocked, or done.
5. All user-facing "latest outcome" fields use the latest campaign call record for that lead in that campaign.

## Out Of Scope For This Addendum

1. free-form workflow scripting
2. multi-branch campaign orchestration
3. advanced lead scoring redesign
4. full analytics redesign
5. rebuilding the scheduling engine

## Recommended Next Actions

1. Fix remaining stale `latest outcome` reads in eligibility/review flows.
2. Add a read-only runtime summary surface to start/review/settings/detail.
3. Design the safe post-outcome editor around existing `outcome_routing` schema fields.
4. Add query-level explainability fields for lead runtime state on the campaign detail route.
