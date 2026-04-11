import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DataCtx = QueryCtx | MutationCtx;

export type LatestCampaignCallSnapshot = Pick<
    Doc<"outreachCalls">,
    | "_id"
    | "lead_id"
    | "campaign_id"
    | "call_status"
    | "initiated_at"
    | "outcome"
>;

export async function getLatestCampaignCallSnapshot(
    ctx: DataCtx,
    args: {
        campaignId: Id<"outreachCampaigns">;
        leadId: Id<"leads">;
    },
): Promise<LatestCampaignCallSnapshot | null> {
    return await ctx.db
        .query("outreachCalls")
        .withIndex("by_campaign_id_and_lead_id_and_initiated_at", (q) =>
            q.eq("campaign_id", args.campaignId).eq("lead_id", args.leadId),
        )
        .order("desc")
        .first();
}

export async function getLatestCampaignCallSnapshotsByLeadId(
    ctx: DataCtx,
    args: {
        campaignId: Id<"outreachCampaigns">;
        leadIds: Id<"leads">[];
    },
): Promise<Map<string, LatestCampaignCallSnapshot>> {
    const latestByLeadId = new Map<string, LatestCampaignCallSnapshot>();
    const uniqueLeadIds = Array.from(new Set(args.leadIds));

    for (const leadId of uniqueLeadIds) {
        const latestCall = await getLatestCampaignCallSnapshot(ctx, {
            campaignId: args.campaignId,
            leadId,
        });
        if (latestCall) {
            latestByLeadId.set(String(leadId), latestCall);
        }
    }

    return latestByLeadId;
}
