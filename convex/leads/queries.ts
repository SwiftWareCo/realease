import { query } from "../_generated/server";
import { v } from "convex/values";
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
