import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { marketRegionSchema } from "./user.schema";
import { getSupportedRegions } from "../insights/sources";

function buildRegionKey(region: {
    city: string;
    state?: string;
    country: string;
}) {
    return `${region.city.toLowerCase().replace(/\s+/g, "-")}-${region.state?.toLowerCase() || ""}-${region.country.toLowerCase()}`;
}

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

        const allowedRegionKeys = new Set(
            getSupportedRegions().map((region) => region.key),
        );
        const invalidRegion = args.regions.find(
            (region) => !allowedRegionKeys.has(buildRegionKey(region)),
        );
        if (invalidRegion) {
            const regionLabel = invalidRegion.state
                ? `${invalidRegion.city}, ${invalidRegion.state}`
                : invalidRegion.city;
            throw new Error(`Unsupported region: ${regionLabel}`);
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
                v.literal("inventory"),
                v.literal("mortgage_rates"),
                v.literal("market_trend"),
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
            marketInterests: Array.from(new Set(args.interests)),
        });

        return { success: true };
    },
});

/**
 * Remove unsupported legacy market interest values from stored user docs.
 * Run once before narrowing the marketInterest schema.
 */
export const sanitizeLegacyMarketInterests = internalMutation({
    args: {},
    returns: v.object({
        processedUsers: v.number(),
        updatedUsers: v.number(),
        removedValues: v.number(),
    }),
    handler: async (ctx) => {
        const supportedInterests = new Set([
            "home_prices",
            "inventory",
            "mortgage_rates",
            "market_trend",
        ]);

        let processedUsers = 0;
        let updatedUsers = 0;
        let removedValues = 0;

        for await (const user of ctx.db.query("users")) {
            processedUsers += 1;
            const existing = user.marketInterests ?? [];
            if (existing.length === 0) {
                continue;
            }

            const sanitized = Array.from(
                new Set(
                    existing.filter((value) => supportedInterests.has(value)),
                ),
            );

            const removedForUser = existing.length - sanitized.length;
            if (removedForUser <= 0) {
                continue;
            }

            await ctx.db.patch(user._id, {
                marketInterests: sanitized,
            });
            updatedUsers += 1;
            removedValues += removedForUser;
        }

        return {
            processedUsers,
            updatedUsers,
            removedValues,
        };
    },
});
