import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentUserIdOrThrow } from "../auth";
import {
    outreachCallOutcomeCounts,
    outreachStateCounts,
} from "../outreach/counters";

type Priority = "urgent" | "high" | "normal" | "low";
type WorkSource = "lead" | "outreach" | "pipeline" | "calendar" | "task";
type WorkKind =
    | "manual_task"
    | "new_lead"
    | "callback"
    | "qualified_handoff"
    | "campaign_problem"
    | "pipeline_gap"
    | "calendar_event";

type WorkItem = {
    id: string;
    kind: WorkKind;
    source: WorkSource;
    priority: Priority;
    title: string;
    description: string;
    dueAt: number | null;
    href: string;
    actionLabel: string;
    lead: {
        _id: Id<"leads">;
        name: string;
        phone: string;
        intent: Doc<"leads">["intent"];
        status: Doc<"leads">["status"];
    } | null;
    campaign: {
        _id: Id<"outreachCampaigns">;
        name: string;
        status: Doc<"outreachCampaigns">["status"];
    } | null;
    call: {
        _id: Id<"outreachCalls">;
        outcome: Doc<"outreachCalls">["outcome"] | null;
        status: Doc<"outreachCalls">["call_status"];
        initiatedAt: number;
    } | null;
    task: {
        _id: Id<"tasks">;
        status: Doc<"tasks">["status"];
    } | null;
};

const PRIORITY_WEIGHT: Record<Priority, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
};

const OUTREACH_PROBLEM_OUTCOMES = new Set<
    NonNullable<Doc<"outreachCalls">["outcome"]>
>([
    "failed",
    "wrong_number",
]);

function startOfLocalDay(now: number) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function formatOutcome(outcome: Doc<"outreachCalls">["outcome"] | null) {
    if (!outcome) {
        return "outreach update";
    }
    return outcome.replace(/_/g, " ");
}

function leadContext(lead: Doc<"leads"> | null | undefined): WorkItem["lead"] {
    if (!lead) {
        return null;
    }
    return {
        _id: lead._id,
        name: lead.name,
        phone: lead.phone,
        intent: lead.intent,
        status: lead.status,
    };
}

function campaignContext(
    campaign: Doc<"outreachCampaigns"> | null | undefined,
): WorkItem["campaign"] {
    if (!campaign) {
        return null;
    }
    return {
        _id: campaign._id,
        name: campaign.name,
        status: campaign.status,
    };
}

function callContext(call: Doc<"outreachCalls">): WorkItem["call"] {
    return {
        _id: call._id,
        outcome: call.outcome ?? null,
        status: call.call_status,
        initiatedAt: call.initiated_at,
    };
}

function taskContext(task: Doc<"tasks">): WorkItem["task"] {
    return {
        _id: task._id,
        status: task.status,
    };
}

function leadHref(leadId: Id<"leads"> | null | undefined) {
    return leadId ? `/leads/${leadId}` : "/leads/network";
}

function campaignHref(campaignId: Id<"outreachCampaigns"> | null | undefined) {
    return campaignId ? `/leads/outreach/${campaignId}` : "/leads/outreach";
}

function callHref(call: Doc<"outreachCalls">) {
    if (call.campaign_id) {
        return `/leads/outreach/${call.campaign_id}/calls/${call._id}`;
    }
    return leadHref(call.lead_id);
}

function readCallbackDueAt(call: Doc<"outreachCalls">) {
    const extracted = call.extracted_data;
    if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
        return call.initiated_at;
    }

    const record = extracted as Record<string, unknown>;
    const candidates = [
        "callback_at",
        "callback_time",
        "callbackDateTime",
        "callback_date_time",
        "requested_callback_at",
    ];

    for (const key of candidates) {
        const value = record[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === "string") {
            const parsed = Date.parse(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    return call.initiated_at;
}

function derivePipelineGap(lead: Doc<"leads">) {
    if (lead.status !== "qualified") {
        return null;
    }
    if (!lead.lead_type) {
        return {
            title: `Assign ${lead.name} to buyer or seller pipeline`,
            description:
                "This qualified lead needs a business track before it can move forward.",
        };
    }
    if (lead.lead_type === "buyer" && !lead.buyer_pipeline_stage) {
        return {
            title: `Set buyer stage for ${lead.name}`,
            description:
                "This buyer is qualified but has not entered the buyer pipeline.",
        };
    }
    if (lead.lead_type === "seller" && !lead.seller_pipeline_stage) {
        return {
            title: `Set seller stage for ${lead.name}`,
            description:
                "This seller is qualified but has not entered the seller pipeline.",
        };
    }
    return null;
}

function putWorkItem(itemsById: Map<string, WorkItem>, item: WorkItem) {
    const existing = itemsById.get(item.id);
    if (
        !existing ||
        PRIORITY_WEIGHT[item.priority] < PRIORITY_WEIGHT[existing.priority]
    ) {
        itemsById.set(item.id, item);
    }
}

function sortWorkItems(items: WorkItem[]) {
    return items.sort((a, b) => {
        const priorityDelta =
            PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        if (priorityDelta !== 0) {
            return priorityDelta;
        }
        const aDue = a.dueAt ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.dueAt ?? Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) {
            return aDue - bDue;
        }
        return a.title.localeCompare(b.title);
    });
}

export const getDashboardHome = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const now = Date.now();
        const todayStart = startOfLocalDay(now);
        const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
        const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;

        const [
            leads,
            campaigns,
            ownedEvents,
            legacyEventCandidates,
            manualTasks,
        ] = await Promise.all([
                ctx.db
                    .query("leads")
                    .withIndex("by_created_by_user_id", (q) =>
                        q.eq("created_by_user_id", userId),
                    )
                    .order("desc")
                    .take(250),
                ctx.db
                    .query("outreachCampaigns")
                    .withIndex("by_created_by_user_id", (q) =>
                        q.eq("created_by_user_id", userId),
                    )
                    .order("desc")
                    .take(100),
                ctx.db
                    .query("events")
                    .withIndex("by_created_by_user_id_and_start_time", (q) =>
                        q
                            .eq("created_by_user_id", userId)
                            .gte("start_time", now)
                            .lte("start_time", sevenDaysFromNow),
                    )
                    .order("asc")
                    .take(30),
                ctx.db
                    .query("events")
                    .withIndex("by_start_time", (q) =>
                        q.gte("start_time", now).lte("start_time", sevenDaysFromNow),
                    )
                    .order("asc")
                    .take(30),
                ctx.db
                    .query("tasks")
                    .withIndex("by_created_by_user_id_and_status_and_due_at", (q) =>
                        q.eq("created_by_user_id", userId).eq("status", "open"),
                    )
                    .order("asc")
                    .take(50),
            ]);

        const leadsById = new Map(leads.map((lead) => [String(lead._id), lead]));
        const eventsById = new Map(
            ownedEvents.map((event) => [String(event._id), event]),
        );
        for (const event of legacyEventCandidates) {
            if (event.created_by_user_id || !event.lead_id) {
                continue;
            }
            if (leadsById.has(String(event.lead_id))) {
                eventsById.set(String(event._id), event);
            }
        }
        const events = Array.from(eventsById.values()).sort(
            (a, b) => a.start_time - b.start_time,
        );
        const itemsById = new Map<string, WorkItem>();

        const campaignRollups = await Promise.all(
            campaigns.map(async (campaign) => {
                const namespace = campaign._id;
                const [
                    eligible,
                    queued,
                    inProgress,
                    cooldown,
                    smsPending,
                    pausedForReview,
                    errorState,
                    interested,
                    callbacks,
                    failed,
                    wrongNumber,
                    recentCalls,
                    reviewRows,
                    errorRows,
                ] = await Promise.all([
                    outreachStateCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "eligible" },
                    }),
                    outreachStateCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "queued" },
                    }),
                    outreachStateCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "in_progress" },
                    }),
                    outreachStateCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "cooldown" },
                    }),
                    outreachStateCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "sms_pending" },
                    }),
                    outreachStateCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "paused_for_realtor" },
                    }),
                    outreachStateCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "error" },
                    }),
                    outreachCallOutcomeCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "connected_interested" },
                    }),
                    outreachCallOutcomeCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "callback_requested" },
                    }),
                    outreachCallOutcomeCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "failed" },
                    }),
                    outreachCallOutcomeCounts.count(ctx, {
                        namespace,
                        bounds: { eq: "wrong_number" },
                    }),
                    ctx.db
                        .query("outreachCalls")
                        .withIndex("by_campaign_id_and_initiated_at", (q) =>
                            q.eq("campaign_id", campaign._id),
                        )
                        .order("desc")
                        .take(40),
                    ctx.db
                        .query("outreachCampaignLeadStates")
                        .withIndex("by_campaign_id_and_state", (q) =>
                            q
                                .eq("campaign_id", campaign._id)
                                .eq("state", "paused_for_realtor"),
                        )
                        .take(8),
                    ctx.db
                        .query("outreachCampaignLeadStates")
                        .withIndex("by_campaign_id_and_state", (q) =>
                            q.eq("campaign_id", campaign._id).eq("state", "error"),
                        )
                        .take(5),
                ]);

                for (const call of recentCalls) {
                    const lead = leadsById.get(String(call.lead_id)) ?? null;
                    if (!lead) {
                        continue;
                    }
                    if (call.outcome === "callback_requested") {
                        const dueAt = readCallbackDueAt(call);
                        putWorkItem(itemsById, {
                            id: `callback:${call._id}`,
                            kind: "callback",
                            source: "outreach",
                            priority: dueAt <= now ? "urgent" : "high",
                            title: `Call back ${lead.name}`,
                            description:
                                call.summary ??
                                call.outcome_reason ??
                                `Callback requested from ${campaign.name}.`,
                            dueAt,
                            href: callHref(call),
                            actionLabel: "Open call report",
                            lead: leadContext(lead),
                            campaign: campaignContext(campaign),
                            call: callContext(call),
                            task: null,
                        });
                    } else if (call.outcome === "connected_interested") {
                        putWorkItem(itemsById, {
                            id: `handoff:${call._id}`,
                            kind: "qualified_handoff",
                            source: "outreach",
                            priority: "high",
                            title: `Follow up with ${lead.name}`,
                            description:
                                call.summary ??
                                "Outreach found an interested lead that needs realtor action.",
                            dueAt: call.initiated_at,
                            href: callHref(call),
                            actionLabel: "Review handoff",
                            lead: leadContext(lead),
                            campaign: campaignContext(campaign),
                            call: callContext(call),
                            task: null,
                        });
                    } else if (
                        call.call_status === "failed" ||
                        (call.outcome && OUTREACH_PROBLEM_OUTCOMES.has(call.outcome))
                    ) {
                        putWorkItem(itemsById, {
                            id: `problem:${call._id}`,
                            kind: "campaign_problem",
                            source: "outreach",
                            priority: call.outcome === "failed" ? "high" : "normal",
                            title: `Review ${formatOutcome(call.outcome ?? "failed")}`,
                            description:
                                call.error_message ??
                                call.outcome_reason ??
                                `A campaign issue needs review for ${lead.name}.`,
                            dueAt: call.ended_at ?? call.initiated_at,
                            href: callHref(call),
                            actionLabel: "Open issue",
                            lead: leadContext(lead),
                            campaign: campaignContext(campaign),
                            call: callContext(call),
                            task: null,
                        });
                    }
                }

                for (const row of reviewRows) {
                    const lead = leadsById.get(String(row.lead_id)) ?? null;
                    if (!lead) {
                        continue;
                    }
                    putWorkItem(itemsById, {
                        id: `review:${campaign._id}:${row.lead_id}`,
                        kind: "qualified_handoff",
                        source: "outreach",
                        priority: "high",
                        title: `Review outreach pause for ${lead.name}`,
                        description:
                            row.last_outcome !== undefined
                                ? `Campaign paused after ${formatOutcome(row.last_outcome)}.`
                                : "Campaign paused for realtor review.",
                        dueAt: row.last_attempt_at ?? campaign.updated_at,
                        href: campaignHref(campaign._id),
                        actionLabel: "Open campaign",
                        lead: leadContext(lead),
                        campaign: campaignContext(campaign),
                        call: null,
                        task: null,
                    });
                }

                for (const row of errorRows) {
                    const lead = leadsById.get(String(row.lead_id)) ?? null;
                    putWorkItem(itemsById, {
                        id: `state-error:${campaign._id}:${row.lead_id}`,
                        kind: "campaign_problem",
                        source: "outreach",
                        priority: "normal",
                        title: lead
                            ? `Fix outreach state for ${lead.name}`
                            : "Fix outreach state",
                        description:
                            row.last_error ??
                            "The campaign scheduler hit an error for this lead.",
                        dueAt: row.last_attempt_at ?? campaign.updated_at,
                        href: campaignHref(campaign._id),
                        actionLabel: "Open campaign",
                        lead: leadContext(lead),
                        campaign: campaignContext(campaign),
                        call: null,
                        task: null,
                    });
                }

                const activeLeads =
                    eligible + queued + inProgress + cooldown + smsPending;
                return {
                    campaignId: campaign._id,
                    campaignName: campaign.name,
                    status: campaign.status,
                    href: campaignHref(campaign._id),
                    activeLeads,
                    pausedForReview,
                    interested,
                    callbacks,
                    problems: failed + wrongNumber + errorState,
                    lastActivityAt:
                        recentCalls[0]?.initiated_at ?? campaign.updated_at,
                };
            }),
        );

        for (const lead of leads) {
            if (lead.status === "new") {
                putWorkItem(itemsById, {
                    id: `new-lead:${lead._id}`,
                    kind: "new_lead",
                    source: "lead",
                    priority: lead.urgency_score >= 70 ? "high" : "normal",
                    title: `Make first contact with ${lead.name}`,
                    description: `${lead.intent} lead from ${lead.source} with urgency ${lead.urgency_score}/100.`,
                    dueAt: lead.created_at,
                    href: leadHref(lead._id),
                    actionLabel: "Open lead",
                    lead: leadContext(lead),
                    campaign: null,
                    call: null,
                    task: null,
                });
            }

            const pipelineGap = derivePipelineGap(lead);
            if (pipelineGap) {
                putWorkItem(itemsById, {
                    id: `pipeline-gap:${lead._id}`,
                    kind: "pipeline_gap",
                    source: "pipeline",
                    priority: "normal",
                    title: pipelineGap.title,
                    description: pipelineGap.description,
                    dueAt: lead.created_at,
                    href: leadHref(lead._id),
                    actionLabel: "Open lead",
                    lead: leadContext(lead),
                    campaign: null,
                    call: null,
                    task: null,
                });
            }
        }

        for (const task of manualTasks) {
            putWorkItem(itemsById, {
                id: `manual-task:${task._id}`,
                kind: "manual_task",
                source: "task",
                priority: task.due_at !== undefined && task.due_at <= now
                    ? "high"
                    : "normal",
                title: task.title,
                description: task.description ?? "Manual task",
                dueAt: task.due_at ?? null,
                href: "/",
                actionLabel: "Task",
                lead: null,
                campaign: null,
                call: null,
                task: taskContext(task),
            });
        }

        const visibleEvents = events
            .filter((event) => !event.is_completed)
            .slice(0, 8);
        const schedule = await Promise.all(
            visibleEvents.map(async (event) => {
                const lead = event.lead_id
                    ? leadsById.get(String(event.lead_id)) ??
                      (await ctx.db.get(event.lead_id))
                    : null;
                return {
                    _id: event._id,
                    title: event.title,
                    eventType: event.event_type,
                    startTime: event.start_time,
                    endTime: event.end_time,
                    location: event.location ?? null,
                    href: `/calendar?eventId=${event._id}`,
                    lead: leadContext(
                        lead?.created_by_user_id === userId ? lead : null,
                    ),
                };
            }),
        );

        for (const event of schedule.slice(0, 3)) {
            putWorkItem(itemsById, {
                id: `event:${event._id}`,
                kind: "calendar_event",
                source: "calendar",
                priority: event.startTime <= tomorrowStart ? "normal" : "low",
                title: event.title,
                description: event.lead
                    ? `${event.eventType.replace(/_/g, " ")} with ${event.lead.name}`
                    : event.eventType.replace(/_/g, " "),
                dueAt: event.startTime,
                href: event.href,
                actionLabel: "Open calendar",
                lead: event.lead,
                campaign: null,
                call: null,
                task: null,
            });
        }

        const sortedItems = sortWorkItems(Array.from(itemsById.values()));
        const personalTasks = sortedItems
            .filter((item) => item.kind === "manual_task")
            .slice(0, 12);
        const leadQueue = sortedItems
            .filter((item) => item.kind === "new_lead")
            .slice(0, 12);
        const pipelineGaps = sortedItems
            .filter((item) => item.kind === "pipeline_gap")
            .slice(0, 5);
        const outreachReviewItems = sortedItems.filter(
            (item) => item.source === "outreach",
        ).slice(0, 18);
        const newLeads = leads.filter((lead) => lead.status === "new").length;
        const qualifiedLeads = leads.filter(
            (lead) => lead.status === "qualified",
        ).length;

        const outreachSummary = campaignRollups.reduce(
            (summary, campaign) => {
                summary.activeCampaigns += campaign.status === "active" ? 1 : 0;
                summary.liveLeads += campaign.activeLeads;
                summary.callbacks += campaign.callbacks;
                summary.interested += campaign.interested;
                summary.pausedForReview += campaign.pausedForReview;
                summary.problems += campaign.problems;
                return summary;
            },
            {
                activeCampaigns: 0,
                liveLeads: 0,
                callbacks: 0,
                interested: 0,
                pausedForReview: 0,
                problems: 0,
            },
        );
        const campaignReviewCount =
            outreachSummary.callbacks +
            outreachSummary.interested +
            outreachSummary.pausedForReview +
            outreachSummary.problems;

        return {
            generatedAt: now,
            overview: {
                urgentCount: personalTasks.filter(
                    (item) => item.priority === "urgent",
                ).length,
                highPriorityCount: personalTasks.filter(
                    (item) => item.priority === "high",
                ).length,
                dueTodayCount: personalTasks.filter(
                    (item) => item.dueAt !== null && item.dueAt < tomorrowStart,
                ).length,
                campaignReviewCount,
                newLeads,
                qualifiedLeads,
                eventsToday: schedule.filter(
                    (event) =>
                        event.startTime >= todayStart &&
                        event.startTime < tomorrowStart,
                ).length,
            },
            workQueue: personalTasks,
            leadQueue,
            outreachReviewItems,
            schedule,
            outreach: {
                ...outreachSummary,
                campaigns: campaignRollups
                    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
                    .slice(0, 4),
            },
            pipelineGaps,
        };
    },
});
