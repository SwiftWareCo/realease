# Insights

## 1. Insights Page Read (Redesigned Dashboard)

### Relevant Files
- `app/(app)/insights/page.tsx` — Main page; calls 3 queries (`getMyInsights`, `getKPIMetrics`, `getMarketSummary`), renders KPIStrip, MarketSnapshot, and CategorySections with region filtering.
- `app/(app)/insights/components/KPIStrip.tsx` — Responsive grid of metric stat cards with trend arrows.
- `app/(app)/insights/components/MarketSnapshot.tsx` — AI-generated summary card with market condition badge and key driver tags.
- `app/(app)/insights/components/CategorySection.tsx` — Per-category section with headline metric, data point pills, and article card grid.
- `app/(app)/insights/components/InsightCard.tsx` — Individual article card with data point pills and compact variant.
- `app/(app)/insights/components/InsightsEmptyState.tsx` — Renders no-region and no-insight outcomes.
- `convex/insights/queries.ts` — `getMyInsights` handles auth, region allow-listing, and grouped insight response shaping.
- `convex/insights/metricsQueries.ts` — `getKPIMetrics` returns national + region metrics sorted by category priority; `getMarketSummary` returns AI summary.
- `convex/insights/metrics.schema.ts` — Defines `marketMetrics` and `marketSummaries` tables and shared constants.
- `convex/users/user.schema.ts` — Defines `users` table fields (`marketRegion`, `marketRegions`).

### User Flow

```mermaid
flowchart TD
    A[User opens /insights] --> B{Authenticated?}
    B -->|No| C([Show empty state + settings CTA])
    B -->|Yes| D{Has regions configured?}
    D -->|No| E([Show No Region Selected empty state])
    D -->|Yes| F[Three queries fire in parallel]
    F --> G[getMyInsights returns grouped articles]
    F --> H[getKPIMetrics returns national + region metrics]
    F --> I[getMarketSummary returns AI snapshot]
    G --> J{Any data available?}
    H --> J
    J -->|No| K([Show No Insights Yet + refresh button])
    J -->|Yes| L([Render KPIStrip + MarketSnapshot + CategorySections])
    L --> M[User changes region filter]
    M --> F
```

### Step Function Map

| Step | User-visible step | Related function(s) | Primary file(s) |
|---|---|---|---|
| 1 | User opens /insights | Route render, 3 `useQuery` hooks | `app/(app)/insights/page.tsx` |
| 2 | Check authentication | `ctx.auth.getUserIdentity` in each query | `convex/insights/queries.ts`, `convex/insights/metricsQueries.ts` |
| 3 | Show auth/empty state | UI-only | `InsightsEmptyState.tsx` |
| 4 | Check region configuration | `getMyInsights` user-region guards | `convex/insights/queries.ts` |
| 5 | Fetch grouped articles | `getMyInsights` | `convex/insights/queries.ts` |
| 6 | Fetch KPI metrics | `getKPIMetrics` | `convex/insights/metricsQueries.ts` |
| 7 | Fetch market summary | `getMarketSummary` | `convex/insights/metricsQueries.ts` |
| 8 | Render dashboard | KPIStrip, MarketSnapshot, CategorySection | `app/(app)/insights/components/*.tsx` |
| 9 | User changes region filter | Region filter handler re-runs queries | `app/(app)/insights/page.tsx` |

### Technical Sequence

```mermaid
sequenceDiagram
autonumber
actor User
box Client Boundary
participant Page as React Client - Insights Page
end
box Server Boundary
participant QInsights as getMyInsights Query
participant QMetrics as getKPIMetrics Query
participant QSummary as getMarketSummary Query
end
participant DB as Convex DB

User->>Page: Open /insights
par Three queries fire in parallel
  Page->>QInsights: useQuery getMyInsights - regionKeys optional
  Page->>QMetrics: useQuery getKPIMetrics - regionKeys optional
  Page->>QSummary: useQuery getMarketSummary
end

QInsights->>QInsights: ctx.auth.getUserIdentity()
alt Unauthenticated
  QInsights-->>Page: null
  Page-->>User: Show empty state + settings CTA
else Authenticated
  QInsights->>DB: users.by_external_id.unique(identity.subject)
  alt No regions configured
    QInsights-->>Page: null
    Page-->>User: Show No Region Selected empty state
  else Has regions
    QInsights->>QInsights: Build region keys and allow-list requested keys
    loop For each regionKey
      QInsights->>DB: marketInsights.by_region(regionKey).order(desc).take(50)
    end
    QInsights->>QInsights: Group insights by category and compute lastUpdated
    QInsights-->>Page: regions, insights grouped by category, lastUpdated
  end
end

QMetrics->>QMetrics: ctx.auth.getUserIdentity()
QMetrics->>DB: marketMetrics.by_region("national-ca").take(20)
opt regionKeys provided
  loop For each regionKey
    QMetrics->>DB: marketMetrics.by_region(regionKey).take(20)
  end
end
QMetrics->>QMetrics: Sort by category priority
QMetrics-->>Page: Sorted metrics array

QSummary->>QSummary: ctx.auth.getUserIdentity()
QSummary->>DB: marketSummaries.by_region(regionKey or "national-ca").unique()
QSummary-->>Page: Market summary doc or null

alt No insights and no metrics
  Page-->>User: Show InsightsEmptyState with refresh button
else Data available
  Page-->>User: Render KPIStrip + MarketSnapshot + CategorySections
end

User->>Page: Change MultiSelect region filter
Page->>QInsights: Re-run getMyInsights with new regionKeys
Page->>QMetrics: Re-run getKPIMetrics with new regionKeys
```

## 2. Settings Preference Writes (Regions + Interests)

### Relevant Files
- `app/(app)/settings/page.tsx` — Loads preferences and supported regions, then calls `updateRegion`/`updateInterests` on save.
- `convex/insights/queries.ts` — `getUserPreferences` and `getSupportedRegions` provide initial settings data.
- `convex/insights/sources.ts` — Supplies canonical supported region list used by `getSupportedRegions`.
- `convex/users/mutations.ts` — Authenticated mutations for persisting `marketRegions` and `marketInterests`.
- `convex/users/user.schema.ts` — Validates region and interest shapes written in user document patches.

### User Flow

```mermaid
flowchart TD
    A[User opens /settings] --> B[Load preferences + supported regions]
    B --> C([Render region multiselect + interests checkboxes])
    C --> D[User clicks Save Regions]
    D --> E{Authorized?}
    E -->|No| F([Show error toast])
    E -->|Yes| G[updateRegion mutation runs]
    G --> H([Show success toast])
    C --> I[User clicks Save Interests]
    I --> J{Authorized?}
    J -->|No| F
    J -->|Yes| K[updateInterests mutation runs]
    K --> H
```

### Step Function Map

| Step | User-visible step | Related function(s) | Primary file(s) |
|---|---|---|---|
| 1 | User opens /settings | Route render | `app/(app)/settings/page.tsx` |
| 2 | Load preferences and supported regions | `getUserPreferences`, `getSupportedRegions` | `convex/insights/queries.ts` |
| 3 | Render settings controls | UI-only | `app/(app)/settings/page.tsx` |
| 4 | Click Save Regions | Save handler | `app/(app)/settings/page.tsx` |
| 5 | Region save authorization check | `ctx.auth.getUserIdentity` via `updateRegion` | `convex/users/mutations.ts` |
| 6 | Show region save error | UI-only | `app/(app)/settings/page.tsx` |
| 7 | Persist regions | `updateRegion` | `convex/users/mutations.ts` |
| 8 | Show region save success | UI-only | `app/(app)/settings/page.tsx` |
| 9 | Click Save Interests | Save handler | `app/(app)/settings/page.tsx` |
| 10 | Interest save authorization check | `ctx.auth.getUserIdentity` via `updateInterests` | `convex/users/mutations.ts` |
| 11 | Persist interests | `updateInterests` | `convex/users/mutations.ts` |

### Technical Sequence

```mermaid
sequenceDiagram
autonumber
actor User
box Client Boundary
participant Client as React Client - Settings Page
end
box Server Boundary
participant Server as Convex Query/Mutation
end
participant DB as Convex DB

User->>Client: Open /settings
Client->>Server: useQuery getUserPreferences
Client->>Server: useQuery getSupportedRegions

Server->>Server: getUserPreferences - ctx.auth.getUserIdentity()
alt Unauthenticated
  Server-->>Client: null preferences
  Client-->>User: Page has no persisted preferences to initialize from
else Authenticated
  Server->>DB: users.by_external_id.unique(identity.subject)
  alt User missing
    Server-->>Client: null preferences
  else User exists
    Server-->>Client: regions and interests from user doc
  end
end

Server-->>Client: getSupportedRegions returns region list
Client-->>User: Render region multiselect + interests checkboxes

User->>Client: Click Save Regions
Client->>Server: mutation updateRegion with regions array
Server->>Server: ctx.auth.getUserIdentity()
alt Unauthorized OR user not found
  Server-->>Client: throw Error
  Client-->>User: Show error toast
else Authorized
  Server->>DB: patch users doc with marketRegions
  Server-->>Client: success
  Client-->>User: Show success toast
end

User->>Client: Click Save Interests
Client->>Server: mutation updateInterests with interests array
Server->>Server: ctx.auth.getUserIdentity()
alt Unauthorized OR user not found
  Server-->>Client: throw Error
  Client-->>User: Show error toast
else Authorized
  Server->>DB: patch users doc with marketInterests
  Server-->>Client: success
  Client-->>User: Show success toast
end
```

## 3. Scheduled Ingestion + LLM Extraction + Summary Generation

### Relevant Files
- `convex/crons.ts` — Schedules `dailyFetch` (every 24h), `cleanupExpired` (every 168h), and `fetchAllStructuredData` (every 6h).
- `convex/insights/actions.ts` — `dailyFetch` orchestrates per-region ingestion; `fetchRegionData` fetches sources via Jina then runs LLM extraction; `fetchWithJina` handles HTTP fetch.
- `convex/insights/extractMetrics.ts` — `extractDataPointsFromContent` sends article content to OpenRouter LLM to extract structured data points and numeric metrics. Runs in Node runtime.
- `convex/insights/marketSummary.ts` — `generateMarketSummary` sends region metrics + recent insights to OpenRouter LLM. Runs in Node runtime.
- `convex/insights/queries.ts` — `getActiveRegions` returns all user-configured regions.
- `convex/insights/sources.ts` — Resolves per-region source list.
- `convex/insights/mutations.ts` — `storeInsight` (with dataPoints + aiSummary), `logFetch`.
- `convex/insights/metricsMutations.ts` — `upsertMetric`, `upsertMarketSummary`.
- `convex/insights/metricsQueries.ts` — `getMetricsByRegion` internal query for summary generation.
- `convex/insights/marketSummaryQueries.ts` — `getRecentInsightSummaries` internal query for summary generation.
- `convex/insights/metrics.schema.ts` — `NATIONAL_REGION_KEY` constant, table definitions.

### User Flow

```mermaid
flowchart TD
    A[Cron fires every 24h] --> B[getActiveRegions query runs]
    B --> C{Any active regions?}
    C -->|No| D([Return early - nothing to fetch])
    C -->|Yes| E[Deduplicate regions]
    E --> F[fetchRegionData for each region]
    F --> G{Sources configured?}
    G -->|No| H([Skip region - no sources])
    G -->|Yes| I[fetchWithJina for each source]
    I --> J{Fetch successful?}
    J -->|No| K([Log fetch failure])
    J -->|Yes| L[extractDataPointsFromContent via LLM]
    L --> M[storeInsight with dataPoints + aiSummary]
    L --> N[upsertMetric for extracted numeric metrics]
    M --> O[After all regions processed]
    N --> O
    O --> P[generateMarketSummary for each region + national]
    P --> Q([upsertMarketSummary])
```

### Step Function Map

| Step | User-visible step | Related function(s) | Primary file(s) |
|---|---|---|---|
| 1 | Daily ingestion cron trigger | `crons.interval(24h, dailyFetch)` | `convex/crons.ts` |
| 2 | Collect active regions | `getActiveRegions` | `convex/insights/queries.ts` |
| 3 | Deduplicate region targets | Region dedupe logic | `convex/insights/actions.ts` |
| 4 | Fetch each region | `fetchRegionData` | `convex/insights/actions.ts` |
| 5 | Check source availability | `hasSourcesForRegion` | `convex/insights/sources.ts` |
| 6 | Fetch source content via Jina | `fetchWithJina` | `convex/insights/actions.ts` |
| 7 | Extract structured data via LLM | `extractDataPointsFromContent` | `convex/insights/extractMetrics.ts` |
| 8 | Store insight with enriched data | `storeInsight` | `convex/insights/mutations.ts` |
| 9 | Upsert AI-extracted metrics | `upsertMetric` | `convex/insights/metricsMutations.ts` |
| 10 | Generate AI market summary | `generateMarketSummary` | `convex/insights/marketSummary.ts` |
| 11 | Persist market summary | `upsertMarketSummary` | `convex/insights/metricsMutations.ts` |

### Technical Sequence

```mermaid
sequenceDiagram
autonumber
box Server Boundary
participant Cron as Convex Cron Scheduler
participant Daily as dailyFetch Action
participant Region as fetchRegionData Action
participant Jina as fetchWithJina Action
participant LLM as extractDataPointsFromContent Action - Node
participant Summary as generateMarketSummary Action - Node
end
participant External as Jina Reader API
participant OpenRouter as OpenRouter LLM API
participant DB as Convex DB

Cron->>Daily: Trigger every 24h - internal.insights.actions.dailyFetch
Daily->>DB: runQuery getActiveRegions - collect users with regions
alt No active regions
  Daily-->>Cron: return success with 0 regions
else Regions found
  Daily->>Daily: Deduplicate regions by city/state/country
  loop Each unique region sequentially
    Daily->>Region: runAction fetchRegionData with city, state, country
    Region->>Region: hasSourcesForRegion check
    alt No sources
      Region-->>Daily: error - No sources for region
    else Sources exist
      Region->>Region: getSourcesForRegion returns MarketSource array
      loop Each source concurrently via Promise.all
        Region->>Jina: runAction fetchWithJina with url, sourceName, regionKey
        Jina->>External: GET https://r.jina.ai/sourceUrl
        alt Fetch success
          Jina->>DB: runMutation logFetch - success with contentLength
          Jina-->>Region: content, summary, title
        else Fetch failed
          Jina->>DB: runMutation logFetch - failure with errorMessage
          Jina-->>Region: error result
        end

        opt Content available
          Region->>LLM: runAction extractDataPointsFromContent - rawContent, category, regionKey
          LLM->>OpenRouter: POST chat.send with extraction prompt - model gpt-oss-120b free
          OpenRouter-->>LLM: JSON with dataPoints, aiSummary, numericMetrics
          LLM-->>Region: Sanitized extraction result

          loop Each numericMetric extracted
            Region->>DB: runMutation upsertMetric - source ai_extracted, 48h TTL
          end

          Region->>DB: runMutation storeInsight - with dataPoints, aiSummary, 48h TTL
        end
      end
    end
    Region-->>Daily: success with fetched/total counts
    Daily->>Daily: Wait 2s before next region
  end

  loop Each region key
    Daily->>Summary: runAction generateMarketSummary with regionKey
    Summary->>DB: runQuery getMetricsByRegion - region + national metrics
    Summary->>DB: runQuery getRecentInsightSummaries - last 10 insights
    Summary->>OpenRouter: POST chat.send with summary prompt - model gpt-oss-120b free
    OpenRouter-->>Summary: JSON with summary, marketCondition, keyDrivers
    Summary->>DB: runMutation upsertMarketSummary - 24h TTL
  end

  Daily->>Summary: runAction generateMarketSummary with national-ca
  Summary->>DB: runMutation upsertMarketSummary for national
  Daily-->>Cron: return success with regionsFetched count
end
```

## 4. Structured API Data Fetch (Bank of Canada)

### Relevant Files
- `convex/crons.ts` — Schedules `fetchAllStructuredData` every 6 hours.
- `convex/insights/apiFetchers.ts` — `fetchAllStructuredData` orchestrator and `fetchBankOfCanadaRates` fetcher. Uses default Convex runtime (no Node).
- `convex/insights/metricsMutations.ts` — `upsertMetric` persists rate data.
- `convex/insights/metrics.schema.ts` — `NATIONAL_REGION_KEY` constant, `marketMetrics` table definition.

### User Flow

```mermaid
flowchart TD
    A[Cron fires every 6h] --> B[fetchAllStructuredData runs]
    B --> C[fetchBankOfCanadaRates]
    C --> D[Fetch Valet API with 4 series IDs]
    D --> E{API response OK?}
    E -->|No| F([Log error and return failure])
    E -->|Yes| G[Parse latest + previous observations]
    G --> H[Calculate trend from previous values]
    H --> I[upsertMetric for each rate]
    I --> J([Log success with upserted count])
```

### Step Function Map

| Step | User-visible step | Related function(s) | Primary file(s) |
|---|---|---|---|
| 1 | 6-hour cron trigger | `crons.interval(6h, fetchAllStructuredData)` | `convex/crons.ts` |
| 2 | Orchestrate structured data sources | `fetchAllStructuredData` | `convex/insights/apiFetchers.ts` |
| 3 | Fetch Bank of Canada Valet API | `fetchBankOfCanadaRates` | `convex/insights/apiFetchers.ts` |
| 4 | Parse observations and calculate trends | Rate parsing logic | `convex/insights/apiFetchers.ts` |
| 5 | Upsert metrics into DB | `upsertMetric` | `convex/insights/metricsMutations.ts` |

### Technical Sequence

```mermaid
sequenceDiagram
autonumber
box Server Boundary
participant Cron as Convex Cron Scheduler
participant Orch as fetchAllStructuredData Action
participant BoC as fetchBankOfCanadaRates Action
end
participant Valet as Bank of Canada Valet API
participant DB as Convex DB

Cron->>Orch: Trigger every 6h - internal.insights.apiFetchers.fetchAllStructuredData
Orch->>BoC: runAction fetchBankOfCanadaRates

BoC->>Valet: GET /valet/observations/V39079,V80691336,V80691335,V80691311/json?recent=2
alt API error
  BoC-->>Orch: success false, error message
else Response OK
  BoC->>BoC: Parse observations array - latest and previous
  loop 4 series - Policy Rate, 5yr Fixed, 3yr Fixed, Prime Rate
    BoC->>BoC: Parse latest value and calculate trend vs previous
    BoC->>DB: runMutation upsertMetric - regionKey national-ca, category mortgage_rates, source bank_of_canada, 24h TTL
  end
  BoC-->>Orch: success true, metricsUpserted count
end

Orch-->>Cron: return null
```

## 5. Expiry Cleanup

### Relevant Files
- `convex/crons.ts` — Schedules `cleanupExpired` every 168 hours (weekly).
- `convex/insights/mutations.ts` — `cleanupExpired` deletes expired rows from all three tables.
- `convex/insights/insight.schema.ts` — Defines `marketInsights` table with `by_expires` index.
- `convex/insights/metrics.schema.ts` — Defines `marketMetrics` and `marketSummaries` tables with `by_expires` indexes.

### User Flow

```mermaid
flowchart TD
    A[Cron fires every 168h] --> B[cleanupExpired mutation runs]
    B --> C[Query marketInsights by_expires where expiresAt less than now]
    C --> D[Delete up to 200 expired insights]
    D --> E[Query marketMetrics by_expires where expiresAt less than now]
    E --> F[Delete up to 200 expired metrics]
    F --> G[Query marketSummaries by_expires where expiresAt less than now]
    G --> H[Delete up to 50 expired summaries]
    H --> I([Return total deleted count])
```

### Step Function Map

| Step | User-visible step | Related function(s) | Primary file(s) |
|---|---|---|---|
| 1 | Weekly cleanup cron trigger | `crons.interval(168h, cleanupExpired)` | `convex/crons.ts` |
| 2 | Delete expired insights | `cleanupExpired` - marketInsights | `convex/insights/mutations.ts` |
| 3 | Delete expired metrics | `cleanupExpired` - marketMetrics | `convex/insights/mutations.ts` |
| 4 | Delete expired summaries | `cleanupExpired` - marketSummaries | `convex/insights/mutations.ts` |

### Technical Sequence

```mermaid
sequenceDiagram
autonumber
box Server Boundary
participant Cron as Convex Cron Scheduler
participant Cleanup as cleanupExpired Mutation
end
participant DB as Convex DB

Cron->>Cleanup: Trigger every 168h - internal.insights.mutations.cleanupExpired
Cleanup->>DB: marketInsights.by_expires.lt(now).take(200)
loop Each expired insight
  Cleanup->>DB: delete marketInsights row
end

Cleanup->>DB: marketMetrics.by_expires.lt(now).take(200)
loop Each expired metric
  Cleanup->>DB: delete marketMetrics row
end

Cleanup->>DB: marketSummaries.by_expires.lt(now).take(50)
loop Each expired summary
  Cleanup->>DB: delete marketSummaries row
end

Cleanup-->>Cron: return deleted count
```

## 6. Manual Region Fetch

### Relevant Files
- `convex/insights/actions.ts` — Public `manualFetch` action gates access with auth and runs `fetchRegionData` + `fetchAllStructuredData` in parallel.
- `convex/insights/apiFetchers.ts` — `fetchAllStructuredData` orchestrates Bank of Canada rate fetch.
- `convex/insights/mutations.ts` — `logFetch` and `storeInsight` persist fetch outcomes.
- `convex/insights/extractMetrics.ts` — LLM extraction runs as part of `fetchRegionData` pipeline.
- `convex/insights/metricsMutations.ts` — `upsertMetric` persists extracted and API metrics.

### User Flow

```mermaid
flowchart TD
    A[User triggers manual fetch] --> B{Authenticated?}
    B -->|No| C([Show auth error])
    B -->|Yes| D[manualFetch action runs]
    D --> E[Two actions run in parallel]
    E --> F[fetchRegionData - Jina + LLM extraction]
    E --> G[fetchAllStructuredData - BoC API rates]
    F --> H([Store insights + metrics from articles])
    G --> I([Upsert Bank of Canada rate metrics])
    H --> J([Return region fetch result to caller])
    I --> J
```

### Step Function Map

| Step | User-visible step | Related function(s) | Primary file(s) |
|---|---|---|---|
| 1 | Trigger manual fetch | Manual fetch trigger | `convex/insights/actions.ts` |
| 2 | Verify auth | `ctx.auth.getUserIdentity` | `convex/insights/actions.ts` |
| 3 | Show auth error | UI-only | caller UI / Convex dashboard |
| 4 | Start parallel fetch | `manualFetch` runs Promise.all | `convex/insights/actions.ts` |
| 5 | Fetch region articles + extract | `fetchRegionData` pipeline | `convex/insights/actions.ts`, `convex/insights/extractMetrics.ts` |
| 6 | Fetch structured API data | `fetchAllStructuredData` | `convex/insights/apiFetchers.ts` |
| 7 | Persist and report summary | `storeInsight`, `upsertMetric`, `logFetch` | `convex/insights/mutations.ts`, `convex/insights/metricsMutations.ts` |

### Technical Sequence

```mermaid
sequenceDiagram
autonumber
actor User
box Client Boundary
participant Client as React Client / Convex Dashboard
end
box Server Boundary
participant Manual as manualFetch Action - public
participant Region as fetchRegionData Action - internal
participant Struct as fetchAllStructuredData Action - internal
end
participant DB as Convex DB

User->>Client: Trigger manual fetch for region
Client->>Manual: action manualFetch with city, state, country
Manual->>Manual: ctx.auth.getUserIdentity()
alt Unauthenticated
  Manual-->>Client: throw Error Unauthorized
  Client-->>User: Show auth error
else Authenticated
  par Two actions run in parallel
    Manual->>Region: runAction fetchRegionData
    Note right of Region: Full pipeline: Jina fetch, LLM extraction, storeInsight, upsertMetric
    Region->>DB: Store insights + metrics + fetch logs
    Region-->>Manual: success with fetched/total counts
  and
    Manual->>Struct: runAction fetchAllStructuredData
    Note right of Struct: Fetches Bank of Canada Valet API rates
    Struct->>DB: upsertMetric for each BoC rate
    Struct-->>Manual: null
  end
  Manual-->>Client: region fetch result - success, fetched, total
  Client-->>User: Show fetch result summary
end
```

## 7. Data Model

### Tables

| Table | Purpose | Key Indexes | TTL |
|---|---|---|---|
| `marketInsights` | Scraped article content with AI-extracted data points | `by_region`, `by_region_category`, `by_expires` | 48h |
| `marketMetrics` | Structured numeric data points (BoC rates, AI-extracted prices) | `by_region`, `by_region_and_metric`, `by_region_and_category`, `by_expires` | 24-48h |
| `marketSummaries` | AI-generated market snapshot per region | `by_region`, `by_expires` | 24h |
| `insightFetchLog` | Fetch attempt logs for debugging | `by_region` | N/A |

### State Diagram: Metric Data Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Fetched: API fetch or LLM extraction
    Fetched --> Active: upsertMetric persists to marketMetrics
    Active --> Updated: Newer data fetched for same regionKey + metricKey
    Updated --> Active: upsertMetric patches existing row
    Active --> Expired: expiresAt < now
    Expired --> Deleted: cleanupExpired mutation runs
    Deleted --> [*]
```

### Cron Schedule Summary

| Cron Name | Interval | Target Function | Purpose |
|---|---|---|---|
| `daily-market-insights` | 24h | `dailyFetch` | Scrape articles, run LLM extraction, generate summaries |
| `fetch-structured-api-data` | 6h | `fetchAllStructuredData` | Fetch Bank of Canada rates |
| `cleanup-expired-insights` | 168h | `cleanupExpired` | Delete expired rows from all 3 tables |
