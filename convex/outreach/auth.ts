/**
 * Outreach-specific auth helpers. Generic helpers re-exported from shared module.
 */

import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";

// Import for local use + re-export so existing imports don't break
import { getCurrentUserIdOrThrow } from "../auth";
export { getCurrentUserIdOrThrow };

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
