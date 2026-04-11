# Outreach Campaign UX Flow Plan (Revised)

## Decision Summary
Adopt **Option 2 (Lead-First Quick Launch)** as the primary UX flow, with added guardrails so setup remains clear and predictable.

## Implementation Update
The MVP launch flow remains the active baseline. The first two Phase 2 slices have now been implemented on top of it:

1. latest campaign outcome display is normalized through a shared latest-call resolver backed by `outreachCalls`
2. review/add-leads/detail latest outcome surfaces no longer depend on `outreachCampaignLeadStates.last_outcome` for display
3. campaign templates, campaign picker rows, enrollment review payloads, and campaign detail payloads now include read-only runtime summary data
4. the launch wizard, standalone campaign create wizard, final review step, campaign settings form, and campaign detail route now show "How This Campaign Runs" style runtime summaries
5. campaign detail keeps compact runtime rules in the same campaign header box as the campaign name, status, summary counts, and `Add Leads` action
6. campaign create/edit dialogs use wider, scrollable layouts so runtime summaries and rule editors do not overflow vertically
7. campaign settings includes a guarded post-outcome rule editor for safe outcome routing fields
8. campaign detail lead rows include state explainability fields for current state, reason, next action, next action time, and stop reason
9. campaign creation supports editing campaign name, description, calling window, retry policy, and follow-up SMS before create; timezone remains backend/default configuration rather than a visible user control
10. outcome rules now distinguish internal campaign behavior (`continue`, `stop_calling`, `pause_for_realtor`) from lead status/stage updates
11. guarded terminal outcomes are hidden from the edit UI and sanitized server-side

Still pending from the broader product direction:

1. deeper UX polish for the post-outcome editor after real usage
2. a real realtor notification/task system for paused-for-review leads
3. a guarded Retell agent-instruction editor for campaign templates
4. advanced workflow branching or free-form scripting, which remains intentionally out of scope

This revision is based on clarified product intent:
- campaigns are a collection of selected leads plus predefined outreach instructions,
- leads can belong to only one campaign at a time,
- predefined campaign paths (for example buyer vs seller outreach) should be first-class,
- users should be able to adjust campaign logic safely.

## Campaign Definition (Canonical)
A campaign is:
1. A lead cohort selected by the user.
2. An instruction bundle used by the Retell agent, including:
   - contact frequency/cadence,
   - points of contact,
   - campaign message substance and style.
3. A run context tracked on the campaign detail route (`/leads/outreach/[campaignId]`).

Constraints:
1. A lead may belong to **one active campaign at a time**.
2. Predefined campaign templates should exist for key intents (at minimum `Buyer Outreach` and `Seller Outreach`).
3. Template logic should be editable by users with guardrails (avoid unsafe/broken campaign definitions).
4. Editing "what the agent does on Retell" should be modeled as guarded template-instruction fields, not raw Retell configuration or free-form workflow scripting. Safe fields can include call objective, opening line, tone/persona, required qualification questions, objection-handling notes, voicemail guidance, and compliance/disclosure copy. RealEase should version and review those template changes before compiling them into Retell agent variables or Retell agent versions.

## Why Option 2 Is Now The Best Fit
1. Single obvious start point (`Start Outreach`) is less confusing for users.
2. Aligns naturally with predefined campaign routes and operating intent ("pick leads, launch outreach").
3. Better supports template-driven flows where campaign type matters before execution.
4. Still allows explicit confirmation, so no hidden auto-start behavior.

## Target MVP Flow (Option 2 + Guardrails)
1. User clicks global `Start Outreach` CTA from outreach page header.
2. User picks campaign type/template (`Buyer`, `Seller`, later extensible).
3. User selects leads.
4. User chooses:
   - existing campaign of that type, or
   - create a new campaign inline from selected template defaults.
5. System validates selected leads:
   - eligible,
   - already assigned to another campaign,
   - ineligible/skipped with reasons.
6. User reviews summary and explicitly confirms start.
7. System enrolls leads and routes to `/leads/outreach/[campaignId]`.

## UX Rules
1. Lead selection alone never starts outreach.
2. Only final confirm action starts enrollment/scheduling.
3. Campaign table row actions focus on management (`Open`, `Pause/Resume`, `Archive`) rather than first-start CTA.
4. Campaign detail page remains execution hub and supports `Add Leads` via same validation rules.
5. If outside calling window, confirmation feedback must state leads were queued for next valid window.

## Required Guardrails
1. Enforce single-campaign membership at mutation level (not just UI).
2. Show conflict handling in review step for already-assigned leads.
3. Keep template defaults strongly typed and versioned enough to avoid silent drift.
4. Restrict editable campaign logic to safe fields (cadence/contact strategy/message config), with validation.

## Implementation Scope (MVP)
1. Frontend
   - Update outreach entry flow to lead-first wizard.
   - Add campaign type/template step.
   - Add review step with grouped skipped/conflict reasons.
   - Reframe campaigns table actions to management-first.
2. Backend
   - Add/confirm single-campaign assignment validation in enrollment mutation.
   - Support inline campaign creation from template defaults.
   - Return structured eligibility/conflict results for review UI.
3. Copy
   - Update all start language to "enroll and schedule" (not guaranteed immediate calls).

## Out Of Scope (This Iteration)
1. New lead scoring models.
2. Advanced multi-campaign orchestration.
3. Full redesign of run analytics/conversation tooling.

## Known Bug To Fix In Same Workstream
**Bug:** On outreach campaign detail (`/leads/outreach/[campaignId]`), contacted leads sidebar sometimes shows incorrect outcome label (example: saved `interested` appears as `not interested`).

Add explicit fix task:
1. Audit outcome enum-to-label mapping for sidebar data source.
2. Normalize mapping in one shared utility.
3. Add regression coverage for all outcome values.

## Acceptance Criteria
1. Users can start outreach from one obvious global CTA.
2. Users must explicitly confirm before outreach starts.
3. Leads already assigned elsewhere are clearly surfaced and not silently enrolled.
4. Buyer vs seller predefined templates are selectable at start.
5. Campaign detail route correctly reflects saved lead outcomes.
