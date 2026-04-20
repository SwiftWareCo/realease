import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentUserIdOrThrow } from "../auth";

export const getAllLeads = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_created_by_user_id", (q) => q.eq("created_by_user_id", userId))
            .order("desc")
            .collect();
        return leads;
    },
});

export const getLeadsByStatus = query({
    args: {
        status: v.union(
            v.literal("new"),
            v.literal("contacted"),
            v.literal("qualified"),
        ),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_created_by_user_id", (q) => q.eq("created_by_user_id", userId))
            .filter((q) => q.eq(q.field("status"), args.status))
            .order("desc")
            .collect();
        return leads;
    },
});

export const getLeadsBySource = query({
    args: {
        source: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_created_by_user_id", (q) => q.eq("created_by_user_id", userId))
            .filter((q) => q.eq(q.field("source"), args.source))
            .order("desc")
            .collect();
        return leads;
    },
});

export const getLeadById = query({
    args: {
        id: v.id("leads"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const lead = await ctx.db.get(args.id);
        if (!lead || lead.created_by_user_id !== userId) {
            return null;
        }
        return lead;
    },
});

export const getBuyerLeads = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_created_by_user_id", (q) => q.eq("created_by_user_id", userId))
            .filter((q) => q.eq(q.field("lead_type"), "buyer"))
            .order("desc")
            .collect();
        return leads;
    },
});

export const getSellerLeads = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_created_by_user_id", (q) => q.eq("created_by_user_id", userId))
            .filter((q) => q.eq(q.field("lead_type"), "seller"))
            .order("desc")
            .collect();
        return leads;
    },
});

// Get all unique tags across current user's leads for filter dropdown
export const getAllTags = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_created_by_user_id", (q) => q.eq("created_by_user_id", userId))
            .collect();
        const tagSet = new Set<string>();
        for (const lead of leads) {
            if (lead.tags) {
                for (const tag of lead.tags) {
                    tagSet.add(tag);
                }
            }
        }
        return Array.from(tagSet).sort();
    },
});

export const getLeadNotes = query({
    args: {
        leadId: v.id("leads"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const lead = await ctx.db.get(args.leadId);
        if (!lead || lead.created_by_user_id !== userId) {
            return [];
        }

        const notes = await ctx.db
            .query("leadNotes")
            .withIndex("by_lead_id_and_created_at", (q) =>
                q.eq("lead_id", args.leadId),
            )
            .order("desc")
            .take(200);

        return notes;
    },
});

export const getLeadCommunicationHistory = query({
    args: {
        leadId: v.id("leads"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const lead = await ctx.db.get(args.leadId);
        if (!lead || lead.created_by_user_id !== userId) {
            return [];
        }

        const calls = await ctx.db
            .query("outreachCalls")
            .withIndex("by_lead_id", (q) => q.eq("lead_id", args.leadId))
            .order("desc")
            .take(120);
        const smsMessages = await ctx.db
            .query("outreachSmsMessages")
            .withIndex("by_lead_id_and_created_at", (q) =>
                q.eq("lead_id", args.leadId),
            )
            .order("desc")
            .take(200);

        const campaignIds = new Set<string>();
        for (const call of calls) {
            if (call.campaign_id) {
                campaignIds.add(String(call.campaign_id));
            }
        }
        for (const message of smsMessages) {
            if (message.campaign_id) {
                campaignIds.add(String(message.campaign_id));
            }
        }

        const campaignDocsById = new Map<string, Doc<"outreachCampaigns"> | null>();
        await Promise.all(
            Array.from(campaignIds).map(async (campaignId) => {
                campaignDocsById.set(
                    campaignId,
                    await ctx.db.get(campaignId as Id<"outreachCampaigns">),
                );
            }),
        );

        const items = [
            ...calls.map((call) => {
                const campaignName = call.campaign_id
                    ? campaignDocsById.get(String(call.campaign_id))?.name ?? null
                    : null;
                return {
                    id: `call:${String(call._id)}`,
                    type: "call" as const,
                    direction: "outbound" as const,
                    timestamp: call.initiated_at ?? call._creationTime,
                    campaignName,
                    campaignId: call.campaign_id ?? null,
                    status: call.call_status,
                    outcome: call.outcome ?? null,
                    summary: call.summary ?? null,
                    errorMessage: call.error_message ?? null,
                };
            }),
            ...smsMessages.map((message) => {
                const campaignName = message.campaign_id
                    ? campaignDocsById.get(String(message.campaign_id))?.name ?? null
                    : null;
                return {
                    id: `sms:${String(message._id)}`,
                    type: "sms" as const,
                    direction: message.direction,
                    timestamp:
                        message.sent_at ??
                        message.received_at ??
                        message.created_at,
                    campaignName,
                    campaignId: message.campaign_id ?? null,
                    status: message.status,
                    outcome: null,
                    summary: message.body,
                    errorMessage: message.error_message ?? null,
                };
            }),
        ];

        return items
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 220);
    },
});
