/**
 * Campaign lead state mutations — the core state machine for outreach automation.
 *
 * Every lead enrolled in a campaign gets a row in `outreachCampaignLeadStates`.
 * Scheduled handlers drive transitions; the cron is only a reconciliation watchdog.
 */

import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx } from "../_generated/server";
import {
    internalMutationWithCounters as internalMutation,
    mutationWithCounters as mutation,
} from "./counterTriggers";
import { v } from "convex/values";
import { normalizePhoneNumber } from "./phone";
import {
    isInsideCallingWindow,
    getNextWindowOpenMs,
    type CallingWindow,
} from "./callingWindow";
import { getCurrentUserIdOrThrow } from "./auth";
import { buildLeadEnrollmentReviewRecord } from "./eligibility";
import { outreachCampaignTemplateKeyValidator } from "./templates";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TERMINAL_STATES: ReadonlySet<Doc<"outreachCampaignLeadStates">["state"]> =
    new Set(["done", "terminal_blocked"]);

const ACTIVE_CALL_STATUSES: ReadonlySet<Doc<"outreachCalls">["call_status"]> =
    new Set(["queued", "ringing", "in_progress"]);

const TRANSIENT_RETRY_BACKOFF_MS = 30_000; // 30 seconds
const SLOT_RETRY_DELAY_MS = 60_000; // 60 seconds

type CampaignLeadOutcomeAction =
    | "continue"
    | "stop_calling"
    | "pause_for_realtor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultCampaignLeadAction(
    outcome: Doc<"outreachCalls">["outcome"],
): CampaignLeadOutcomeAction {
    switch (outcome) {
        case "connected_interested":
        case "connected_not_interested":
            return "stop_calling";
        case "callback_requested":
            return "pause_for_realtor";
        default:
            return "continue";
    }
}

function campaignCallingWindow(
    campaign: Doc<"outreachCampaigns">,
): CallingWindow {
    return campaign.calling_window as CallingWindow;
}

async function scheduleLeadEnrollment(
    ctx: MutationCtx,
    args: {
        campaignId: Id<"outreachCampaigns">;
        leadId: Id<"leads">;
        nextActionAtMs: number;
    },
) {
    const stateId = await ctx.db.insert("outreachCampaignLeadStates", {
        campaign_id: args.campaignId,
        lead_id: args.leadId,
        state: "eligible",
        next_action_at_ms: args.nextActionAtMs,
        attempts_in_campaign: 0,
        no_answer_or_voicemail_count: 0,
    });

    await ctx.scheduler.runAt(
        args.nextActionAtMs,
        internal.outreach.campaignLeadState.evaluateCampaignLeadState,
        { stateId },
    );

    return stateId;
}

// ---------------------------------------------------------------------------
// Pre-flight validation for dispatch
// ---------------------------------------------------------------------------

export const isDispatchStillValid = internalQuery({
    args: {
        stateId: v.id("outreachCampaignLeadStates"),
        callId: v.id("outreachCalls"),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.stateId);
        return !!row && row.state === "queued" && row.active_call_id === args.callId;
    },
});

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export const enrollLeadInCampaign = internalMutation({
    args: {
        campaign_id: v.id("outreachCampaigns"),
        lead_id: v.id("leads"),
    },
    handler: async (ctx, args) => {
        // Check: no active (non-terminal) state row for this lead in an active campaign.
        const existingRows = await ctx.db
            .query("outreachCampaignLeadStates")
            .withIndex("by_lead_id", (q) => q.eq("lead_id", args.lead_id))
            .collect();
        let hasActiveRow = false;
        for (const row of existingRows) {
            if (TERMINAL_STATES.has(row.state)) continue;
            const otherCampaign = await ctx.db.get(row.campaign_id);
            if (otherCampaign?.status === "active") {
                hasActiveRow = true;
                break;
            }
        }
        if (hasActiveRow) {
            return { enrolled: false, reason: "lead_already_active" as const };
        }

        const campaign = await ctx.db.get(args.campaign_id);
        if (!campaign) {
            return { enrolled: false, reason: "campaign_not_found" as const };
        }

        const now = Date.now();
        const window = campaignCallingWindow(campaign);
        const nextActionAtMs = isInsideCallingWindow(now, campaign.timezone, window)
            ? now
            : getNextWindowOpenMs(now, campaign.timezone, window);

        const stateId = await ctx.db.insert("outreachCampaignLeadStates", {
            campaign_id: args.campaign_id,
            lead_id: args.lead_id,
            state: "eligible",
            next_action_at_ms: nextActionAtMs,
            attempts_in_campaign: 0,
            no_answer_or_voicemail_count: 0,
        });

        await ctx.scheduler.runAt(
            nextActionAtMs,
            internal.outreach.campaignLeadState.evaluateCampaignLeadState,
            { stateId },
        );

        return { enrolled: true, stateId };
    },
});

export const enrollLeadsInCampaignBatch = internalMutation({
    args: {
        campaign_id: v.id("outreachCampaigns"),
        lead_ids: v.array(v.id("leads")),
        template_key: v.optional(outreachCampaignTemplateKeyValidator),
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaign_id);
        if (!campaign) {
            return { enrolled: [], skipped: [] };
        }

        const now = Date.now();
        const window = campaignCallingWindow(campaign);
        const nextActionAtMs = isInsideCallingWindow(now, campaign.timezone, window)
            ? now
            : getNextWindowOpenMs(now, campaign.timezone, window);

        const enrolled: Array<{
            lead_id: Id<"leads">;
            stateId: Id<"outreachCampaignLeadStates">;
        }> = [];
        const skipped: Array<{
            lead_id: Id<"leads">;
            reasons: string[];
            conflict_campaign_id?: Id<"outreachCampaigns"> | null;
            conflict_campaign_name?: string | null;
        }> = [];

        for (const leadId of args.lead_ids) {
            const lead = await ctx.db.get(leadId);
            if (!lead) {
                skipped.push({
                    lead_id: leadId,
                    reasons: ["lead_not_found"],
                });
                continue;
            }
            if (lead.created_by_user_id !== campaign.created_by_user_id) {
                skipped.push({
                    lead_id: leadId,
                    reasons: ["lead_not_found"],
                });
                continue;
            }

            const review = await buildLeadEnrollmentReviewRecord(
                ctx,
                {
                    campaignId: campaign._id,
                    maxAttempts: campaign.retry_policy.max_attempts,
                    templateKey:
                        campaign.template_key ?? args.template_key ?? null,
                },
                lead,
            );
            if (!review.selectable) {
                skipped.push({
                    lead_id: leadId,
                    reasons: review.reasons,
                    conflict_campaign_id: review.conflictCampaignId,
                    conflict_campaign_name: review.conflictCampaignName,
                });
                continue;
            }

            const stateId = await scheduleLeadEnrollment(ctx, {
                campaignId: args.campaign_id,
                leadId,
                nextActionAtMs,
            });

            enrolled.push({ lead_id: leadId, stateId });
        }

        return { enrolled, skipped };
    },
});

export const unenrollLeadFromCampaign = internalMutation({
    args: {
        campaign_id: v.id("outreachCampaigns"),
        lead_id: v.id("leads"),
    },
    handler: async (ctx, args) => {
        const stateRow = await ctx.db
            .query("outreachCampaignLeadStates")
            .withIndex("by_campaign_id_and_lead_id", (q) =>
                q.eq("campaign_id", args.campaign_id).eq("lead_id", args.lead_id),
            )
            .first();
        if (!stateRow) return;
        if (TERMINAL_STATES.has(stateRow.state)) return;

        await ctx.db.patch(stateRow._id, {
            state: "done",
            next_action_at_ms: undefined,
            active_call_id: undefined,
        });
    },
});

// ---------------------------------------------------------------------------
// Core scheduled handler
// ---------------------------------------------------------------------------

export const evaluateCampaignLeadState = internalMutation({
    args: {
        stateId: v.id("outreachCampaignLeadStates"),
    },
    handler: async (ctx, args) => {
        const stateRow = await ctx.db.get(args.stateId);
        if (!stateRow) return;

        // Idempotency: only act on eligible or cooldown states.
        if (stateRow.state !== "eligible" && stateRow.state !== "cooldown") {
            return;
        }

        const campaign = await ctx.db.get(stateRow.campaign_id);
        if (!campaign) {
            await ctx.db.patch(stateRow._id, {
                state: "done",
                next_action_at_ms: undefined,
            });
            return;
        }

        // 1. Campaign status check — handles pause.
        if (campaign.status !== "active") {
            // Don't transition; leave in current state for reconciliation to pick up on resume.
            return;
        }

        // 2. Compliance check.
        const lead = await ctx.db.get(stateRow.lead_id);
        if (!lead || lead.do_not_call === true) {
            await ctx.db.patch(stateRow._id, {
                state: "terminal_blocked",
                next_action_at_ms: undefined,
            });
            return;
        }

        const now = Date.now();
        const window = campaignCallingWindow(campaign);

        // 3. Calling window check.
        if (!isInsideCallingWindow(now, campaign.timezone, window)) {
            const nextOpen = getNextWindowOpenMs(now, campaign.timezone, window);
            await ctx.db.patch(stateRow._id, {
                next_action_at_ms: nextOpen,
            });
            await ctx.scheduler.runAt(
                nextOpen,
                internal.outreach.campaignLeadState.evaluateCampaignLeadState,
                { stateId: stateRow._id },
            );
            return;
        }

        // 4. Active call guard.
        if (stateRow.active_call_id) {
            const activeCall = await ctx.db.get(stateRow.active_call_id);
            if (activeCall && ACTIVE_CALL_STATUSES.has(activeCall.call_status)) {
                // Call still active, don't do anything.
                return;
            }
            // Call is no longer active — clear the reference.
            await ctx.db.patch(stateRow._id, { active_call_id: undefined });
        }

        // 5. Max attempts check.
        if (stateRow.attempts_in_campaign >= campaign.retry_policy.max_attempts) {
            await ctx.db.patch(stateRow._id, {
                state: "done",
                next_action_at_ms: undefined,
            });
            return;
        }

        // 6. Terminal outcome check.
        if (
            stateRow.last_outcome === "do_not_call" ||
            stateRow.last_outcome === "wrong_number"
        ) {
            await ctx.db.patch(stateRow._id, {
                state: "terminal_blocked",
                next_action_at_ms: undefined,
            });
            return;
        }

        // 7. Due-time gate (for eligible and cooldown states).
        if (
            (stateRow.state === "eligible" || stateRow.state === "cooldown") &&
            stateRow.next_action_at_ms !== undefined &&
            stateRow.next_action_at_ms > now
        ) {
            // Not due yet — reschedule.
            await ctx.scheduler.runAt(
                stateRow.next_action_at_ms,
                internal.outreach.campaignLeadState.evaluateCampaignLeadState,
                { stateId: stateRow._id },
            );
            return;
        }

        // Cooldown expired — transition back to eligible, then try to reserve slot.
        if (stateRow.state === "cooldown") {
            await ctx.db.patch(stateRow._id, { state: "eligible" });
        }

        // Try to reserve a call slot and queue.
        await tryReserveCallSlotAndQueueImpl(ctx, stateRow._id, campaign, lead);
    },
});

// ---------------------------------------------------------------------------
// Concurrency-safe slot reservation
// ---------------------------------------------------------------------------

async function tryReserveCallSlotAndQueueImpl(
    ctx: MutationCtx,
    stateId: Id<"outreachCampaignLeadStates">,
    campaign: Doc<"outreachCampaigns">,
    lead: Doc<"leads">,
): Promise<void> {
    const maxConcurrency = 20; // MAX_RETELL_CONCURRENT_CALLS

    // Count queued + in_progress state rows for this campaign.
    const queuedRows = await ctx.db
        .query("outreachCampaignLeadStates")
        .withIndex("by_campaign_id_and_state", (q) =>
            q.eq("campaign_id", campaign._id).eq("state", "queued"),
        )
        .take(maxConcurrency + 1);
    const inProgressRows = await ctx.db
        .query("outreachCampaignLeadStates")
        .withIndex("by_campaign_id_and_state", (q) =>
            q.eq("campaign_id", campaign._id).eq("state", "in_progress"),
        )
        .take(maxConcurrency + 1);

    const activeCount = queuedRows.length + inProgressRows.length;

    if (activeCount >= maxConcurrency) {
        // At limit — retry later.
        const retryAt = Date.now() + SLOT_RETRY_DELAY_MS;
        await ctx.db.patch(stateId, {
            state: "eligible",
            next_action_at_ms: retryAt,
        });
        await ctx.scheduler.runAt(
            retryAt,
            internal.outreach.campaignLeadState.evaluateCampaignLeadState,
            { stateId },
        );
        return;
    }

    const dialToNumber = normalizePhoneNumber(lead.phone);
    if (!dialToNumber) {
        await ctx.db.patch(stateId, {
            state: "error",
            last_error: "Invalid phone number for dispatch",
            next_action_at_ms: undefined,
        });
        return;
    }

    const now = Date.now();

    // Create the outreachCalls record.
    const callId = await ctx.db.insert("outreachCalls", {
        lead_id: lead._id,
        campaign_id: campaign._id,
        call_status: "queued",
        call_direction: "outbound",
        initiated_at: now,
        created_at: now,
        updated_at: now,
    });

    // Transition state to queued.
    await ctx.db.patch(stateId, {
        state: "queued",
        active_call_id: callId,
        next_action_at_ms: undefined,
    });

    // Schedule the dispatch action immediately.
    await ctx.scheduler.runAfter(
        0,
        internal.outreach.actions.dispatchQueuedCampaignCall,
        {
            stateId,
            callId,
            campaignId: campaign._id,
            leadId: lead._id,
            dialToNumber,
        },
    );
}

export const tryReserveCallSlotAndQueue = internalMutation({
    args: {
        stateId: v.id("outreachCampaignLeadStates"),
    },
    handler: async (ctx, args) => {
        const stateRow = await ctx.db.get(args.stateId);
        if (!stateRow || stateRow.state !== "eligible") return;

        const campaign = await ctx.db.get(stateRow.campaign_id);
        if (!campaign || campaign.status !== "active") return;

        const lead = await ctx.db.get(stateRow.lead_id);
        if (!lead) return;

        await tryReserveCallSlotAndQueueImpl(ctx, stateRow._id, campaign, lead);
    },
});

// ---------------------------------------------------------------------------
// Webhook-driven state transitions
// ---------------------------------------------------------------------------

export const transitionStateOnCallEvent = internalMutation({
    args: {
        callId: v.id("outreachCalls"),
        campaignId: v.id("outreachCampaigns"),
        leadId: v.id("leads"),
        eventType: v.string(),
        outcome: v.optional(
            v.union(
                v.literal("connected_interested"),
                v.literal("connected_not_interested"),
                v.literal("callback_requested"),
                v.literal("voicemail_left"),
                v.literal("no_answer"),
                v.literal("wrong_number"),
                v.literal("do_not_call"),
                v.literal("failed"),
            ),
        ),
    },
    handler: async (ctx, args) => {
        const stateRow = await ctx.db
            .query("outreachCampaignLeadStates")
            .withIndex("by_campaign_id_and_lead_id", (q) =>
                q
                    .eq("campaign_id", args.campaignId)
                    .eq("lead_id", args.leadId),
            )
            .first();
        if (!stateRow) return;

        // Idempotency: only process if state is queued or in_progress.
        if (stateRow.state !== "queued" && stateRow.state !== "in_progress") {
            return;
        }

        if (args.eventType === "call_started") {
            await ctx.db.patch(stateRow._id, { state: "in_progress" });
            return;
        }

        // call_ended or call_analyzed — route based on outcome.
        if (args.eventType !== "call_ended" && args.eventType !== "call_analyzed") {
            return;
        }

        const outcome = args.outcome;
        const campaign = await ctx.db.get(args.campaignId);
        const now = Date.now();

        // Increment counters.
        const newAttempts = stateRow.attempts_in_campaign + 1;
        let newNoAnswerCount = stateRow.no_answer_or_voicemail_count;
        if (outcome === "no_answer" || outcome === "voicemail_left") {
            newNoAnswerCount += 1;
        }

        const baseUpdates: Partial<Doc<"outreachCampaignLeadStates">> = {
            attempts_in_campaign: newAttempts,
            no_answer_or_voicemail_count: newNoAnswerCount,
            last_attempt_at: now,
            last_outcome: outcome,
            active_call_id: undefined,
        };

        // Terminal blocked.
        if (outcome === "do_not_call" || outcome === "wrong_number") {
            await ctx.db.patch(stateRow._id, {
                ...baseUpdates,
                state: "terminal_blocked",
                next_action_at_ms: undefined,
            });
            return;
        }

        const routeRule = campaign?.outcome_routing?.find(
            (rule) => rule.outcome === outcome,
        );
        const campaignLeadAction =
            routeRule?.campaign_lead_action ??
            getDefaultCampaignLeadAction(outcome);

        if (campaignLeadAction === "stop_calling") {
            await ctx.db.patch(stateRow._id, {
                ...baseUpdates,
                state: "done",
                next_action_at_ms: undefined,
            });
            return;
        }

        if (campaignLeadAction === "pause_for_realtor") {
            await ctx.db.patch(stateRow._id, {
                ...baseUpdates,
                state: "paused_for_realtor",
                next_action_at_ms: undefined,
            });
            return;
        }

        // SMS threshold check.
        const smsEnabled = campaign?.follow_up_sms?.enabled === true;
        if (
            (outcome === "no_answer" || outcome === "voicemail_left") &&
            newNoAnswerCount >= 3 &&
            smsEnabled
        ) {
            await ctx.db.patch(stateRow._id, {
                ...baseUpdates,
                state: "sms_pending",
                next_action_at_ms: undefined,
            });
            // SMS dispatch is handled by the existing queueFollowUpSmsAfterFinalOutcome flow.
            return;
        }

        // Default: cooldown with retry.
        const maxAttempts = campaign?.retry_policy.max_attempts ?? 3;
        if (newAttempts >= maxAttempts) {
            await ctx.db.patch(stateRow._id, {
                ...baseUpdates,
                state: "done",
                next_action_at_ms: undefined,
            });
            return;
        }

        const cooldownMs =
            (campaign?.retry_policy.min_minutes_between_attempts ?? 60) * 60 * 1000;
        const nextActionAtMs = now + cooldownMs;
        await ctx.db.patch(stateRow._id, {
            ...baseUpdates,
            state: "cooldown",
            next_action_at_ms: nextActionAtMs,
        });

        // Schedule evaluation at cooldown expiry.
        await ctx.scheduler.runAt(
            nextActionAtMs,
            internal.outreach.campaignLeadState.evaluateCampaignLeadState,
            { stateId: stateRow._id },
        );
    },
});

// ---------------------------------------------------------------------------
// SMS completion transition
// ---------------------------------------------------------------------------

export const transitionStateOnSmsComplete = internalMutation({
    args: {
        campaign_id: v.id("outreachCampaigns"),
        lead_id: v.id("leads"),
    },
    handler: async (ctx, args) => {
        const stateRow = await ctx.db
            .query("outreachCampaignLeadStates")
            .withIndex("by_campaign_id_and_lead_id", (q) =>
                q.eq("campaign_id", args.campaign_id).eq("lead_id", args.lead_id),
            )
            .first();
        if (!stateRow || stateRow.state !== "sms_pending") return;

        const campaign = await ctx.db.get(args.campaign_id);
        const maxAttempts = campaign?.retry_policy.max_attempts ?? 3;

        if (stateRow.attempts_in_campaign >= maxAttempts) {
            await ctx.db.patch(stateRow._id, {
                state: "done",
                next_action_at_ms: undefined,
            });
            return;
        }

        // Move to cooldown with next retry window.
        const now = Date.now();
        const cooldownMs =
            (campaign?.retry_policy.min_minutes_between_attempts ?? 60) * 60 * 1000;
        const nextActionAtMs = now + cooldownMs;

        await ctx.db.patch(stateRow._id, {
            state: "cooldown",
            next_action_at_ms: nextActionAtMs,
        });

        await ctx.scheduler.runAt(
            nextActionAtMs,
            internal.outreach.campaignLeadState.evaluateCampaignLeadState,
            { stateId: stateRow._id },
        );
    },
});

// ---------------------------------------------------------------------------
// Dispatch error handling
// ---------------------------------------------------------------------------

export const handleDispatchError = internalMutation({
    args: {
        stateId: v.id("outreachCampaignLeadStates"),
        callId: v.id("outreachCalls"),
        transient: v.boolean(),
        error_message: v.string(),
    },
    handler: async (ctx, args) => {
        const stateRow = await ctx.db.get(args.stateId);
        if (!stateRow) return;

        // Ownership guard: if reconciliation already moved on to a new call,
        // this dispatch is stale — bail out to avoid overwriting new state.
        if (stateRow.active_call_id !== args.callId) return;

        if (args.transient) {
            // Transient: back to eligible with backoff, does NOT increment attempts.
            const retryAt = Date.now() + TRANSIENT_RETRY_BACKOFF_MS;
            await ctx.db.patch(stateRow._id, {
                state: "eligible",
                active_call_id: undefined,
                next_action_at_ms: retryAt,
                last_error: args.error_message,
            });
            await ctx.scheduler.runAt(
                retryAt,
                internal.outreach.campaignLeadState.evaluateCampaignLeadState,
                { stateId: stateRow._id },
            );
        } else {
            // Permanent: error state, requires user action.
            await ctx.db.patch(stateRow._id, {
                state: "error",
                active_call_id: undefined,
                next_action_at_ms: undefined,
                last_error: args.error_message,
            });
        }
    },
});

// ---------------------------------------------------------------------------
// User-facing manual actions
// ---------------------------------------------------------------------------

export const retryErrorState = mutation({
    args: {
        stateId: v.id("outreachCampaignLeadStates"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const stateRow = await ctx.db.get(args.stateId);
        if (!stateRow || stateRow.state !== "error") {
            throw new Error("State row not found or not in error state");
        }
        const campaign = await ctx.db.get(stateRow.campaign_id);
        if (!campaign || campaign.created_by_user_id !== userId) {
            throw new Error("Not found");
        }

        const now = Date.now();
        await ctx.db.patch(stateRow._id, {
            state: "eligible",
            last_error: undefined,
            next_action_at_ms: now,
        });

        await ctx.scheduler.runAt(
            now,
            internal.outreach.campaignLeadState.evaluateCampaignLeadState,
            { stateId: stateRow._id },
        );
    },
});

export const removeFromCampaign = mutation({
    args: {
        stateId: v.id("outreachCampaignLeadStates"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const stateRow = await ctx.db.get(args.stateId);
        if (!stateRow) {
            throw new Error("State row not found");
        }
        const campaign = await ctx.db.get(stateRow.campaign_id);
        if (!campaign || campaign.created_by_user_id !== userId) {
            throw new Error("Not found");
        }
        if (TERMINAL_STATES.has(stateRow.state)) {
            return; // Already terminal, nothing to do.
        }

        await ctx.db.patch(stateRow._id, {
            state: "done",
            next_action_at_ms: undefined,
            active_call_id: undefined,
        });
    },
});

// ---------------------------------------------------------------------------
// Reconciliation (watchdog cron handler)
// ---------------------------------------------------------------------------

export const reconcileDueCampaignLeadStates = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        let rescheduled = 0;
        let staleQueuedReset = 0;
        let staleInProgressReset = 0;
        let staleSmsReset = 0;

        // Pass 1: Due eligible/cooldown rows with a defined next_action_at_ms.
        const dueRows = await ctx.db
            .query("outreachCampaignLeadStates")
            .withIndex("by_next_action_at_ms")
            .filter((q) =>
                q.and(
                    q.neq(q.field("next_action_at_ms"), undefined),
                    q.lte(q.field("next_action_at_ms"), now),
                ),
            )
            .take(300);

        for (const row of dueRows) {
            if (row.state === "eligible" || row.state === "cooldown") {
                await ctx.scheduler.runAfter(
                    0,
                    internal.outreach.campaignLeadState.evaluateCampaignLeadState,
                    { stateId: row._id },
                );
                rescheduled++;
            }
        }

        // Pass 2: Potentially-stale active rows (next_action_at_ms === undefined).
        // Convex indexes sort undefined first, so this scan hits them immediately.
        const activeRows = await ctx.db
            .query("outreachCampaignLeadStates")
            .withIndex("by_next_action_at_ms")
            .filter((q) =>
                q.and(
                    q.eq(q.field("next_action_at_ms"), undefined),
                    q.or(
                        q.eq(q.field("state"), "queued"),
                        q.eq(q.field("state"), "in_progress"),
                        q.eq(q.field("state"), "sms_pending"),
                    ),
                ),
            )
            .take(200);

        for (const row of activeRows) {
            // Stale queued rows (> 20 min).
            if (row.state === "queued") {
                const referenceTime = row.active_call_id
                    ? ((await ctx.db.get(row.active_call_id))?.initiated_at ?? row._creationTime)
                    : row._creationTime;
                if (now - referenceTime > 20 * 60 * 1000) {
                    await ctx.db.patch(row._id, {
                        state: "eligible",
                        active_call_id: undefined,
                        next_action_at_ms: now,
                    });
                    await ctx.scheduler.runAfter(
                        0,
                        internal.outreach.campaignLeadState.evaluateCampaignLeadState,
                        { stateId: row._id },
                    );
                    staleQueuedReset++;
                }
                continue;
            }

            // Stale in_progress rows (> 2 hours).
            if (row.state === "in_progress") {
                let referenceTime = row._creationTime;
                if (row.active_call_id) {
                    const call = await ctx.db.get(row.active_call_id);
                    referenceTime = call?.started_at ?? call?.initiated_at ?? row._creationTime;
                }
                if (now - referenceTime > 2 * 60 * 60 * 1000) {
                    await ctx.db.patch(row._id, {
                        state: "eligible",
                        active_call_id: undefined,
                        next_action_at_ms: now,
                    });
                    await ctx.scheduler.runAfter(
                        0,
                        internal.outreach.campaignLeadState.evaluateCampaignLeadState,
                        { stateId: row._id },
                    );
                    staleInProgressReset++;
                }
                continue;
            }

            // Stale sms_pending rows (> 15 min).
            if (row.state === "sms_pending") {
                const referenceTime = row.last_attempt_at ?? row._creationTime;
                if (now - referenceTime > 15 * 60 * 1000) {
                    await ctx.db.patch(row._id, {
                        state: "cooldown",
                        next_action_at_ms: now,
                    });
                    await ctx.scheduler.runAfter(
                        0,
                        internal.outreach.campaignLeadState.evaluateCampaignLeadState,
                        { stateId: row._id },
                    );
                    staleSmsReset++;
                }
            }
        }

        return {
            rescheduled,
            staleQueuedReset,
            staleInProgressReset,
            staleSmsReset,
        };
    },
});
