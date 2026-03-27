# Outreach Campaign Automation

## 1. Campaign Start And Enrollment

### Relevant Files
- `app/(app)/leads/components/OutreachLeadPicker.tsx` - Triggers `startCampaignOutreach` from campaign picker flows.
- `app/(app)/leads/components/outreach/StartOutreachWizardModal.tsx` - Collects selected lead IDs and sends start payload.
- `convex/outreach/actions.ts` - `startCampaignOutreach` action is the server entrypoint.
- `convex/outreach/auth.ts` - `validateCampaignOwnership` enforces authenticated ownership.
- `convex/outreach/campaignLeadState.ts` - `enrollLeadsInCampaignBatch` inserts state rows and schedules first evaluations.
- `convex/outreach/callingWindow.ts` - Computes immediate vs delayed first run times.
- `convex/outreach/outreach.schema.ts` - Defines `outreachCampaignLeadStates` table and indexes.

```mermaid
sequenceDiagram
autonumber
actor User
box Client Boundary
participant Client as React Client
end
box Server Boundary
participant Server as Convex Action/Mutation/Query
end
participant DB as Convex DB

User->>Client: Click "Start Outreach"
Client->>Server: action startCampaignOutreach({ campaignId, leadIds: Id<"leads">[] })
Server->>Server: runQuery validateCampaignOwnership({ campaignId })
Server->>DB: get campaign + auth identity lookup
alt Unauthorized or not owner
  DB-->>Server: no matching owner
  Server-->>Client: throw "Campaign not found"/"Unauthorized"
  Client-->>User: Show error toast
else Authorized
  Server->>Server: runMutation enrollLeadsInCampaignBatch({ campaign_id, lead_ids })
  loop For each lead
    Server->>DB: check exclusivity + insert outreachCampaignLeadStates row
    Server->>Server: scheduler.runAt(next_action_at_ms, evaluateCampaignLeadState)
  end
  Server-->>Client: { campaignId, enrolledCount, skippedCount, enrolled[], skipped[] }
  Client-->>User: Show enrollment results + navigate to campaign run view
end
```

## 2. Dispatch, Call Events, And State Transitions

### Relevant Files
- `convex/outreach/campaignLeadState.ts` - Evaluates eligibility, reserves slot, creates call row, and exposes dispatch validity guards.
- `convex/outreach/actions.ts` - `dispatchQueuedCampaignCall` performs pre-flight validity check and provider call creation.
- `convex/outreach/mutations.ts` - `recordCallDispatchResult` and `ingestRetellWebhookEvent` update call records and lead outcomes.
- `convex/outreach/mutations.ts` - Inline transition helper updates campaign lead state on `call_started` / `call_ended`.
- `convex/outreach/queries.ts` - `getCampaignDispatchConfig` reads campaign dispatch configuration.

```mermaid
sequenceDiagram
autonumber
actor User
box Client Boundary
participant Client as React Client
end
box Server Boundary
participant Server as Convex Internal Functions
participant Provider as Retell
end
participant DB as Convex DB

Server->>Server: evaluateCampaignLeadState({ stateId })
Server->>DB: read state row + campaign + lead
alt Not due / paused / blocked
  Server-->>Server: reschedule or return
else Due and eligible
  Server->>DB: insert outreachCalls { lead_id, campaign_id, call_status:"queued", ... }
  Server->>DB: patch state { state:"queued", active_call_id: callId }
  Server->>Server: scheduler.runAfter(0, dispatchQueuedCampaignCall)
end

Server->>Server: dispatchQueuedCampaignCall({ stateId, callId, campaignId, leadId, dialToNumber })
Server->>Server: runQuery isDispatchStillValid({ stateId, callId })
alt Stale dispatch (state changed / different active_call_id)
  Server-->>Server: return early (no provider call)
else Still valid
  Server->>Server: runQuery getCampaignDispatchConfig({ campaignId })
  Server->>Provider: create-phone-call { from_number, to_number, override_agent_id, metadata }
  alt Provider error
    Server->>DB: patch outreachCalls error/call_status
    Server->>Server: runMutation handleDispatchError({ stateId, callId, transient, error_message })
  else Provider accepted
    Server->>DB: patch outreachCalls { retell_call_id, call_status }
  end
end

Provider->>Server: webhook ingestRetellWebhookEvent({ event_type, payload, ... })
Server->>DB: patch outreachCalls with status/outcome/transcript/summary
Server->>DB: patch lead outcome routing fields
Server->>DB: patch outreachCampaignLeadStates transition (queued->in_progress->cooldown/sms_pending/done/terminal_blocked)
```

## 3. Watchdog Reconciliation And Stale Recovery

### Relevant Files
- `convex/crons.ts` - Schedules watchdog jobs (`cleanup-stale-outreach-calls`, `reconcile-outreach-lead-states`).
- `convex/outreach/campaignLeadState.ts` - `reconcileDueCampaignLeadStates` re-schedules due rows and repairs stale queued/in_progress/sms_pending state rows.
- `convex/outreach/mutations.ts` - `cleanupStaleActiveCalls` closes stale queued/ringing/in_progress call records.
- `convex/outreach/actions.ts` - `dispatchFollowUpSms` remains event-driven from scheduled jobs.

```mermaid
sequenceDiagram
autonumber
actor User
box Client Boundary
participant Client as React Client
end
box Server Boundary
participant Server as Convex Cron/Internal Mutations
end
participant DB as Convex DB

Server->>Server: cron reconcile-outreach-lead-states (every 15m)
Server->>DB: query due eligible/cooldown rows
loop Due rows
  Server->>Server: scheduler.runAfter(0, evaluateCampaignLeadState)
end

Server->>DB: query stale queued/in_progress/sms_pending rows
alt Stale queued/in_progress
  Server->>DB: patch state -> eligible, clear active_call_id, set next_action_at_ms=now
  Server->>Server: scheduler.runAfter(0, evaluateCampaignLeadState)
else Stale sms_pending
  Server->>DB: patch state -> cooldown, set next_action_at_ms=now
  Server->>Server: scheduler.runAfter(0, evaluateCampaignLeadState)
end

Server->>Server: cron cleanup-stale-outreach-calls (every 10m)
Server->>DB: query queued/ringing/in_progress outreachCalls
Server->>DB: patch stale calls -> failed with timeout error
note over Server,DB: Internal-only cron/internal functions — not client-callable APIs
```

