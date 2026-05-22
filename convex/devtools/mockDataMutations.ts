import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  outreachCallOutcomeCounts,
  outreachStateCounts,
} from "../outreach/counters";

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"
];

const STREET_NAMES = [
  "Oak Street", "Maple Avenue", "Cedar Lane", "Pine Road", "Elm Boulevard",
  "Washington Street", "Main Street", "Park Avenue", "Lake View Drive", "Sunset Boulevard",
  "Highland Avenue", "Riverside Drive", "Forest Lane", "Mountain View Road", "Ocean Avenue"
];

const CITIES = [
  "San Francisco", "Los Angeles", "San Diego", "San Jose", "Oakland",
  "Sacramento", "Fresno", "Long Beach", "Pasadena", "Santa Monica",
  "Beverly Hills", "Malibu", "Palo Alto", "Mountain View", "Berkeley"
];

const BUYER_BUDGETS = [
  "$400K - $500K", "$500K - $600K", "$600K - $750K", "$750K - $900K",
  "$900K - $1.2M", "$1.2M - $1.5M", "$1.5M - $2M", "$2M+"
];

const TIMELINES = [
  "ASAP", "1-2 weeks", "1 month", "2-3 months", "3-6 months", "6+ months", "Just browsing"
];

const TAGS = [
  "first-time buyer", "relocation", "investment", "luxury", "waterfront",
  "fixer-upper", "new construction", "pre-approved", "cash buyer", "motivated"
];

const SOURCES = [
  "sms_link_open_house", "qr_code_123", "website_contact", "referral",
  "zillow", "realtor.com", "google_business", "social_media", "walk_in"
];

type Sentiment = "positive" | "neutral" | "negative";
const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];

type Intent = "buyer" | "seller" | "investor";
type Status = "new" | "contacted" | "qualified";
type BuyerStage = "searching" | "showings" | "offer_out" | "under_contract" | "closed";
type SellerStage = "pre_listing" | "on_market" | "offer_in" | "under_contract" | "sold";
type LeadType = "buyer" | "seller";
type EventType = "showing" | "meeting" | "follow_up" | "call" | "open_house" | "other";
type OutreachOutcome = NonNullable<Doc<"outreachCalls">["outcome"]>;

const EVENT_TYPES: EventType[] = ["showing", "meeting", "follow_up", "call", "open_house", "other"];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  const areaCode = randomInt(200, 999);
  const prefix = randomInt(200, 999);
  const line = randomInt(1000, 9999);
  return `(${areaCode}) ${prefix}-${line}`;
}

function generateAddress(): string {
  const number = randomInt(100, 9999);
  const street = randomItem(STREET_NAMES);
  const city = randomItem(CITIES);
  return `${number} ${street}, ${city}, CA`;
}

function generateName(): string {
  return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

function generateEmail(name: string): string {
  const cleanName = name.toLowerCase().replace(/\s+/g, ".");
  const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];
  return `${cleanName}@${randomItem(domains)}`;
}

async function resolveSeedUser(
  ctx: MutationCtx,
  args: { created_by_user_id?: Id<"users">; user_email?: string },
) {
  if (args.created_by_user_id) {
    const user = await ctx.db.get(args.created_by_user_id);
    if (!user) {
      throw new Error(`No Convex user found for id ${args.created_by_user_id}`);
    }
    return user;
  }

  const normalizedEmail = args.user_email?.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error(
      "Seed user is required. Pass --email for a Clerk-synced user or --user-id.",
    );
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .unique();
  if (!user) {
    throw new Error(
      `No Convex user found for ${normalizedEmail}. Sign in once or confirm the Clerk users webhook has run.`,
    );
  }
  return user;
}

function leadScenario(index: number): {
  intent: Intent;
  status: Status;
  urgency_score: number;
  lead_type?: LeadType;
  buyer_pipeline_stage?: BuyerStage;
  seller_pipeline_stage?: SellerStage;
} | null {
  const scenarios = [
    {
      intent: "seller" as const,
      status: "new" as const,
      urgency_score: 91,
    },
    {
      intent: "buyer" as const,
      status: "new" as const,
      urgency_score: 84,
    },
    {
      intent: "buyer" as const,
      status: "qualified" as const,
      urgency_score: 79,
    },
    {
      intent: "buyer" as const,
      status: "qualified" as const,
      urgency_score: 73,
      lead_type: "buyer" as const,
    },
    {
      intent: "seller" as const,
      status: "qualified" as const,
      urgency_score: 76,
      lead_type: "seller" as const,
    },
    {
      intent: "seller" as const,
      status: "qualified" as const,
      urgency_score: 68,
      lead_type: "seller" as const,
      seller_pipeline_stage: "pre_listing" as const,
    },
    {
      intent: "buyer" as const,
      status: "contacted" as const,
      urgency_score: 63,
      lead_type: "buyer" as const,
      buyer_pipeline_stage: "searching" as const,
    },
  ];
  return scenarios[index] ?? null;
}

// ============================================================================
// MOCK DATA INTERNAL MUTATIONS
// ============================================================================

export const listSeedUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    return users.map((user) => ({
      userId: user._id,
      userEmail: user.email,
      name: user.name,
    }));
  },
});

export const seedMockLeads = internalMutation({
  args: {
    count: v.number(),
    created_by_user_id: v.optional(v.id("users")),
    user_email: v.optional(v.string()),
    overrides: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const user = await resolveSeedUser(ctx, args);
    const leadIds: Id<"leads">[] = [];
    
    for (let i = 0; i < args.count; i++) {
      const scenario = leadScenario(i);
      const name = generateName();
      const intent = scenario?.intent ?? randomItem(["buyer", "seller", "investor"] as Intent[]);
      const status = scenario?.status ?? randomItem(["new", "contacted", "qualified"] as Status[]);
      
      // Generate intent-specific fields
      let lead_type: LeadType | undefined = scenario?.lead_type;
      let buyer_pipeline_stage: BuyerStage | undefined = scenario?.buyer_pipeline_stage;
      let seller_pipeline_stage: SellerStage | undefined = scenario?.seller_pipeline_stage;
      let budget: string | undefined = undefined;
      let list_price: number | undefined = undefined;
      let listed_date: number | undefined = undefined;
      let preferred_location: string | undefined = undefined;
      
      if (!scenario && (intent === "buyer" || intent === "investor")) {
        if (Math.random() > 0.3) {
          lead_type = "buyer";
          buyer_pipeline_stage = randomItem(["searching", "showings", "offer_out", "under_contract", "closed"] as BuyerStage[]);
          budget = randomItem(BUYER_BUDGETS);
          preferred_location = randomItem(CITIES);
        }
      }
      
      if (!scenario && (intent === "seller" || intent === "investor")) {
        if (Math.random() > 0.3 && !lead_type) {
          lead_type = "seller";
          seller_pipeline_stage = randomItem(["pre_listing", "on_market", "offer_in", "under_contract", "sold"] as SellerStage[]);
          list_price = randomInt(400000, 2500000);
          listed_date = Date.now() - randomInt(0, 90 * 24 * 60 * 60 * 1000); // Up to 90 days ago
        }
      }
      if (scenario && lead_type === "buyer") {
        budget = randomItem(BUYER_BUDGETS);
        preferred_location = randomItem(CITIES);
      }
      if (scenario && lead_type === "seller") {
        list_price = randomInt(650000, 2200000);
        listed_date = Date.now() - randomInt(0, 21 * 24 * 60 * 60 * 1000);
      }
      
      // Generate random tags (0-3 tags)
      const tagCount = randomInt(0, 3);
      const tags: string[] = [];
      for (let t = 0; t < tagCount; t++) {
        const tag = randomItem(TAGS);
        if (!tags.includes(tag)) tags.push(tag);
      }
      
      const leadId = await ctx.db.insert("leads", {
        name,
        phone: generatePhone(),
        email: Math.random() > 0.2 ? generateEmail(name) : undefined,
        property_address: Math.random() > 0.5 ? generateAddress() : undefined,
        timeline: randomItem(TIMELINES),
        intent,
        source: randomItem(SOURCES),
        urgency_score: scenario?.urgency_score ?? randomInt(20, 95),
        status,
        lead_type,
        buyer_pipeline_stage,
        seller_pipeline_stage,
        budget,
        preferred_location,
        list_price,
        listed_date,
        ai_suggestion: Math.random() > 0.6 ? randomItem([
          "Follow up within 24 hours - high urgency",
          "Schedule property showing this week",
          "Send comparable market analysis",
          "Discuss pre-approval status",
          "Offer virtual tour options"
        ]) : undefined,
        notes: Math.random() > 0.5 ? randomItem([
          "Looking for a family home near good schools",
          "Relocating from out of state for new job",
          "First-time buyer needs guidance through process",
          "Investor looking for rental properties",
          "Wants to downsize after kids moved out"
        ]) : undefined,
        conversion_prediction: Math.random() > 0.4 ? randomItem([
          "Within 7 days", "Within 30 days", "Within 90 days", "Long term prospect"
        ]) : undefined,
        last_message_sentiment: Math.random() > 0.3 ? randomItem(SENTIMENTS) : undefined,
        last_message_content: Math.random() > 0.4 ? randomItem([
          "Thanks for the info, I'll get back to you soon",
          "Can we schedule a viewing this weekend?",
          "What's the HOA fee for this property?",
          "Is the price negotiable?",
          "Do you have any similar listings?"
        ]) : undefined,
        message_count: randomInt(0, 15),
        tags: tags.length > 0 ? tags : undefined,
        created_by_user_id: user._id,
        created_at:
          i < 3
            ? Date.now() - randomInt(30, 240) * 60 * 1000
            : Date.now() - randomInt(0, 60 * 24 * 60 * 60 * 1000),
        ...args.overrides,
      });
      
      leadIds.push(leadId);
    }
    
    return {
      leadIds,
      userId: user._id,
      userEmail: user.email,
    };
  },
});

export const seedMockEvents = internalMutation({
  args: {
    count: v.number(),
    leadIds: v.array(v.id("leads")),
    created_by_user_id: v.id("users"),
    overrides: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const eventIds: string[] = [];
    if (args.leadIds.length === 0) {
      return eventIds;
    }
    
    for (let i = 0; i < args.count; i++) {
      const eventType = randomItem(EVENT_TYPES);
      const leadId =
        i < 4 || Math.random() > 0.2 ? randomItem(args.leadIds) : undefined;
      
      // Generate realistic start/end times
      const now = Date.now();
      const startOffset =
        i < 5
          ? randomInt(1 * 60 * 60 * 1000, 72 * 60 * 60 * 1000)
          : randomInt(-7 * 24 * 60 * 60 * 1000, 14 * 24 * 60 * 60 * 1000);
      const startTime = now + startOffset;
      const duration = randomInt(30, 120) * 60 * 1000; // 30-120 minutes
      const endTime = startTime + duration;
      
      const eventId = await ctx.db.insert("events", {
        title: randomItem([
          "Property Showing",
          "Initial Consultation",
          "Follow-up Call",
          "Contract Signing",
          "Open House Event",
          "Price Discussion",
          "Home Inspection Walkthrough",
          "Closing Preparation"
        ]),
        description: Math.random() > 0.5 ? randomItem([
          "Discuss buyer's requirements and preferences",
          "Review comparable sales in the neighborhood",
          "Final walkthrough before closing",
          "Discuss financing options",
          "Present multiple offer strategy"
        ]) : undefined,
        event_type: eventType,
        start_time: startTime,
        end_time: endTime,
        lead_id: leadId,
        location: Math.random() > 0.3 ? generateAddress() : undefined,
        is_completed: startTime < now && Math.random() > 0.3,
        created_by_user_id: args.created_by_user_id,
        reminder_config: Math.random() > 0.5 ? {
          send_reminder: true,
          reminder_minutes_before: [1440, 60],
          channels: ["email", "sms"],
          recipient: "both",
        } : undefined,
        created_at: Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000),
        ...args.overrides,
      });
      
      eventIds.push(eventId);
    }
    
    return eventIds;
  },
});

export const seedMockOutreach = internalMutation({
  args: {
    leadIds: v.array(v.id("leads")),
    created_by_user_id: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (args.leadIds.length === 0) {
      return {
        campaignsCreated: 0,
        callsCreated: 0,
        campaignLeadStatesCreated: 0,
      };
    }

    const now = Date.now();
    const campaignId = await ctx.db.insert("outreachCampaigns", {
      name: "Seeded outreach handoff campaign",
      description:
        "Development campaign with callbacks, handoffs, and review issues for the dashboard.",
      status: "active",
      template_key: "seller_outreach",
      template_version: 1,
      retell_agent_id: "seed-retell-agent",
      retell_phone_number_id: "seed-retell-phone",
      twilio_messaging_service_sid: "seed-twilio-service",
      timezone: "America/Vancouver",
      calling_window: {
        start_hour_local: 9,
        start_minute_local: 0,
        end_hour_local: 18,
        end_minute_local: 0,
        allowed_weekdays: [1, 2, 3, 4, 5],
      },
      retry_policy: {
        max_attempts: 3,
        min_minutes_between_attempts: 120,
      },
      follow_up_sms: {
        enabled: true,
        delay_minutes: 3,
        default_template:
          "Thanks for taking the call. I will follow up with the details we discussed.",
        send_only_on_outcomes: ["voicemail_left", "no_answer"],
      },
      campaign_configuration: {
        campaign_type: "both",
        voice_enabled: true,
        sms_enabled: true,
      },
      outcome_routing: [
        {
          outcome: "connected_interested",
          next_lead_status: "qualified",
          campaign_lead_action: "pause_for_realtor",
        },
        {
          outcome: "callback_requested",
          next_lead_status: "contacted",
          campaign_lead_action: "pause_for_realtor",
        },
        {
          outcome: "wrong_number",
          campaign_lead_action: "stop_calling",
        },
        {
          outcome: "failed",
          campaign_lead_action: "continue",
        },
      ],
      created_by_user_id: args.created_by_user_id,
      created_at: now - 4 * 24 * 60 * 60 * 1000,
      updated_at: now - 45 * 60 * 1000,
    });

    const seededOutcomes: OutreachOutcome[] = [
      "callback_requested",
      "connected_interested",
      "wrong_number",
      "failed",
      "voicemail_left",
    ];
    let callsCreated = 0;
    let campaignLeadStatesCreated = 0;
    const selectedLeadIds = args.leadIds.slice(
      0,
      Math.min(args.leadIds.length, seededOutcomes.length),
    );

    for (let i = 0; i < selectedLeadIds.length; i++) {
      const leadId = selectedLeadIds[i];
      const outcome = seededOutcomes[i];
      const isFailed = outcome === "failed";
      const initiatedAt = now - (i + 1) * 45 * 60 * 1000;
      const callId = await ctx.db.insert("outreachCalls", {
        lead_id: leadId,
        campaign_id: campaignId,
        retell_call_id: `seed-call-${campaignId}-${i}`,
        retell_conversation_id: `seed-conversation-${campaignId}-${i}`,
        call_status: isFailed ? "failed" : "completed",
        call_direction: "outbound",
        initiated_at: initiatedAt,
        started_at: isFailed ? undefined : initiatedAt + 30 * 1000,
        ended_at: initiatedAt + 4 * 60 * 1000,
        duration_seconds: isFailed ? undefined : randomInt(90, 360),
        summary:
          outcome === "callback_requested"
            ? "Lead asked for a callback this afternoon after reviewing their schedule."
            : outcome === "connected_interested"
              ? "Lead is interested and wants the realtor to discuss next steps."
              : outcome === "wrong_number"
                ? "The phone number reached someone who does not know the lead."
                : outcome === "failed"
                  ? "Provider failed to place the call. Review campaign setup."
                  : "Voicemail was left with a short follow-up prompt.",
        extracted_data:
          outcome === "callback_requested"
            ? { callback_at: now + 2 * 60 * 60 * 1000 }
            : undefined,
        outcome,
        outcome_reason:
          outcome === "failed"
            ? "Seeded provider failure"
            : `Seeded ${outcome.replace(/_/g, " ")} outcome`,
        follow_up_sms_status:
          outcome === "voicemail_left" ? "pending" : "not_needed",
        error_message:
          outcome === "failed"
            ? "Seeded Retell configuration issue"
            : undefined,
        created_at: initiatedAt,
        updated_at: now - i * 20 * 60 * 1000,
      });
      callsCreated += 1;

      const call = await ctx.db.get(callId);
      if (call) {
        await outreachCallOutcomeCounts.insertIfDoesNotExist(ctx, call);
      }

      const state =
        outcome === "callback_requested" || outcome === "connected_interested"
          ? "paused_for_realtor"
          : outcome === "failed"
            ? "error"
            : outcome === "wrong_number"
              ? "terminal_blocked"
              : "cooldown";
      const stateId = await ctx.db.insert("outreachCampaignLeadStates", {
        campaign_id: campaignId,
        lead_id: leadId,
        state,
        next_action_at_ms:
          state === "cooldown" ? now + 90 * 60 * 1000 : undefined,
        attempts_in_campaign: i + 1,
        no_answer_or_voicemail_count: outcome === "voicemail_left" ? 1 : 0,
        last_attempt_at: initiatedAt,
        last_outcome: outcome,
        active_call_id: undefined,
        last_error:
          outcome === "failed" ? "Seeded provider failure for review" : undefined,
      });
      campaignLeadStatesCreated += 1;

      const campaignLeadState = await ctx.db.get(stateId);
      if (campaignLeadState) {
        await outreachStateCounts.insertIfDoesNotExist(ctx, campaignLeadState);
      }

      const leadUpdates: Partial<Doc<"leads">> = {
        last_outreach_call_id: callId,
        last_call_outcome: outcome,
      };
      if (outcome === "connected_interested") {
        leadUpdates.status = "qualified";
      } else if (
        outcome === "callback_requested" ||
        outcome === "voicemail_left"
      ) {
        leadUpdates.status = "contacted";
      }
      if (outcome === "wrong_number") {
        leadUpdates.do_not_call = true;
      }
      await ctx.db.patch(leadId, leadUpdates);
    }

    return {
      campaignsCreated: 1,
      callsCreated,
      campaignLeadStatesCreated,
    };
  },
});

export const clearAllMockData = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveSeedUser(ctx, {
      created_by_user_id: args.userId,
      user_email: args.userEmail,
    });

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_created_by_user_id", (q) =>
        q.eq("created_by_user_id", user._id),
      )
      .take(1000);
    const campaigns = await ctx.db
      .query("outreachCampaigns")
      .withIndex("by_created_by_user_id", (q) =>
        q.eq("created_by_user_id", user._id),
      )
      .take(1000);
    const campaignIds = new Set(campaigns.map((campaign) => String(campaign._id)));

    const eventsById = new Map<string, Doc<"events">>();
    const ownedEvents = await ctx.db
      .query("events")
      .withIndex("by_created_by_user_id_and_start_time", (q) =>
        q.eq("created_by_user_id", user._id),
      )
      .take(1000);
    for (const event of ownedEvents) {
      eventsById.set(String(event._id), event);
    }
    for (const lead of leads) {
      const leadEvents = await ctx.db
        .query("events")
        .withIndex("by_lead_id", (q) => q.eq("lead_id", lead._id))
        .take(1000);
      for (const event of leadEvents) {
        eventsById.set(String(event._id), event);
      }
    }

    let campaignLeadStatesDeleted = 0;
    const statesById = new Map<string, Doc<"outreachCampaignLeadStates">>();
    for (const campaign of campaigns) {
      const campaignStates = await ctx.db
        .query("outreachCampaignLeadStates")
        .withIndex("by_campaign_id", (q) =>
          q.eq("campaign_id", campaign._id),
        )
        .take(1000);
      for (const state of campaignStates) {
        statesById.set(String(state._id), state);
      }
    }
    for (const lead of leads) {
      const leadStates = await ctx.db
        .query("outreachCampaignLeadStates")
        .withIndex("by_lead_id", (q) => q.eq("lead_id", lead._id))
        .take(1000);
      for (const state of leadStates) {
        statesById.set(String(state._id), state);
        campaignIds.add(String(state.campaign_id));
      }
    }
    for (const state of statesById.values()) {
      await outreachStateCounts.deleteIfExists(ctx, state);
      await ctx.db.delete(state._id);
      campaignLeadStatesDeleted += 1;
    }

    let callsDeleted = 0;
    const callsById = new Map<string, Doc<"outreachCalls">>();
    for (const campaignId of campaignIds) {
      const campaignCalls = await ctx.db
        .query("outreachCalls")
        .withIndex("by_campaign_id", (q) =>
          q.eq("campaign_id", campaignId as Id<"outreachCampaigns">),
        )
        .take(1000);
      for (const call of campaignCalls) {
        callsById.set(String(call._id), call);
      }
    }
    for (const lead of leads) {
      const leadCalls = await ctx.db
        .query("outreachCalls")
        .withIndex("by_lead_id", (q) => q.eq("lead_id", lead._id))
        .take(1000);
      for (const call of leadCalls) {
        callsById.set(String(call._id), call);
      }
    }
    for (const call of callsById.values()) {
      if (call.campaign_id) {
        await outreachCallOutcomeCounts.deleteIfExists(ctx, call);
      }
      await ctx.db.delete(call._id);
      callsDeleted += 1;
    }

    for (const campaignId of campaignIds) {
      const smsMessages = await ctx.db
        .query("outreachSmsMessages")
        .withIndex("by_campaign_id", (q) =>
          q.eq("campaign_id", campaignId as Id<"outreachCampaigns">),
        )
        .take(1000);
      for (const message of smsMessages) {
        await ctx.db.delete(message._id);
      }
      const webhookEvents = await ctx.db
        .query("outreachWebhookEvents")
        .withIndex("by_campaign_id", (q) =>
          q.eq("campaign_id", campaignId as Id<"outreachCampaigns">),
        )
        .take(1000);
      for (const event of webhookEvents) {
        await ctx.db.delete(event._id);
      }
    }

    let campaignsDeleted = 0;
    for (const campaignId of campaignIds) {
      const campaign = await ctx.db.get(campaignId as Id<"outreachCampaigns">);
      if (campaign?.created_by_user_id === user._id) {
        await ctx.db.delete(campaign._id);
        campaignsDeleted += 1;
      }
    }

    let eventsDeleted = 0;
    for (const event of eventsById.values()) {
      await ctx.db.delete(event._id);
      eventsDeleted += 1;
    }

    for (const lead of leads) {
      const notes = await ctx.db
        .query("leadNotes")
        .withIndex("by_lead_id", (q) => q.eq("lead_id", lead._id))
        .take(1000);
      for (const note of notes) {
        await ctx.db.delete(note._id);
      }
    }

    for (const lead of leads) {
      await ctx.db.delete(lead._id);
    }
    
    // Note: We don't delete users as they're tied to Clerk auth
    
    return {
      leadsDeleted: leads.length,
      eventsDeleted,
      campaignsDeleted,
      callsDeleted,
      campaignLeadStatesDeleted,
    };
  },
});
