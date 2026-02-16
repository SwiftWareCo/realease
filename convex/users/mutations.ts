import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { marketRegionSchema } from "./user.schema";

/**
 * Update market regions (from settings)
 */
export const updateRegion = mutation({
    args: {
        regions: v.array(marketRegionSchema),
    },
    returns: v.object({ success: v.boolean() }),
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) =>
                q.eq("externalId", identity.subject),
            )
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        await ctx.db.patch(user._id, {
            marketRegions: args.regions,
        });

        return { success: true };
    },
});

/**
 * Update market interests
 */
export const updateInterests = mutation({
    args: {
        interests: v.array(
            v.union(
                v.literal("home_prices"),
                v.literal("inventory_levels"),
                v.literal("mortgage_rates"),
                v.literal("market_trends"),
                v.literal("new_construction"),
                v.literal("rental_market"),
            ),
        ),
    },
    returns: v.object({ success: v.boolean() }),
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) =>
                q.eq("externalId", identity.subject),
            )
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        await ctx.db.patch(user._id, {
            marketInterests: args.interests,
        });

        return { success: true };
    },
});
