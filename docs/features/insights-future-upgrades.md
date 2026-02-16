# Market Insights - Future Upgrades

This document outlines potential enhancements and upgrades for the Market Insights feature.

---

## 🚀 Phase 1: Current Implementation (Free Tier)

**Status:** ✅ Implemented

- **Jina Reader** for content extraction (FREE)
- **Curated sources** per city (10 cities supported)
- **Built-in Convex crons** for daily fetching
- **48-hour TTL** on insights for freshness
- **Basic UI** with category tabs and cards

---

## 🔮 Phase 2: Near-Term Enhancements

### 2.1 AI-Powered Summarization
**Cost:** ~$5-10/month (OpenRouter)

**Description:**
Use AI to extract structured data points from raw content instead of just storing summaries.

**Implementation:**
```typescript
// Use OpenRouter to parse Jina content
const prompt = `Extract key metrics from this real estate content:
${rawContent}

Return JSON:
{
  "medianPrice": "$485,000",
  "priceChange": "+3.2%",
  "daysOnMarket": 45,
  "inventory": "2.1 months",
  "trend": "up" | "down" | "neutral"
}`;
```

**Benefits:**
- Structured data for charts/graphs
- More relevant insights
- Can generate alerts for significant changes

---

### 2.1B Structured Category Metrics (Required UI Contract)
**Cost:** Included with 2.1

**Goal:**
Do not render category cards as summary-only text. Each category should display predictable, relevant stats extracted from scraped content.

**Display contract (all categories):**
- Show clear stat labels and values on each card.
- Include `asOf`/timestamp for the metric data.
- Keep a source link visible (`sourceUrl`) for verification.
- Show an AI summary block as optional supporting context, not the primary value.

**Required stat keys by category (v1):**

| Category | Required stats (examples) |
|---------|----------------------------|
| `home_prices` | `median_price`, `price_change_mom_pct`, `price_change_yoy_pct` |
| `mortgage_rates` | `fixed_5y_rate_pct`, `variable_5y_rate_pct`, `policy_rate_pct` |
| `inventory` | `active_listings`, `new_listings_30d`, `months_of_inventory` |
| `market_trend` | `sales_volume_30d`, `sales_to_new_listings_ratio_pct`, `avg_days_on_market` |
| `new_construction` | `housing_starts_30d`, `permits_issued_30d`, `completions_30d` |
| `rental` | `avg_rent_1br`, `avg_rent_2br`, `vacancy_rate_pct`, `rent_change_yoy_pct` |

**Suggested normalized payload shape:**
```typescript
{
  category: "mortgage_rates",
  regionKey: "vancouver-bc-ca",
  title: "Mortgage Rate Snapshot",
  stats: [
    { key: "fixed_5y_rate_pct", label: "5Y Fixed", value: 4.59, unit: "%" },
    { key: "variable_5y_rate_pct", label: "5Y Variable", value: 5.1, unit: "%" },
    { key: "policy_rate_pct", label: "BoC Policy Rate", value: 2.25, unit: "%" }
  ],
  asOf: 1739491200000,
  sourceUrl: "https://...",
  aiSummary: "Rates stayed flat this week, with fixed rates narrowing."
}
```

**Notes:**
- The UI should prioritize `stats` for rendering and only fall back to text summary if parsing fails.
- Parsing failures should be logged and visible in `insightFetchLog`.

---

### 2.2 More Cities & Custom Regions
**Cost:** FREE

**Description:**
Add more pre-configured cities and allow users to request new regions.

**Tasks:**
- [ ] Add 20 more major metros
- [ ] Create admin UI to add new city sources
- [ ] Allow users to vote/request new cities
- [ ] Support Canada (Toronto, Vancouver, Montreal)

---

### 2.3 Email/Notification Alerts
**Cost:** FREE (use existing Twilio integration)

**Description:**
Send weekly digests or alerts for significant market changes.

**Implementation:**
```typescript
// Weekly cron job
if (priceChange > 5% || newConstruction > threshold) {
  await sendAlert(user.phone, `Austin prices up ${priceChange}% this week`);
}
```

---

## 🔥 Phase 3: Power Features (Paid Tiers)

### 3.1 Firecrawl Integration (Fallback)
**Cost:** ~$20-50/month (Firecrawl pay-as-you-go)

**Description:**
Use Firecrawl as a fallback when Jina Reader fails (bot-protected sites).

**When to Upgrade:**
- Jina consistently fails on major sources
- Need more reliable scraping
- Want structured data extraction

**Implementation:**
```typescript
// convex/insights/actions.ts
export const fetchWithFallback = async (url: string) => {
  // Try Jina first (free)
  const jinaResult = await fetchWithJina(url);
  if (jinaResult.success) return jinaResult;
  
  // Fallback to Firecrawl (paid)
  return await fetchWithFirecrawl(url);
};
```

---

### 3.2 Bing Search API Integration
**Cost:** FREE tier (1,000 queries/month), then ~$7/1000 queries

**Description:**
Instead of curated sources, dynamically search for latest market news.

**Benefits:**
- Discover new sources automatically
- More timely news coverage
- Less maintenance (no hardcoded URLs)

**Implementation:**
```typescript
// Search for fresh content daily
const searchResults = await bingSearch(
  `"${city}" real estate market news 2025`
);

// Extract top 5 results with Jina
for (const result of searchResults.slice(0, 5)) {
  await fetchWithJina(result.url);
}
```

---

### 3.3 Advanced Analytics Dashboard
**Cost:** FREE (client-side)

**Description:**
Charts and visualizations for market trends over time.

**Features:**
- Price trend charts (line charts)
- Inventory level graphs
- Mortgage rate history
- Heat maps by neighborhood

**Libraries:**
- Recharts (React)
- Chart.js
- D3.js (for custom)

---

## 🏗️ Phase 4: Enterprise Features

### 4.1 Custom Source Configuration
**Description:**
Let power users add their own RSS feeds or URLs to monitor.

**Use Case:**
Realtors want to track specific:
- Local news outlets
- Neighborhood blogs
- Builder websites
- MLS announcements

---

### 4.2 Multi-Region Monitoring
**Description:**
Allow users to track multiple markets simultaneously.

**Use Case:**
Agents working in multiple cities, investors tracking opportunities.

**Schema Change:**
```typescript
// Change from single region to array
marketRegions: v.array(marketRegionSchema),
```

---

### 4.3 Competitor/Agent Insights
**Description:**
Track what other agents are doing in the market.

**Sources:**
- Agent social media
- New listing alerts
- Recent sales data
- Market share analysis

**Note:** Requires careful legal/ethical consideration.

---

## 🔧 Technical Upgrades

### 4.4 Durable Functions (if needed)
**Current:** Built-in Convex crons are sufficient

**When to Upgrade:**
- Need more complex scheduling (user-defined times)
- Need retry logic with exponential backoff
- Need to chain multiple operations reliably

**Options:**
- `@convex-dev/crons` component (dynamic crons)
- Custom scheduling with `ctx.scheduler`

---

### 4.5 Caching Layer
**Description:**
Add Redis or similar for faster insight retrieval.

**Current:** Convex queries are fast enough for MVP
**Future:** If 1000+ users, consider edge caching

---

## 📊 Cost Projections

| Phase | Monthly Cost | Features |
|-------|-------------|----------|
| Current | $0 | Jina + 10 cities |
| Phase 2 | $5-15 | AI summarization, more cities |
| Phase 3 | $20-75 | Firecrawl fallback, Bing Search |
| Phase 4 | $50-150 | Enterprise, multi-region, caching |

---

## 🎯 Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| AI Summarization | High | Medium | **P1** |
| More Cities | High | Low | **P1** |
| Firecrawl Fallback | Medium | Low | **P2** |
| Email Alerts | Medium | Low | **P2** |
| Charts/Dashboard | High | Medium | **P2** |
| Bing Search | Medium | Medium | **P3** |
| Multi-Region | Medium | Medium | **P3** |
| Custom Sources | Low | High | **P4** |

---

## 📝 Implementation Notes

### When Jina Reader Fails
Jina works on ~80% of sites. When it fails:
1. Check if site blocks bots
2. Try adding `https://r.jina.ai/http://URL?format=text`
3. Consider Firecrawl for critical sources

### Adding New Cities
To add a new city:
1. Add to `convex/insights/sources.ts` `CITY_SOURCES`
2. Add to `SUPPORTED_REGIONS` in UI components
3. Test Jina extraction on each source
4. Deploy and run manual fetch test

### Monitoring Costs
Set up logging to track:
- Number of fetches per day
- Success rate by source
- User engagement with insights

---

## 🚦 Decision Points

### When to Add Firecrawl
- Jina success rate drops below 70%
- Users complain about stale data
- Want to scale beyond 50 cities

### When to Add Bing Search
- Maintenance burden of curated sources is too high
- Want real-time news, not just market data
- Have budget for $20-50/month

### When to Add AI Summarization
- Have 100+ active users
- Users want structured data (charts)
- Have OpenRouter credits

---

## 🔗 Useful Resources

- **Jina Reader:** https://github.com/jina-ai/reader
- **Firecrawl:** https://www.firecrawl.dev/
- **Bing Search API:** https://www.microsoft.com/en-us/bing/apis/bing-web-search-api
- **Convex Crons:** https://docs.convex.dev/scheduling/cron-jobs

---

*Last updated: February 2026*
