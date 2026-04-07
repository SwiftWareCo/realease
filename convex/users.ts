import { v } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";

export const current = query({
    args: {},
    handler: async (ctx) => {
        return await getCurrentUserRecord(ctx);
    },
});

export const upsertFromClerk = internalMutation({
    args: { data: v.any() },
    returns: v.null(),
    handler: async (ctx, args) => {
        const user = args.data;
        if (!user || typeof user !== "object") {
            return null;
        }

        const id = typeof user.id === "string" ? user.id : undefined;
        if (!id) {
            return null;
        }

        const firstName =
            typeof user.first_name === "string" ? user.first_name : "";
        const lastName =
            typeof user.last_name === "string" ? user.last_name : "";
        const name = `${firstName} ${lastName}`.trim();

        const emailAddresses = Array.isArray(user.email_addresses)
            ? user.email_addresses
            : [];
        const firstEmailAddress = emailAddresses[0];
        const email =
            firstEmailAddress &&
            typeof firstEmailAddress === "object" &&
            "email_address" in firstEmailAddress &&
            typeof firstEmailAddress.email_address === "string"
                ? firstEmailAddress.email_address
                : undefined;
        const imageUrl =
            typeof user.image_url === "string" ? user.image_url : undefined;

        const existing = await userByExternalId(ctx, id);

        if (existing) {
            await ctx.db.patch(existing._id, {
                name: name || "User",
                email,
                imageUrl,
            });
            return null;
        }

        await ctx.db.insert("users", {
            externalId: id,
            name: name || "User",
            email,
            imageUrl,
        });

        return null;
    },
});

export const deleteFromClerk = internalMutation({
    args: { clerkUserId: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await userByExternalId(ctx, args.clerkUserId);

        if (existing) {
            await ctx.db.delete(existing._id);
        }

        return null;
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
