import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserIdOrThrow } from "../auth";

export const createTask = mutation({
    args: {
        title: v.string(),
        description: v.optional(v.string()),
        due_at: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const title = args.title.trim();
        if (!title) {
            throw new Error("Task title is required");
        }

        const description = args.description?.trim();
        const now = Date.now();
        return await ctx.db.insert("tasks", {
            title,
            description: description || undefined,
            due_at: args.due_at,
            status: "open",
            created_by_user_id: userId,
            created_at: now,
            updated_at: now,
        });
    },
});

export const dismissTask = mutation({
    args: {
        id: v.id("tasks"),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const task = await ctx.db.get(args.id);
        if (!task || task.created_by_user_id !== userId) {
            throw new Error("Task not found");
        }

        const now = Date.now();
        await ctx.db.patch(args.id, {
            status: "dismissed",
            dismissed_at: now,
            updated_at: now,
        });
        return args.id;
    },
});

export const updateTask = mutation({
    args: {
        id: v.id("tasks"),
        title: v.string(),
        description: v.optional(v.string()),
        due_at: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserIdOrThrow(ctx);
        const task = await ctx.db.get(args.id);
        if (!task || task.created_by_user_id !== userId) {
            throw new Error("Task not found");
        }

        const title = args.title.trim();
        if (!title) {
            throw new Error("Task title is required");
        }

        const description = args.description?.trim();
        await ctx.db.patch(args.id, {
            title,
            description: description || undefined,
            due_at: args.due_at,
            updated_at: Date.now(),
        });

        return args.id;
    },
});
