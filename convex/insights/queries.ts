import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getSupportedRegions as getSupportedRegionsFromSources } from "./sources";

type Region = { city: string; state?: string; country: string };

function buildRegionKey(region: Region) {
    return `${region.city.toLowerCase().replace(/\s+/g, "-")}-${region.state?.toLowerCase() || ""}-${region.country.toLowerCase()}`;
}

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
            const regions =
                user.marketRegions && user.marketRegions.length > 0
                    ? user.marketRegions
                    : user.marketRegion
                      ? [user.marketRegion]
                      : [];

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
 * Get insights for the current user's region
 */
export const getMyInsights = query({
    args: {
        category: v.optional(
            v.union(
                v.literal("home_prices"),
                v.literal("inventory"),
                v.literal("mortgage_rates"),
                v.literal("market_trend"),
                v.literal("new_construction"),
                v.literal("rental"),
            ),
        ),
        regionKeys: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        // Get current user
        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) =>
                q.eq("externalId", identity.subject),
            )
            .unique();

        const userRegions =
            user?.marketRegions && user.marketRegions.length > 0
                ? user.marketRegions
                : user?.marketRegion
                  ? [user.marketRegion]
                  : [];

        if (!user || userRegions.length === 0) {
            return null;
        }

        const regionsWithKeys = userRegions.map((region) => ({
            ...region,
            key: buildRegionKey(region),
        }));

        const allowedKeys = new Set(regionsWithKeys.map((r) => r.key));
        const requestedKeys =
            args.regionKeys && args.regionKeys.length > 0
                ? args.regionKeys.filter((key) => allowedKeys.has(key))
                : Array.from(allowedKeys);

        const insightBatches = await Promise.all(
            requestedKeys.map(async (regionKey) => {
                let insightsQuery = ctx.db
                    .query("marketInsights")
                    .withIndex("by_region", (q) =>
                        q.eq("regionKey", regionKey),
                    );

                if (args.category) {
                    const category = args.category;
                    insightsQuery = ctx.db
                        .query("marketInsights")
                        .withIndex("by_region_category", (q) =>
                            q
                                .eq("regionKey", regionKey)
                                .eq("category", category),
                        );
                }

                return await insightsQuery.order("desc").take(50);
            }),
        );

        const insights = insightBatches.flat();

        // Group by category for easier UI consumption
        const grouped = insights.reduce(
            (acc, insight) => {
                if (!acc[insight.category]) {
                    acc[insight.category] = [];
                }
                acc[insight.category].push(insight);
                return acc;
            },
            {} as Record<string, typeof insights>,
        );

        return {
            regions: regionsWithKeys,
            insights: grouped,
            lastUpdated:
                insights.length > 0
                    ? Math.max(...insights.map((i) => i.fetchedAt))
                    : null,
        };
    },
});

/**
 * Get recent insights across all categories for a region
 */
export const getRegionInsights = query({
    args: {
        city: v.string(),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
    },
    handler: async (ctx, { city, state, country = "CA" }) => {
        const regionKey = buildRegionKey({ city, state, country });

        const insights = await ctx.db
            .query("marketInsights")
            .withIndex("by_region", (q) => q.eq("regionKey", regionKey))
            .order("desc")
            .take(20);

        return {
            region: { city, state, country },
            insights,
        };
    },
});

/**
 * Get available categories for user's region
 */
export const getAvailableCategories = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) =>
                q.eq("externalId", identity.subject),
            )
            .unique();

        const userRegions =
            user?.marketRegions && user.marketRegions.length > 0
                ? user.marketRegions
                : user?.marketRegion
                  ? [user.marketRegion]
                  : [];

        if (!user || userRegions.length === 0) {
            return [];
        }

        const regionKeys = userRegions.map((region) => buildRegionKey(region));

        const insightBatches = await Promise.all(
            regionKeys.map((regionKey) =>
                ctx.db
                    .query("marketInsights")
                    .withIndex("by_region", (q) => q.eq("regionKey", regionKey))
                    .collect(),
            ),
        );

        const insights = insightBatches.flat();
        return [...new Set(insights.map((i) => i.category))];
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

        const regions =
            user.marketRegions && user.marketRegions.length > 0
                ? user.marketRegions
                : user.marketRegion
                  ? [user.marketRegion]
                  : [];

        return {
            regions,
            interests: user.marketInterests,
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
