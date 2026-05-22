# Current App Connected Core Plan

This plan focuses on tightening the existing RealEase product before adding larger lifecycle features. The goal is to make the current pages feel like one coherent system instead of separate tools.

## Product Loop

The current app should be organized around one loop:

```text
Capture lead -> Contact/qualify lead -> Hand off to realtor -> Move through buyer/seller pipeline -> Track outcome
```

Every existing page should support at least one part of this loop.

## Page Roles

### Dashboard

Primary job:

- Tell the realtor what needs attention today.

Recommended responsibilities:

- Show new leads that have not been contacted.
- Show outreach handoffs that need realtor action.
- Show callbacks due.
- Show qualified leads without a next business step.
- Show campaign problems like failed calls, wrong numbers, and compliance blocks.
- Link directly to the relevant lead profile, campaign, or call report.

The dashboard should not just be a metrics page. It should be the operational home base.

### Leads Dashboard / Network

Primary job:

- Show the full lead database and let users filter, search, inspect, and add leads.

Recommended responsibilities:

- Keep all captured leads visible.
- Clearly indicate lead status: `new`, `contacted`, `qualified`.
- Surface latest outreach outcome when available.
- Surface whether the lead needs action.
- Link every row to the lead profile.

This page is the source list, not the daily work queue.

### Lead Profile

Primary job:

- Be the canonical story of a lead.

Recommended responsibilities:

- Show contact info and core lead fields.
- Show current lead status and buyer/seller pipeline stage.
- Show latest outreach result and latest AI summary.
- Show communication history: calls, SMS, notes.
- Show compliance state: do-not-call and SMS opt-out.
- Offer actions: send SMS, add note, edit profile, open call report, move pipeline stage.

If a realtor opens one lead, they should not need to visit multiple pages to understand what happened.

### Outreach Campaigns

Primary job:

- Configure, run, and measure automated outreach.

Recommended responsibilities:

- Show campaign setup and runtime state.
- Show leads enrolled in the campaign.
- Show call attempts and outcomes.
- Show what the campaign produced: qualified leads, callbacks, interested leads, opt-outs, wrong numbers, failed calls.
- Link each campaign lead back to the lead profile.

Outreach should be judged by useful handoffs, not only call volume.

### Call Report

Primary job:

- Explain one outreach interaction.

Recommended responsibilities:

- Show outcome, summary, transcript, recording, extracted data, and follow-up status.
- Show what changed on the lead because of the call.
- Link back to the lead profile and campaign.

The call report is supporting evidence. The lead profile should still summarize the latest important call result.

### Buyer/Seller Kanban

Primary job:

- Track active business progress after a lead is workable.

Recommended responsibilities:

- Buyer pipeline tracks buyer work: searching, showings, offer out, under contract, closed.
- Seller pipeline tracks seller work: pre-listing, on market, offer in, under contract, sold.
- Qualified buyer/seller leads should appear in the appropriate pipeline.
- Kanban cards should link to lead profiles.

The kanban should represent active opportunities, not the entire raw lead database.

### Insights

Primary job:

- Explain whether lead generation and outreach are creating business value.

Recommended responsibilities:

- Show source performance.
- Show lead status conversion.
- Show outreach outcome distribution.
- Show pipeline bottlenecks.
- Show appointments/clients/closed outcomes once those concepts are modeled.

Insights should come after the operational loop is reliable.

## Lead State Model

Use two separate concepts:

```text
Lead status = qualification/contact state
Pipeline stage = business/deal progress
```

Recommended interpretation:

- `new`: lead captured, no meaningful contact yet.
- `contacted`: call or SMS happened, but the lead is not yet qualified.
- `qualified`: enough information exists for realtor handoff or active work.

Buyer/seller pipeline stages should represent what happens after a lead is qualified or actively worked.

## Outreach Outcome Behavior

Outreach needs clear product behavior for every normalized outcome.

| Outcome | Recommended App Behavior |
| --- | --- |
| `connected_interested` | Mark lead qualified, assign buyer/seller type if known, put lead into starting pipeline stage, create or show realtor handoff. |
| `callback_requested` | Mark contacted or qualified depending on extracted data, pause campaign for that lead, show callback action prominently. |
| `voicemail_left` | Mark contacted, optionally queue/send follow-up SMS, keep retry policy active if allowed. |
| `no_answer` | Keep retrying until max attempts, then move to nurture/review state or stop campaign attempts. |
| `connected_not_interested` | Stop active outreach, lower priority, optionally archive/nurture. |
| `wrong_number` | Flag bad contact info and prevent further automated outreach until corrected. |
| `do_not_call` | Set compliance block and prevent future calls/SMS where applicable. |
| `failed` | Show operational issue and allow retry/reconciliation. |

This mapping should be visible in the UI, not just hidden in backend routing.

## Missing Connective Concept: Realtor Handoff

The current app likely needs a thin handoff concept before larger lifecycle features.

A handoff means:

```text
Automation or lead activity found something useful, and a human should act.
```

Potential handoff triggers:

- `connected_interested`
- `callback_requested`
- lead became `qualified`
- qualified lead has no buyer/seller pipeline stage
- lead has a call summary but no follow-up
- compliance or contact-data issue needs manual review

This can start as a derived UI state before becoming a persisted table.

Suggested handoff surfaces:

- Dashboard: "Needs Realtor Action"
- Lead row: badge or warning
- Lead profile: next action panel
- Campaign detail: campaign-generated handoffs

## Navigation Connections

Minimum links that should exist:

- Dashboard action item -> lead profile
- Dashboard campaign issue -> campaign detail
- Lead profile -> latest call report
- Lead profile -> campaign detail for latest campaign call
- Campaign detail lead row -> lead profile
- Call report -> lead profile
- Call report -> campaign detail
- Kanban card -> lead profile
- Lead profile -> buyer/seller pipeline view when applicable

These links are small but important. They make the app feel connected.

## Stabilization Sequence

### Phase 1: Audit Current Flow

Confirm what already works end to end:

- Create lead.
- View lead in network/dashboard.
- Edit lead.
- Send direct SMS if configured.
- Add note.
- Enroll lead in outreach campaign.
- Dispatch call.
- Receive call webhook.
- Persist call outcome.
- Update lead shortcut fields.
- Open call report.
- See communication history on lead profile.
- Move buyer/seller pipeline stage.

### Phase 2: Tighten Outreach Handoff

Define exactly what happens for each outreach outcome. Make the UI show the result clearly.

Minimum UI improvements:

- Latest outreach outcome on lead row.
- Latest outreach summary on lead profile.
- Clear compliance block display.
- Campaign detail count for interested/callback/blocked/failed leads.
- Direct links from campaign lead rows to lead profiles.

### Phase 3: Make Dashboard Operational

Add or refine dashboard sections:

- New leads needing first contact.
- Leads needing realtor action.
- Callbacks due.
- Campaign issues.
- Recently qualified leads.

Avoid adding complex analytics until these operational sections are reliable.

### Phase 4: Clarify Kanban Entry Rules

Decide when a lead appears in buyer/seller pipeline:

- Automatically after `connected_interested` when buyer/seller type is known.
- Manually when realtor marks lead as qualified.
- Not for raw uncontacted leads unless explicitly assigned.

### Phase 5: Add Reporting After Workflow Is Coherent

Once the operational loop is stable, build insights from real transitions:

- Lead source to qualified rate.
- Outreach campaign to handoff rate.
- Qualified to appointment rate.
- Pipeline stage aging.

## Definition Of "Current App Works"

The current app is in a good baseline state when a realtor can answer:

- What leads came in?
- Which ones have been contacted?
- What did outreach learn?
- Which leads need me now?
- Where is this lead in the buyer/seller process?
- What happened last?
- What should I do next?

If those answers are clear across the existing pages, the app is ready for more advanced lifecycle features.
