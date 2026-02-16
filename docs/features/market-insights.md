# Market Insights Feature

## What this feature does

The Market Insights feature gives signed-in users real estate market updates for selected regions.

It adds:

- A Settings page (`/settings`) where users pick:
  - one or more market regions
  - interest topics (home prices, inventory, mortgage rates, etc.)
- An Insights page (`/insights`) that shows fetched insights by category, with:
  - category tabs
  - region filters (multi-region support)
  - source links and relative fetch time
- A backend ingestion pipeline that fetches market content from curated sources and stores it in Convex.

## Main implementation points

### Frontend routes

- `app/(app)/settings/page.tsx`
  - Reads user preferences from Convex
  - Writes preferences via `api.users.mutations.updateRegion` and `api.users.mutations.updateInterests`
- `app/(app)/insights/page.tsx`
  - Reads grouped insights from `api.insights.queries.getMyInsights`
  - Supports filtering by selected regions
- Sidebar links added in `components/layout/Sidebar.tsx`

### Backend (Convex)

- Schema additions:
  - `marketInsights` table
  - `insightFetchLog` table
  - user preference fields: `marketRegions`, `marketInterests` (legacy `marketRegion` still supported)
- Source definitions:
  - `convex/insights/sources.ts`
  - National + city-specific source lists (currently BC-heavy list)
- Fetch/storage flow:
  - `manualFetch` (public action for manual trigger)
  - `dailyFetch` (internal action run by cron)
  - `fetchRegionData` -> `fetchWithJina` -> `storeInsight` + `logFetch`
  - fetches are executed per region key (`city-state-country`), then grouped in UI
- Cleanup:
  - `cleanupExpired` removes expired insights (48-hour TTL model)

## Fetch pipeline and data contract

For each selected region:

1. `fetchRegionData` resolves curated sources for that region.
2. Each source is fetched through Jina (`fetchWithJina`).
3. Jina responses are normalized into a predictable shape before storage:
   - `title`: human-readable title
   - `content`: cleaned article/body text
   - `summary`: cleaned short summary for cards
4. Insights are written to `marketInsights` with consistent fields used by the UI (`title`, `summary`, `category`, `sourceName`, `sourceUrl`, `fetchedAt`, `region`).

This is intentional so the UI renders curated text summaries, not raw JSON blobs.

## Scheduling

- Daily fetch cron: 6:00 AM PT (`hourUTC: 13`)
- Cleanup cron: weekly Sunday 2:00 AM UTC
- Defined in `convex/crons.ts`

## How to test quickly

1. Start local services:

```bash
pnpm dev
```

2. Sign in and set a supported region in `/settings` (example: Vancouver, BC).

3. Trigger fetch manually (instead of waiting for cron):

```bash
npx convex run insights/actions:manualFetch '{"city":"Vancouver","state":"BC","country":"CA"}' --identity '{"subject":"dev-user"}' --typecheck disable
```

4. Verify data exists:

```bash
npx convex run insights/queries:getRegionInsights '{"city":"Vancouver","state":"BC","country":"CA"}' --typecheck disable
```

5. Open `/insights` and confirm cards/tabs render.

Note:
- The "Refresh" button in the empty state reloads the page only. It does not trigger a backend fetch.
- Use `manualFetch` for immediate ingestion.

## Need-to-know / good-to-know

- Region support is source-driven:
  - Supported UI region list comes from `getSupportedRegions()` in `convex/insights/sources.ts`.
  - Add new cities by updating `CITY_SOURCES`.
- `manualFetch` requires an authenticated identity.
- `getMyInsights` only returns insights for the current user's configured regions.
- Ingestion now normalizes Jina responses and stores curated summaries for UI display.
- Some sources can return low-quality/404 content through Jina; inspect `insightFetchLog` when debugging.
- There is currently no deduplication/versioning per source article; repeated fetches can add multiple records.
- "Quick Overview" has been removed from `/insights`; the page focuses on region/category insight cards.
- Existing notes for future enhancements are in `docs/features/insights-future-upgrades.md`.

## Current status notes (as of 2026-02-16)

- TypeScript check passes (`pnpm lint:types`).
- Production build passes (`pnpm build`).
- ESLint has outstanding issues in:
  - `app/(app)/settings/page.tsx`
  - `components/multi-select.tsx`
  - `convex/insights/mutations.ts`
