import type { UserJSON } from "@clerk/backend";
import { v, type Validator } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";

export const current = query({
    args: {},
    handler: async (ctx) => {
        return await getCurrentUserRecord(ctx);
    },
});

export const upsertFromClerk = internalMutation({
    args: { data: v.any() as Validator<UserJSON> },
    handler: async (ctx, args) => {
        const user = args.data;
        const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
        const email = user.email_addresses?.[0]?.email_address ?? undefined;
        const imageUrl = user.image_url ?? undefined;

        const existing = await userByExternalId(ctx, user.id);

        if (existing) {
            await ctx.db.patch(existing._id, {
                name: name || "User",
                email,
                imageUrl,
            });
            return;
        }

        await ctx.db.insert("users", {
            externalId: user.id,
            name: name || "User",
            email,
            imageUrl,
        });
    },
});

export const deleteFromClerk = internalMutation({
    args: { clerkUserId: v.string() },
    handler: async (ctx, args) => {
        const existing = await userByExternalId(ctx, args.clerkUserId);

        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
    const user = await getCurrentUserRecord(ctx);
    if (!user) {
        throw new Error("Can't get current user");
    }
    return user;
}

async function getCurrentUserRecord(ctx: QueryCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        return null;
    }

    return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
    return await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .unique();
}
