import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

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

// ============================================================================
// MOCK DATA INTERNAL MUTATIONS
// ============================================================================

export const seedMockLeads = internalMutation({
  args: {
    count: v.number(),
    overrides: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const leadIds: string[] = [];
    
    for (let i = 0; i < args.count; i++) {
      const name = generateName();
      const intent = randomItem(["buyer", "seller", "investor"] as Intent[]);
      const status = randomItem(["new", "contacted", "qualified"] as Status[]);
      
      // Generate intent-specific fields
      let lead_type: LeadType | undefined = undefined;
      let buyer_pipeline_stage: BuyerStage | undefined = undefined;
      let seller_pipeline_stage: SellerStage | undefined = undefined;
      let budget: string | undefined = undefined;
      let list_price: number | undefined = undefined;
      let listed_date: number | undefined = undefined;
      let preferred_location: string | undefined = undefined;
      
      if (intent === "buyer" || intent === "investor") {
        if (Math.random() > 0.3) {
          lead_type = "buyer";
          buyer_pipeline_stage = randomItem(["searching", "showings", "offer_out", "under_contract", "closed"] as BuyerStage[]);
          budget = randomItem(BUYER_BUDGETS);
          preferred_location = randomItem(CITIES);
        }
      }
      
      if (intent === "seller" || intent === "investor") {
        if (Math.random() > 0.3 && !lead_type) {
          lead_type = "seller";
          seller_pipeline_stage = randomItem(["pre_listing", "on_market", "offer_in", "under_contract", "sold"] as SellerStage[]);
          list_price = randomInt(400000, 2500000);
          listed_date = Date.now() - randomInt(0, 90 * 24 * 60 * 60 * 1000); // Up to 90 days ago
        }
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
        urgency_score: randomInt(20, 95),
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
        created_at: Date.now() - randomInt(0, 60 * 24 * 60 * 60 * 1000), // Up to 60 days ago
        ...args.overrides,
      });
      
      leadIds.push(leadId);
    }
    
    return leadIds;
  },
});

export const seedMockEvents = internalMutation({
  args: {
    count: v.number(),
    leadIds: v.array(v.id("leads")),
    overrides: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const eventIds: string[] = [];
    
    for (let i = 0; i < args.count; i++) {
      const eventType = randomItem(EVENT_TYPES);
      const leadId = Math.random() > 0.2 ? randomItem(args.leadIds) : undefined;
      
      // Generate realistic start/end times
      const now = Date.now();
      const startOffset = randomInt(-7 * 24 * 60 * 60 * 1000, 14 * 24 * 60 * 60 * 1000); // -7 to +14 days
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

export const clearAllMockData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete all events first (they reference leads)
    const events = await ctx.db.query("events").collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }
    
    // Delete all leads
    const leads = await ctx.db.query("leads").collect();
    for (const lead of leads) {
      await ctx.db.delete(lead._id);
    }
    
    // Note: We don't delete users as they're tied to Clerk auth
    
    return {
      leadsDeleted: leads.length,
      eventsDeleted: events.length,
    };
  },
});
