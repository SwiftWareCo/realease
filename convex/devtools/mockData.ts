"use node";

import { action, type ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import type { FunctionReference } from "convex/server";

// Type-safe references to internal mutations
// We use 'as any' here because Convex's generated types don't expose internal mutation refs directly
// The runtime behavior is correct - this is just a TypeScript limitation for internal functions
const seedMockLeadsRef =
    "devtools/mockDataMutations:seedMockLeads" as unknown as FunctionReference<
        "mutation",
        "internal",
        {
            count: number;
            created_by_user_id?: string;
            user_email?: string;
            overrides?: Record<string, unknown>;
        },
        Promise<{ leadIds: string[]; userId: string; userEmail?: string }>
    >;
const listSeedUsersRef =
    "devtools/mockDataMutations:listSeedUsers" as unknown as FunctionReference<
        "query",
        "internal",
        Record<string, never>,
        Promise<Array<{ userId: string; userEmail?: string; name: string }>>
    >;
const seedMockEventsRef =
    "devtools/mockDataMutations:seedMockEvents" as unknown as FunctionReference<
        "mutation",
        "internal",
        {
            count: number;
            leadIds: string[];
            created_by_user_id: string;
            overrides?: Record<string, unknown>;
        },
        Promise<string[]>
    >;
const seedMockOutreachRef =
    "devtools/mockDataMutations:seedMockOutreach" as unknown as FunctionReference<
        "mutation",
        "internal",
        { leadIds: string[]; created_by_user_id: string },
        Promise<{
            campaignsCreated: number;
            callsCreated: number;
            campaignLeadStatesCreated: number;
        }>
    >;
const clearAllMockDataRef =
    "devtools/mockDataMutations:clearAllMockData" as unknown as FunctionReference<
        "mutation",
        "internal",
        { userId?: string; userEmail?: string },
        Promise<{
            leadsDeleted: number;
            eventsDeleted: number;
            campaignsDeleted: number;
            callsDeleted: number;
            campaignLeadStatesDeleted: number;
        }>
    >;

type SeedSummary = {
  userId: string;
  userEmail?: string;
  leadsCreated: number;
  eventsCreated: number;
  campaignsCreated: number;
  callsCreated: number;
  campaignLeadStatesCreated: number;
};

async function seedForUser(
  ctx: ActionCtx,
  args: { leads?: number; events?: number; userId: string; userEmail?: string },
): Promise<SeedSummary> {
  const leadCount = args.leads ?? 20;
  const eventCount = args.events ?? 10;

  console.log(`🌱 Seeding ${leadCount} mock leads for ${args.userEmail ?? args.userId}...`);
  const seedResult = await ctx.runMutation(seedMockLeadsRef, {
    count: leadCount,
    created_by_user_id: args.userId,
  });
  const leadIds = seedResult.leadIds;
  console.log(`✅ Created ${leadIds.length} leads`);

  console.log(`🌱 Seeding ${eventCount} mock events...`);
  const eventIds = await ctx.runMutation(seedMockEventsRef, {
    count: eventCount,
    leadIds,
    created_by_user_id: seedResult.userId,
  });
  console.log(`✅ Created ${eventIds.length} events`);

  console.log("🌱 Seeding outreach dashboard signals...");
  const outreachResult = await ctx.runMutation(seedMockOutreachRef, {
    leadIds,
    created_by_user_id: seedResult.userId,
  });
  console.log(`✅ Created ${outreachResult.campaignsCreated} campaign, ${outreachResult.callsCreated} calls`);

  return {
    userId: seedResult.userId,
    userEmail: seedResult.userEmail,
    leadsCreated: leadIds.length,
    eventsCreated: eventIds.length,
    ...outreachResult,
  };
}

export const seedData = action({
  args: {
    leads: v.optional(v.number()),
    events: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const leadCount = args.leads ?? 20;
    const eventCount = args.events ?? 10;

    console.log(`🌱 Seeding ${leadCount} mock leads...`);
    const seedResult = await ctx.runMutation(seedMockLeadsRef, {
      count: leadCount,
      created_by_user_id: args.userId,
      user_email: args.userEmail,
    });
    const leadIds = seedResult.leadIds;
    console.log(`✅ Created ${leadIds.length} leads for ${seedResult.userEmail ?? seedResult.userId}`);
    
    console.log(`🌱 Seeding ${eventCount} mock events...`);
    const eventIds = await ctx.runMutation(seedMockEventsRef, {
      count: eventCount,
      leadIds,
      created_by_user_id: seedResult.userId,
    });
    console.log(`✅ Created ${eventIds.length} events`);

    console.log("🌱 Seeding outreach dashboard signals...");
    const outreachResult = await ctx.runMutation(seedMockOutreachRef, {
      leadIds,
      created_by_user_id: seedResult.userId,
    });
    console.log(`✅ Created ${outreachResult.campaignsCreated} campaign, ${outreachResult.callsCreated} calls`);
    
    return {
      leadsCreated: leadIds.length,
      eventsCreated: eventIds.length,
      ...outreachResult,
    };
  },
});

export const seedAllData = action({
  args: {
    leads: v.optional(v.number()),
    events: v.optional(v.number()),
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error("Must pass confirm: true to seed all synced users");
    }

    const users = await ctx.runQuery(listSeedUsersRef, {});
    const summaries: SeedSummary[] = [];

    for (const user of users) {
      summaries.push(
        await seedForUser(ctx, {
          leads: args.leads,
          events: args.events,
          userId: user.userId,
          userEmail: user.userEmail,
        }),
      );
    }

    return {
      usersSeeded: summaries.length,
      leadsCreated: summaries.reduce((total, user) => total + user.leadsCreated, 0),
      eventsCreated: summaries.reduce((total, user) => total + user.eventsCreated, 0),
      campaignsCreated: summaries.reduce(
        (total, user) => total + user.campaignsCreated,
        0,
      ),
      callsCreated: summaries.reduce((total, user) => total + user.callsCreated, 0),
      campaignLeadStatesCreated: summaries.reduce(
        (total, user) => total + user.campaignLeadStatesCreated,
        0,
      ),
      users: summaries,
    };
  },
});

export const clearData = action({
  args: {
    confirm: v.boolean(),
    userId: v.optional(v.id("users")),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error("Must pass confirm: true to clear all data");
    }
    
    console.log("🗑️  Clearing all mock data...");
    const result = await ctx.runMutation(clearAllMockDataRef, {
      userId: args.userId,
      userEmail: args.userEmail,
    });
    console.log(`✅ Deleted ${result.leadsDeleted} leads, ${result.eventsDeleted} events, ${result.campaignsDeleted} campaigns`);
    
    return result;
  },
});

export const clearAllUsersData = action({
  args: {
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error("Must pass confirm: true to clear seeded data for all synced users");
    }

    const users = await ctx.runQuery(listSeedUsersRef, {});
    const summaries: Array<{
      userId: string;
      userEmail?: string;
      leadsDeleted: number;
      eventsDeleted: number;
      campaignsDeleted: number;
      callsDeleted: number;
      campaignLeadStatesDeleted: number;
    }> = [];

    for (const user of users) {
      const result = await ctx.runMutation(clearAllMockDataRef, {
        userId: user.userId,
      });
      summaries.push({
        userId: user.userId,
        userEmail: user.userEmail,
        ...result,
      });
    }

    return {
      usersCleared: summaries.length,
      leadsDeleted: summaries.reduce((total, user) => total + user.leadsDeleted, 0),
      eventsDeleted: summaries.reduce((total, user) => total + user.eventsDeleted, 0),
      campaignsDeleted: summaries.reduce(
        (total, user) => total + user.campaignsDeleted,
        0,
      ),
      callsDeleted: summaries.reduce((total, user) => total + user.callsDeleted, 0),
      campaignLeadStatesDeleted: summaries.reduce(
        (total, user) => total + user.campaignLeadStatesDeleted,
        0,
      ),
      users: summaries,
    };
  },
});

export const resetData = action({
  args: {
    leads: v.optional(v.number()),
    events: v.optional(v.number()),
    confirm: v.boolean(),
    userId: v.optional(v.id("users")),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error("Must pass confirm: true to reset all data");
    }

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await ctx.runMutation(clearAllMockDataRef, {
      userId: args.userId,
      userEmail: args.userEmail,
    });

    // Seed new data
    const leadCount = args.leads ?? 20;
    const eventCount = args.events ?? 10;

    console.log(`🌱 Seeding ${leadCount} mock leads...`);
    const seedResult = await ctx.runMutation(seedMockLeadsRef, {
      count: leadCount,
      created_by_user_id: args.userId,
      user_email: args.userEmail,
    });
    const leadIds = seedResult.leadIds;
    
    console.log(`🌱 Seeding ${eventCount} mock events...`);
    const eventIds = await ctx.runMutation(seedMockEventsRef, {
      count: eventCount,
      leadIds,
      created_by_user_id: seedResult.userId,
    });

    console.log("🌱 Seeding outreach dashboard signals...");
    const outreachResult = await ctx.runMutation(seedMockOutreachRef, {
      leadIds,
      created_by_user_id: seedResult.userId,
    });
    
    console.log(`✅ Reset complete: ${leadIds.length} leads, ${eventIds.length} events, ${outreachResult.campaignsCreated} campaigns`);
    
    return {
      leadsCreated: leadIds.length,
      eventsCreated: eventIds.length,
      ...outreachResult,
    };
  },
});

export const resetAllData = action({
  args: {
    leads: v.optional(v.number()),
    events: v.optional(v.number()),
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error("Must pass confirm: true to reset seeded data for all synced users");
    }

    const users = await ctx.runQuery(listSeedUsersRef, {});
    const summaries: SeedSummary[] = [];

    for (const user of users) {
      await ctx.runMutation(clearAllMockDataRef, {
        userId: user.userId,
      });
      summaries.push(
        await seedForUser(ctx, {
          leads: args.leads,
          events: args.events,
          userId: user.userId,
          userEmail: user.userEmail,
        }),
      );
    }

    return {
      usersReset: summaries.length,
      leadsCreated: summaries.reduce((total, user) => total + user.leadsCreated, 0),
      eventsCreated: summaries.reduce((total, user) => total + user.eventsCreated, 0),
      campaignsCreated: summaries.reduce(
        (total, user) => total + user.campaignsCreated,
        0,
      ),
      callsCreated: summaries.reduce((total, user) => total + user.callsCreated, 0),
      campaignLeadStatesCreated: summaries.reduce(
        (total, user) => total + user.campaignLeadStatesCreated,
        0,
      ),
      users: summaries,
    };
  },
});
