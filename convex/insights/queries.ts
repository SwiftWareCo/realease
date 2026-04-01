import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getSupportedRegions as getSupportedRegionsFromSources } from "./sources";

type Region = { city: string; state?: string; country: string };

/**
 * Get all unique regions from users with a region configured
 */
export const getActiveRegions = internalQuery({
    args: {},
    handler: async (ctx) => {
        const users = await ctx.db.query("users").collect();

        const activeRegions: Array<{ userId: Id<"users">; region: Region }> =
            [];

        for (const user of users) {
            const regions = user.marketRegions ?? [];

            for (const region of regions) {
                activeRegions.push({
                    userId: user._id,
                    region,
                });
            }
        }

        return activeRegions;
    },
});

/**
 * Get user's market preferences
 */
export const getUserPreferences = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) =>
                q.eq("externalId", identity.subject),
            )
            .unique();

        if (!user) {
            return null;
        }

        const regions = user.marketRegions ?? [];

        return {
            regions,
            interests: Array.from(new Set(user.marketInterests ?? [])),
        };
    },
});

export const getSupportedRegions = query({
    args: {},
    returns: v.array(
        v.object({
            city: v.string(),
            state: v.optional(v.string()),
            country: v.string(),
            key: v.string(),
        }),
    ),
    handler: async () => {
        return getSupportedRegionsFromSources();
    },
});
