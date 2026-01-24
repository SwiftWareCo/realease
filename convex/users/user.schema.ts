import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const usersTable = defineTable({
  externalId: v.string(),
  name: v.string(),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
})
  .index('by_external_id', ['externalId'])
  .index('by_email', ['email']);
