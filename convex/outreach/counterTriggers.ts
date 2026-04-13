import {
    customCtx,
    customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import {
    internalMutation as rawInternalMutation,
    mutation as rawMutation,
} from "../_generated/server";
import type { DataModel } from "../_generated/dataModel";
import {
    outreachCallOutcomeCounts,
    outreachStateCounts,
} from "./counters";

const triggers = new Triggers<DataModel>();

triggers.register(
    "outreachCampaignLeadStates",
    outreachStateCounts.idempotentTrigger(),
);

/**
 * Manual trigger for outreachCalls so we can skip rows without a campaign_id
 * (non-campaign ad-hoc calls are not part of the outcome aggregate).
 */
triggers.register("outreachCalls", async (ctx, change) => {
    if (change.operation === "insert") {
        if (!change.newDoc.campaign_id) return;
        await outreachCallOutcomeCounts.insertIfDoesNotExist(
            ctx,
            change.newDoc,
        );
        return;
    }
    if (change.operation === "update") {
        const oldHasCampaign = Boolean(change.oldDoc.campaign_id);
        const newHasCampaign = Boolean(change.newDoc.campaign_id);
        if (!oldHasCampaign && !newHasCampaign) return;
        if (!oldHasCampaign && newHasCampaign) {
            await outreachCallOutcomeCounts.insertIfDoesNotExist(
                ctx,
                change.newDoc,
            );
            return;
        }
        if (oldHasCampaign && !newHasCampaign) {
            await outreachCallOutcomeCounts.deleteIfExists(
                ctx,
                change.oldDoc,
            );
            return;
        }
        await outreachCallOutcomeCounts.replaceOrInsert(
            ctx,
            change.oldDoc,
            change.newDoc,
        );
        return;
    }
    if (change.operation === "delete") {
        if (!change.oldDoc.campaign_id) return;
        await outreachCallOutcomeCounts.deleteIfExists(ctx, change.oldDoc);
    }
});

export const mutationWithCounters = customMutation(
    rawMutation,
    customCtx(triggers.wrapDB),
);

export const internalMutationWithCounters = customMutation(
    rawInternalMutation,
    customCtx(triggers.wrapDB),
);
