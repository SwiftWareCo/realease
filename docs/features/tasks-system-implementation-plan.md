# Tasks System Implementation Plan

This plan defines a practical task system for connecting RealEase's current leads, outreach, dashboard, lead profile, and campaign pages. The goal is not to add a large project-management feature. The goal is to create one operational layer for answering:

```text
What needs to be done, who owns it, when is it due, and what lead/campaign caused it?
```

## Product Decision

Use a single `tasks` system instead of separate disconnected dashboard widgets.

Dashboard sections like "Needs Follow-Up", "Callbacks Due", "New Qualified Leads", and "Campaign Problems" should be filtered views of tasks, not separate data models.

## Core Model

System events and manual user actions create tasks.

```text
Outreach outcome -> task
Manual user todo -> task
Pipeline issue -> task
Dashboard -> prioritized task views
Lead profile -> tasks for this lead
Campaign detail -> tasks/problems for this campaign
```

## MVP Task Types

Start with these task types:

```ts
type TaskType =
    | "lead_follow_up"
    | "callback"
    | "qualified_handoff"
    | "campaign_problem"
    | "manual"
    | "appointment"
    | "pipeline_review";
```

Meaning:

- `lead_follow_up`: a lead needs call/SMS/realtor follow-up.
- `callback`: a lead requested a callback at or around a specific time.
- `qualified_handoff`: outreach or manual qualification produced a lead that needs realtor action.
- `campaign_problem`: outreach has an operational issue such as failed call, wrong number, SMS failure, provider/config issue, or stale state.
- `manual`: user-created custom task.
- `appointment`: consult, showing, listing appointment, or similar scheduled business step.
- `pipeline_review`: lead appears stuck or needs stage review.

## MVP Schema

Create a new schema file:

```text
convex/tasks/task.schema.ts
```

Add it to:

```text
convex/schema.ts
```

Suggested table:

```ts
tasks: {
    title: string;
    description?: string;
    type:
        | "lead_follow_up"
        | "callback"
        | "qualified_handoff"
        | "campaign_problem"
        | "manual"
        | "appointment"
        | "pipeline_review";
    status: "open" | "completed" | "snoozed" | "canceled";
    priority: "low" | "normal" | "high" | "urgent";

    due_at?: number;
    snoozed_until?: number;
    completed_at?: number;

    lead_id?: Id<"leads">;
    campaign_id?: Id<"outreachCampaigns">;
    call_id?: Id<"outreachCalls">;

    assigned_to_user_id?: Id<"users">;
    created_by_user_id: Id<"users">;

    source: "manual" | "outreach" | "pipeline" | "system";
    source_event?: string;
    dedupe_key?: string;

    created_at: number;
    updated_at: number;
}
```

Recommended indexes:

```ts
.index("by_created_by_user_id", ["created_by_user_id"])
.index("by_created_by_user_id_and_status", ["created_by_user_id", "status"])
.index("by_created_by_user_id_and_status_and_due_at", [
    "created_by_user_id",
    "status",
    "due_at",
])
.index("by_assigned_to_user_id_and_status_and_due_at", [
    "assigned_to_user_id",
    "status",
    "due_at",
])
.index("by_lead_id_and_status", ["lead_id", "status"])
.index("by_campaign_id_and_status", ["campaign_id", "status"])
.index("by_call_id", ["call_id"])
.index("by_dedupe_key", ["dedupe_key"])
```

Notes:

- `created_by_user_id` should be required because current app data is user-scoped.
- `assigned_to_user_id` can be optional now and become more important when team features mature.
- `dedupe_key` prevents repeated webhook deliveries or repeated campaign evaluations from creating duplicate tasks.

## Backend Files

Create:

```text
convex/tasks/task.schema.ts
convex/tasks/queries.ts
convex/tasks/mutations.ts
convex/tasks/internal.ts
```

### Public Queries

`convex/tasks/queries.ts`

Recommended functions:

- `getOpenTasksForDashboard`
- `getTasksForLead`
- `getTasksForCampaign`
- `getTaskById`

Dashboard query should return grouped buckets:

```ts
{
    dueToday: TaskWithContext[];
    overdue: TaskWithContext[];
    callbacks: TaskWithContext[];
    outreachProblems: TaskWithContext[];
    qualifiedHandoffs: TaskWithContext[];
}
```

`TaskWithContext` should include enough lead/campaign display fields to avoid excessive client-side queries:

```ts
{
    task,
    lead?: { _id, name, phone, intent, status },
    campaign?: { _id, name, status },
    call?: { _id, outcome, call_status, initiated_at }
}
```

### Public Mutations

`convex/tasks/mutations.ts`

Recommended functions:

- `createManualTask`
- `updateTask`
- `completeTask`
- `snoozeTask`
- `cancelTask`

All public mutations must derive the current user server-side with `getCurrentUserIdOrThrow(ctx)`. Do not accept user IDs from the client for authorization.

### Internal Mutations

`convex/tasks/internal.ts`

Recommended functions:

- `createOrUpdateSystemTask`
- `completeTasksForSource`
- `cancelOpenTasksForLead`
- `createOutreachOutcomeTask`

These should be internal because they will be called from outreach mutations/actions or future pipeline automation.

## Outreach Outcome To Task Mapping

Only create tasks when a human action or review is needed.

| Outreach outcome | Task behavior |
| --- | --- |
| `connected_interested` | Create `qualified_handoff`, priority `high`, due now. Optionally also create `lead_follow_up` if no automatic SMS/appointment exists. |
| `callback_requested` | Create `callback`, priority `urgent` or `high`, due at extracted callback time if available, otherwise due now. |
| `voicemail_left` | Do not create task if automated SMS/retry is configured. Create `lead_follow_up` only if manual follow-up is required. |
| `no_answer` | Do not create task per attempt. Create `lead_follow_up` or `pipeline_review` only after max attempts or terminal no-response state. |
| `connected_not_interested` | Usually no task. Optional manual review task only if campaign settings require review. |
| `wrong_number` | Create `campaign_problem`, priority `normal`, linked to lead/campaign/call. |
| `do_not_call` | Usually no task; compliance fields should be set. Optional `campaign_problem` only if team wants review. |
| `failed` | Create `campaign_problem`, priority depends on failure type. |

## Dedupe Rules

Every system-created task should have a deterministic `dedupe_key`.

Examples:

```text
outreach:call:{callId}:qualified_handoff
outreach:call:{callId}:callback
outreach:call:{callId}:campaign_problem
lead:{leadId}:qualified_without_pipeline
campaign:{campaignId}:provider_config_missing
```

If a task with the same `dedupe_key` exists and is open/snoozed, update it instead of inserting a duplicate.

## Dashboard Integration

The dashboard should show task-based sections.

Recommended first version:

```text
Tasks Due Today
Callbacks Due
New Qualified Handoffs
Outreach Problems
Campaign Summary
```

Important distinction:

- The first four sections are task-driven.
- Campaign Summary is not a task list. It is an outreach health/performance summary.

Dashboard item should show:

- Task title
- Lead name if linked
- Campaign name if linked
- Due time
- Priority
- Reason/source
- Primary action: open lead, open campaign, complete, snooze

## Lead Profile Integration

Add a task panel to the lead profile:

```text
Open Tasks
- Call back Jordan today at 4 PM
- Send CMA preview
- Review wrong number issue
```

Actions:

- Create manual task for this lead.
- Complete task.
- Snooze task.
- Open linked call report/campaign if present.

The lead profile should remain the canonical lead story. Tasks are the operational next-step layer.

## Campaign Detail Integration

Add a campaign tasks/problems panel:

```text
Campaign Tasks
- 4 callbacks
- 3 qualified handoffs
- 2 failed calls
- 1 wrong number
```

This helps users understand what the campaign produced and what is broken.

## Tasks Page

Add a dedicated page after dashboard MVP:

```text
/tasks
```

Suggested filters:

- All open
- Due today
- Overdue
- Callbacks
- Outreach
- Manual
- Completed

This page can come after dashboard and lead-profile integration. Do not block the first useful version on a full tasks page.

## UI Implementation Sequence

### Phase 1: Backend Foundation

- Add `tasks` table.
- Add public create/update/complete/snooze/cancel mutations.
- Add dashboard and lead task queries.
- Add internal create-or-update task function with dedupe support.

### Phase 2: Manual Tasks

- Add manual task creation from lead profile.
- Show open tasks on lead profile.
- Allow complete and snooze.

This proves the data model without touching outreach complexity first.

### Phase 3: Dashboard Task Buckets

- Add dashboard query for grouped open tasks.
- Add dashboard sections:
  - due today
  - callbacks
  - qualified handoffs
  - outreach problems

### Phase 4: Outreach Task Generation

- Hook final outreach outcome processing to internal task creation.
- Generate tasks for `connected_interested`, `callback_requested`, `wrong_number`, and `failed` first.
- Add `no_answer` max-attempt task later after campaign state behavior is confirmed.

### Phase 5: Campaign Task Context

- Add task summary to campaign detail.
- Link campaign tasks to lead profile and call report.

### Phase 6: Full Tasks Page

- Add `/tasks` as a dedicated task workbench.
- Include filters, bulk completion, snooze, and custom task creation.

## Completion Behavior

Completing a task should not automatically mutate lead status unless that behavior is explicit.

Recommended MVP:

- Completing `manual`, `lead_follow_up`, or `callback` only marks the task completed.
- Completing `qualified_handoff` may optionally ask user whether to move lead into buyer/seller pipeline.
- Completing `campaign_problem` should require the user to indicate if the issue was resolved or ignored.

Keep this conservative at first. Silent automatic mutations can make the system hard to trust.

## Open Product Questions

Before implementation, decide:

- Should tasks be assigned only to the current user for now, or support team assignment immediately?
- Should completed tasks remain visible on lead profile history?
- Should tasks support comments, or should notes remain separate?
- Should `callback_requested` due time come from Retell extracted data, campaign rules, or manual confirmation?
- Should `connected_interested` create one `qualified_handoff` task or both `qualified_handoff` and `lead_follow_up`?

Recommended MVP answers:

- Assign tasks to current user only.
- Show completed tasks in a collapsed lead profile section later, not in MVP.
- Keep comments out of tasks; use lead notes.
- Use Retell extracted callback time if available, otherwise due now.
- Create only one `qualified_handoff` task for `connected_interested` to avoid noise.

## Definition Of Done

The tasks system is useful when:

- A user can manually create a task for a lead.
- A user can complete and snooze tasks.
- Dashboard shows the most important open tasks.
- Lead profile shows tasks related to that lead.
- Outreach outcomes create deduped tasks only when human action is needed.
- Campaign problems are visible without digging through raw call logs.

If these are true, tasks become the connective tissue between outreach, dashboard, lead profile, and campaigns.
