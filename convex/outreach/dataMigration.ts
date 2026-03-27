/**
 * One-time data migration to reset outreach data for the state-driven cutover.
 *
 * Since there are no production users, this deletes all outreach runtime data
 * and resets campaigns to draft status.
 *
 * Run manually via Convex Dashboard once.
 */

import { internalMutation } from "../_generated/server";

export const resetOutreachData = internalMutation({
    args: {},
    handler: async (ctx) => {
        let deletedCalls = 0;
        let deletedWebhookEvents = 0;
        let deletedSmsMessages = 0;
        let deletedStateRows = 0;
        let resetCampaigns = 0;

        // Delete all outreachCalls in batches.
        const calls = await ctx.db.query("outreachCalls").take(500);
        for (const call of calls) {
            await ctx.db.delete(call._id);
            deletedCalls++;
        }

        // Delete all outreachWebhookEvents in batches.
        const webhookEvents = await ctx.db
            .query("outreachWebhookEvents")
            .take(500);
        for (const event of webhookEvents) {
            await ctx.db.delete(event._id);
            deletedWebhookEvents++;
        }

        // Delete all outreachSmsMessages in batches.
        const smsMessages = await ctx.db
            .query("outreachSmsMessages")
            .take(500);
        for (const sms of smsMessages) {
            await ctx.db.delete(sms._id);
            deletedSmsMessages++;
        }

        // Delete all outreachCampaignLeadStates in batches.
        const stateRows = await ctx.db
            .query("outreachCampaignLeadStates")
            .take(500);
        for (const row of stateRows) {
            await ctx.db.delete(row._id);
            deletedStateRows++;
        }

        // Reset all campaigns to draft.
        const campaigns = await ctx.db
            .query("outreachCampaigns")
            .collect();
        for (const campaign of campaigns) {
            if (campaign.status !== "draft") {
                await ctx.db.patch(campaign._id, {
                    status: "draft",
                    updated_at: Date.now(),
                });
                resetCampaigns++;
            }
        }

        const hasMore =
            deletedCalls >= 500 ||
            deletedWebhookEvents >= 500 ||
            deletedSmsMessages >= 500 ||
            deletedStateRows >= 500;

        return {
            deletedCalls,
            deletedWebhookEvents,
            deletedSmsMessages,
            deletedStateRows,
            resetCampaigns,
            hasMore,
            note: hasMore
                ? "Run again — some tables had more than 500 rows."
                : "All outreach data reset.",
        };
    },
});
