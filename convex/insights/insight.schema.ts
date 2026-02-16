import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const insightCategorySchema = v.union(
  v.literal('home_prices'),
  v.literal('inventory'),
  v.literal('mortgage_rates'),
  v.literal('market_trend'),
  v.literal('new_construction'),
  v.literal('rental'),
);

export const marketInsightsTable = defineTable({
  // Region this insight applies to
  regionKey: v.string(), // e.g., "austin-tx-us"
  region: v.object({
    city: v.string(),
    state: v.optional(v.string()),
    country: v.string(),
  }),
  
  // Categorization
  category: insightCategorySchema,
  
  // Content
  title: v.string(),
  summary: v.string(),
  sourceUrl: v.string(),
  sourceName: v.string(),
  rawContent: v.optional(v.string()), // Full markdown from Jina
  
  // Extracted data points (structured)
  dataPoints: v.optional(v.array(v.object({
    label: v.string(),
    value: v.string(),
    trend: v.optional(v.union(v.literal('up'), v.literal('down'), v.literal('neutral'))),
  }))),
  
  // Metadata
  relevanceScore: v.number(), // 0-100
  fetchedAt: v.number(), // timestamp
  expiresAt: v.number(), // 48hr TTL
})
  .index('by_region', ['regionKey'])
  .index('by_region_category', ['regionKey', 'category'])
  .index('by_expires', ['expiresAt']);

// Track which sources were fetched when
export const insightFetchLogTable = defineTable({
  regionKey: v.string(),
  sourceUrl: v.string(),
  sourceName: v.string(),
  fetchedAt: v.number(),
  success: v.boolean(),
  errorMessage: v.optional(v.string()),
  contentLength: v.optional(v.number()),
})
  .index('by_region', ['regionKey'])
  .index('by_fetched_at', ['fetchedAt']);
