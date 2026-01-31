import { query } from "../_generated/server";
import { v } from "convex/values";

export const getAllLeads = query({
    args: {},
    handler: async (ctx) => {
        const leads = await ctx.db.query("leads").order("desc").collect();
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
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_status", (q) => q.eq("status", args.status))
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
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_source", (q) => q.eq("source", args.source))
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
        const lead = await ctx.db.get(args.id);
        return lead;
    },
});

export const getBuyerLeads = query({
    args: {},
    handler: async (ctx) => {
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_lead_type", (q) => q.eq("lead_type", "buyer"))
            .order("desc")
            .collect();
        return leads;
    },
});

export const getSellerLeads = query({
    args: {},
    handler: async (ctx) => {
        const leads = await ctx.db
            .query("leads")
            .withIndex("by_lead_type", (q) => q.eq("lead_type", "seller"))
            .order("desc")
            .collect();
        return leads;
    },
});

// Get all unique tags across all leads for filter dropdown
export const getAllTags = query({
    args: {},
    handler: async (ctx) => {
        const leads = await ctx.db.query("leads").collect();
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

