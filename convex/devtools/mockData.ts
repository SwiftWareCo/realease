"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import type { FunctionReference } from "convex/server";

// Type-safe references to internal mutations
// We use 'as any' here because Convex's generated types don't expose internal mutation refs directly
// The runtime behavior is correct - this is just a TypeScript limitation for internal functions
const seedMockLeadsRef = "devtools/mockDataMutations:seedMockLeads" as unknown as FunctionReference<"mutation", "internal", { count: number; overrides?: Record<string, unknown> }, Promise<string[]>>;
const seedMockEventsRef = "devtools/mockDataMutations:seedMockEvents" as unknown as FunctionReference<"mutation", "internal", { count: number; leadIds: string[]; overrides?: Record<string, unknown> }, Promise<string[]>>;
const clearAllMockDataRef = "devtools/mockDataMutations:clearAllMockData" as unknown as FunctionReference<"mutation", "internal", Record<string, never>, Promise<{ leadsDeleted: number; eventsDeleted: number }>>;

export const seedData = action({
  args: {
    leads: v.optional(v.number()),
    events: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const leadCount = args.leads ?? 20;
    const eventCount = args.events ?? 10;
    
    console.log(`🌱 Seeding ${leadCount} mock leads...`);
    const leadIds = await ctx.runMutation(seedMockLeadsRef, {
      count: leadCount,
    });
    console.log(`✅ Created ${leadIds.length} leads`);
    
    console.log(`🌱 Seeding ${eventCount} mock events...`);
    const eventIds = await ctx.runMutation(seedMockEventsRef, {
      count: eventCount,
      leadIds,
    });
    console.log(`✅ Created ${eventIds.length} events`);
    
    return {
      leadsCreated: leadIds.length,
      eventsCreated: eventIds.length,
    };
  },
});

export const clearData = action({
  args: {
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error("Must pass confirm: true to clear all data");
    }
    
    console.log("🗑️  Clearing all mock data...");
    const result = await ctx.runMutation(clearAllMockDataRef, {});
    console.log(`✅ Deleted ${result.leadsDeleted} leads and ${result.eventsDeleted} events`);
    
    return result;
  },
});

export const resetData = action({
  args: {
    leads: v.optional(v.number()),
    events: v.optional(v.number()),
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error("Must pass confirm: true to reset all data");
    }
    
    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await ctx.runMutation(clearAllMockDataRef, {});
    
    // Seed new data
    const leadCount = args.leads ?? 20;
    const eventCount = args.events ?? 10;
    
    console.log(`🌱 Seeding ${leadCount} mock leads...`);
    const leadIds = await ctx.runMutation(seedMockLeadsRef, {
      count: leadCount,
    });
    
    console.log(`🌱 Seeding ${eventCount} mock events...`);
    const eventIds = await ctx.runMutation(seedMockEventsRef, {
      count: eventCount,
      leadIds,
    });
    
    console.log(`✅ Reset complete: ${leadIds.length} leads, ${eventIds.length} events`);
    
    return {
      leadsCreated: leadIds.length,
      eventsCreated: eventIds.length,
    };
  },
});
