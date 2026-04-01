import { defineTable } from "convex/server";
import { v } from "convex/values";

export const marketRegionSchema = v.object({
    city: v.string(),
    state: v.optional(v.string()),
    country: v.string(),
    zipCode: v.optional(v.string()),
});

export const marketInterestSchema = v.union(
    v.literal("home_prices"),
    v.literal("inventory"),
    v.literal("mortgage_rates"),
    v.literal("market_trend"),
);

export const usersTable = defineTable({
    externalId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),

    // Preferences
    marketRegions: v.optional(v.array(marketRegionSchema)),
    marketInterests: v.optional(v.array(marketInterestSchema)),
})
    .index("by_external_id", ["externalId"])
    .index("by_email", ["email"]);
