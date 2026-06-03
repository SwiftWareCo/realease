import { defineTable } from "convex/server";
import { v } from "convex/values";

export const tasksTable = defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    due_at: v.optional(v.number()),
    status: v.union(v.literal("open"), v.literal("dismissed")),
    created_by_user_id: v.id("users"),
    created_at: v.number(),
    updated_at: v.number(),
    dismissed_at: v.optional(v.number()),
})
    .index("by_created_by_user_id", ["created_by_user_id"])
    .index("by_created_by_user_id_and_status", [
        "created_by_user_id",
        "status",
    ])
    .index("by_created_by_user_id_and_status_and_due_at", [
        "created_by_user_id",
        "status",
        "due_at",
    ]);
