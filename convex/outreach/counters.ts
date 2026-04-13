import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";

/**
 * Counts rows in `outreachCampaignLeadStates` grouped by campaign and state.
 * Read a single state bucket with `count(ctx, { namespace: campaignId, bounds: { prefix: [state] } })`.
 */
export const outreachStateCounts = new TableAggregate<{
    Namespace: Id<"outreachCampaigns">;
    Key: string;
    DataModel: DataModel;
    TableName: "outreachCampaignLeadStates";
}>(components.outreachStateCounts, {
    namespace: (doc) => doc.campaign_id,
    sortKey: (doc) => doc.state,
});

/**
 * Counts rows in `outreachCalls` grouped by campaign and outcome.
 * Only campaign-linked calls are aggregated (calls without a `campaign_id` are ignored
 * by the wrapper functions below).
 */
export const outreachCallOutcomeCounts = new TableAggregate<{
    Namespace: Id<"outreachCampaigns">;
    Key: string;
    DataModel: DataModel;
    TableName: "outreachCalls";
}>(components.outreachCallOutcomeCounts, {
    namespace: (doc) => {
        if (!doc.campaign_id) {
            throw new Error(
                "outreachCallOutcomeCounts requires a campaign_id on every aggregated doc",
            );
        }
        return doc.campaign_id;
    },
    sortKey: (doc) => doc.outcome ?? "__none__",
});
