/**
 * Shared auth helpers for outreach mutations, queries, and actions.
 */

import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";

export async function getCurrentUserIdOrThrow(
    ctx: MutationCtx | QueryCtx,
): Promise<Id<"users">> {
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

    return user._id;
}

export async function requireCampaignOwner(
    ctx: MutationCtx | QueryCtx,
    campaignId: Id<"outreachCampaigns">,
): Promise<{ userId: Id<"users">; campaign: Doc<"outreachCampaigns"> }> {
    const userId = await getCurrentUserIdOrThrow(ctx);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign || campaign.created_by_user_id !== userId) {
        throw new Error("Campaign not found");
    }
    return { userId, campaign };
}

/**
 * Internal query usable from actions via ctx.runQuery to validate
 * that the calling user owns the given campaign.
 */
export const validateCampaignOwnership = internalQuery({
    args: { campaignId: v.id("outreachCampaigns") },
    handler: async (ctx, args) => {
        const { userId, campaign } = await requireCampaignOwner(ctx, args.campaignId);
        return { userId, campaignId: campaign._id };
    },
});
