import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { isValidPhoneNumber } from "./phone";

type EligibilityReason =
    | "invalid_phone"
    | "do_not_call"
    | "status_not_eligible"
    | "active_call_in_progress"
    | "max_attempts_reached"
    | "blocked_by_terminal_outcome";

type CampaignLeadCallStats = {
    attemptsInCampaign: number;
    hasActiveCall: boolean;
    latestOutcome?: Doc<"outreachCalls">["outcome"];
    latestInitiatedAt?: number;
};

const ACTIVE_CALL_STATUSES: ReadonlySet<Doc<"outreachCalls">["call_status"]> =
    new Set(["queued", "ringing", "in_progress"]);

function getSelectableReasons(
    lead: Doc<"leads">,
    stats: CampaignLeadCallStats | undefined,
    maxAttempts: number,
): EligibilityReason[] {
    const reasons: EligibilityReason[] = [];

    if (!isValidPhoneNumber(lead.phone)) {
        reasons.push("invalid_phone");
    }

    if (lead.do_not_call === true) {
        reasons.push("do_not_call");
    }

    if (lead.status !== "new" && lead.status !== "contacted") {
        reasons.push("status_not_eligible");
    }

    if (stats?.hasActiveCall) {
        reasons.push("active_call_in_progress");
    }

    if ((stats?.attemptsInCampaign ?? 0) >= maxAttempts) {
        reasons.push("max_attempts_reached");
    }

    if (
        stats?.latestOutcome === "do_not_call" ||
        stats?.latestOutcome === "wrong_number"
    ) {
        reasons.push("blocked_by_terminal_outcome");
    }

    return reasons;
}

export const getCampaignLeadPicker = query({
    args: {
        campaignId: v.id("outreachCampaigns"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }

        const maxAttempts = campaign.retry_policy.max_attempts;
        const calls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_campaign_id", (q) =>
                q.eq("campaign_id", args.campaignId),
            )
            .collect();

        const statsByLead = new Map<string, CampaignLeadCallStats>();
        for (const call of calls) {
            const leadKey = String(call.lead_id);
            const current = statsByLead.get(leadKey) ?? {
                attemptsInCampaign: 0,
                hasActiveCall: false,
            };

            current.attemptsInCampaign += 1;
            if (ACTIVE_CALL_STATUSES.has(call.call_status)) {
                current.hasActiveCall = true;
            }
            if (
                current.latestInitiatedAt === undefined ||
                call.initiated_at > current.latestInitiatedAt
            ) {
                current.latestInitiatedAt = call.initiated_at;
                current.latestOutcome = call.outcome;
            }

            statsByLead.set(leadKey, current);
        }

        const allLeads = await ctx.db.query("leads").order("desc").collect();
        const limit =
            args.limit !== undefined
                ? Math.max(1, Math.floor(args.limit))
                : undefined;
        const leads = limit !== undefined ? allLeads.slice(0, limit) : allLeads;

        const leadCandidates = leads.map((lead) => {
            const stats = statsByLead.get(String(lead._id));
            const reasons = getSelectableReasons(lead, stats, maxAttempts);
            const selectable = reasons.length === 0;

            return {
                leadId: lead._id,
                name: lead.name,
                phone: lead.phone,
                status: lead.status,
                doNotCall: lead.do_not_call ?? false,
                selectable,
                reasons,
                attemptsInCampaign: stats?.attemptsInCampaign ?? 0,
                latestCampaignOutcome: stats?.latestOutcome ?? null,
            };
        });

        return {
            campaignId: campaign._id,
            campaignName: campaign.name,
            maxAttempts,
            totalLeads: leadCandidates.length,
            selectableCount: leadCandidates.filter((lead) => lead.selectable)
                .length,
            leads: leadCandidates,
        };
    },
});

export const getCampaignsForPicker = query({
    args: {
        includeInactive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const campaigns = await ctx.db.query("outreachCampaigns").collect();
        const includeInactive = args.includeInactive ?? false;

        return campaigns
            .filter((campaign) => {
                if (includeInactive) {
                    return true;
                }
                return (
                    campaign.status !== "archived" &&
                    campaign.status !== "completed"
                );
            })
            .sort((a, b) => b.updated_at - a.updated_at)
            .map((campaign) => ({
                _id: campaign._id,
                name: campaign.name,
                description: campaign.description ?? null,
                status: campaign.status,
                timezone: campaign.timezone,
                retellAgentId: campaign.retell_agent_id,
                retellPhoneNumberId: campaign.retell_phone_number_id ?? null,
                twilioMessagingServiceSid:
                    campaign.twilio_messaging_service_sid ?? null,
                retryPolicy: campaign.retry_policy,
                callingWindow: campaign.calling_window,
                updatedAt: campaign.updated_at,
            }));
    },
});

export const getCampaignCallAttempts = query({
    args: {
        campaignId: v.id("outreachCampaigns"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }

        const take =
            args.limit !== undefined
                ? Math.max(1, Math.floor(args.limit))
                : 200;

        const calls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_campaign_id_and_initiated_at", (q) =>
                q.eq("campaign_id", args.campaignId),
            )
            .order("desc")
            .take(take);

        const leadsById = new Map<string, Doc<"leads"> | null>();
        for (const call of calls) {
            const key = String(call.lead_id);
            if (!leadsById.has(key)) {
                leadsById.set(key, await ctx.db.get(call.lead_id));
            }
        }

        const summary = {
            total: calls.length,
            queued: 0,
            ringing: 0,
            in_progress: 0,
            completed: 0,
            failed: 0,
            canceled: 0,
        };

        for (const call of calls) {
            summary[call.call_status] += 1;
        }

        return {
            campaign: {
                _id: campaign._id,
                name: campaign.name,
                status: campaign.status,
                timezone: campaign.timezone,
            },
            summary,
            calls: calls.map((call) => {
                const lead = leadsById.get(String(call.lead_id)) ?? null;
                return {
                    callId: call._id,
                    leadId: call.lead_id,
                    leadName: lead?.name ?? "Deleted lead",
                    leadPhone: lead?.phone ?? "Unknown",
                    callStatus: call.call_status,
                    retellCallId: call.retell_call_id ?? null,
                    initiatedAt: call.initiated_at,
                    startedAt: call.started_at ?? null,
                    endedAt: call.ended_at ?? null,
                    outcome: call.outcome ?? null,
                    errorMessage: call.error_message ?? null,
                };
            }),
        };
    },
});

export const getCampaignDispatchConfig = internalQuery({
    args: {
        campaignId: v.id("outreachCampaigns"),
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            throw new Error("Campaign not found");
        }

        return {
            campaignId: campaign._id,
            campaignName: campaign.name,
            retellAgentId: campaign.retell_agent_id,
            // Legacy field name kept in schema; value is used as outbound caller number.
            retellOutboundNumber: campaign.retell_phone_number_id ?? null,
        };
    },
});
