/**
 * Shared auth helpers for leads, outreach, and other modules.
 */

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

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

export async function requireLeadOwner(
    ctx: MutationCtx | QueryCtx,
    leadId: Id<"leads">,
): Promise<{ userId: Id<"users">; lead: Doc<"leads"> }> {
    const userId = await getCurrentUserIdOrThrow(ctx);
    const lead = await ctx.db.get(leadId);
    if (!lead || lead.created_by_user_id !== userId) {
        throw new Error("Lead not found");
    }
    return { userId, lead };
}
