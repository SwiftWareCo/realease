# Home Prices Plan (GVR Market Watch First)

## Context and Decision
- Date of planning update: March 31, 2026.
- Decision: remove NHPI from `home_prices` and make GVR Market Watch the only MVP source for Vancouver-region home price KPIs.
- Reason:
  - NHPI tracks new housing price index, not resale MLS benchmark pricing.
  - It adds ingestion/runtime cost and UI confusion without proportional user value for realtor workflows.

## MVP Scope
- In scope:
  - Detect newly published GVR monthly reports from canonical listing pages (no guessed URLs).
  - Parse bounded GVR metrics for Greater Vancouver market-wide totals.
  - Upsert latest values into `marketMetrics` and monthly points into `metricHistory`.
  - Add stage-level ingestion logs for diagnosis.
  - Restrict selectable insight regions to GVR-supported regions only.
- Out of scope:
  - StatsCan NHPI ingestion for `home_prices`.
  - Full multi-board Canada rollout.
  - Deep historical backfill beyond targeted recent months.
  - Sub-area/property-type table metrics (example: Richmond townhouse HPI row values, MLS Listings Facts table rows).

## Source Strategy (Single Source)
- For `home_prices` and `inventory`, use only GVR Market Watch source pages and reports.
- Do not fetch third-party article/blog sources for these metrics in MVP.

### Canonical source
- Primary listing page: `https://www.gvrealtors.ca/market-watch/monthly-market-report.html`
- Discovery is always page-driven:
  - fetch listing page HTML
  - extract latest monthly report PDF link
  - normalize `reportUrl`, `reportMonth` (`YYYY-MM`), `publishedAt` (if available)

### Availability and dedup
1. Add internal action `discoverLatestGvrReport`.
2. Compare discovered report against persisted checkpoint (`lastReportUrl`, `lastReportMonth`).
3. If unchanged, log `no_new_report`.
4. If changed, schedule `ingestGvrReport`.

### Scheduling
- Keep existing 6-hour structured cron.
- Run GVR discovery each cycle.
- Gate ingestion on checkpoint so parsing only runs when a new report is detected.

## Supported Regions (Hard Limit)
- Region selector includes only:
  - `lower-mainland-bc-ca`
  - `greater-vancouver-bc-ca`
  - `burnaby-east-bc-ca`
  - `burnaby-north-bc-ca`
  - `burnaby-south-bc-ca`
  - `coquitlam-bc-ca`
  - `ladner-bc-ca`
  - `maple-ridge-bc-ca`
  - `new-westminster-bc-ca`
  - `north-vancouver-bc-ca`
  - `pitt-meadows-bc-ca`
  - `port-coquitlam-bc-ca`
  - `port-moody-bc-ca`
  - `richmond-bc-ca`
  - `squamish-bc-ca`
  - `sunshine-coast-bc-ca`
  - `tsawwassen-bc-ca`
  - `vancouver-east-bc-ca`
  - `vancouver-west-bc-ca`
  - `west-vancouver-bc-ca`
  - `whistler-bc-ca`
- Unsupported regions are removed from selection entirely (not shown, not silently downgraded).

## Parsing Strategy (Explicit)

### Runtime and limits
- Use Node runtime actions (`"use node"`) for parsing path.
- Enforce strict timeouts and retries per stage to stay within Convex action limits.
- Parse only first relevant pages/sections and only target metrics.

### Extraction pipeline
1. `fetch_report_page`: retrieve listing page and resolve latest PDF URL.
2. `fetch_pdf_bytes`: download report PDF.
3. `deterministic_parse` (preferred):
  - use `unpdf` (or equivalent lightweight PDF text extractor)
  - locate known section anchors from the monthly news release text
  - extract bounded metrics via regex/label matching.
4. `llm_fallback_parse` (only when deterministic confidence is low):
  - send constrained extracted text (not whole web crawl) to OpenRouter
  - require strict JSON schema output for metric keys + values + report month
  - default model can be `stepfun/step-3.5-flash:free` (already configured), but treat as fallback path.
5. `validate_and_normalize`:
  - validate numbers, units, and month consistency
  - reject run if required fields are missing or ambiguous.

### Why hybrid parsing
- Deterministic parsing is cheaper, auditable, and stable when layout is consistent.
- LLM fallback improves resilience when table formatting changes.
- This keeps LLM cost and hallucination risk bounded.

## Data Contract (Explicit)
### Parse now (MVP)
- Parse only market-wide Greater Vancouver values from the narrative/news-release section:
  - `gvr_mls_benchmark_price` from "MLS Home Price Index composite benchmark price ... currently $X"
  - `gvr_mls_sales` from "residential sales in the region totalled X"
  - `gvr_new_listings` from "There were X ... newly listed"
  - `gvr_active_listings` from "total number of properties currently listed ... is X"
  - `gvr_sales_to_active_ratio` from "sales-to-active listings ratio ... is X per cent"
- Parse report month from release text (example: "in January 2026").

### Do not parse now (MVP)
- Do not parse sub-area rows from HPI tables (example: Richmond, Vancouver West).
- Do not parse property-type rows (detached/apartment/townhouse per-area tables).
- Do not parse MLS Listings Facts/Sales Facts table pages.

### Save
- Persist only the five MVP keys above.
- `gvr_sales_to_active_ratio` is computed/validated during ingestion normalization (not query-time derived).

### Show
- `home_prices` KPI and Market Snapshot show only these five MVP metrics.
- No table-derived sub-area metrics are shown until a dedicated table parser is added and validated.

## Persistence and Metric Keys
- `marketMetrics`: latest point per `(regionKey, metricKey)`.
- `metricHistory`: monthly series with upsert key `(regionKey, metricKey, date)`.
- Canonical date: report month at first-of-month UTC (example: Feb 2026 -> `2026-02-01`).
- `fetchedAt` stores ingestion timestamp.

### MVP metric keys
- `gvr_mls_benchmark_price`
- `gvr_mls_sales`
- `gvr_new_listings`
- `gvr_active_listings`
- `gvr_sales_to_active_ratio` (derived from parsed sales + active listings when both exist)

## Logging and Diagnostics
- Add structured logs per stage:
  - `source`, `step`, `status`, `url`, `reportMonth`, `durationMs`, `errorKind`, `errorMessage`.
- Expected stages:
  - discovery -> fetch_pdf -> deterministic_parse -> llm_fallback_parse (optional) -> normalize -> upsert_latest -> upsert_history.
- Keep `Promise.allSettled` in orchestrator so one source failure does not fail the full refresh.
- Optional later: `structuredSourceRuns` table for dashboard visibility.

## UI Plan (Simplified)
- `home_prices` KPI and Market Snapshot use GVR metrics only.
- Cards show source badge (`GVR Market Watch`) and reference month.
- Region picker contains only supported GVR regions.
- Category chips for `home_prices` show only GVR metrics in MVP.

## Rollout Plan
1. Phase A: Remove NHPI from `home_prices` pathway and add source-stage logs.
2. Phase B: Implement GVR discovery + checkpointing.
3. Phase C: Implement deterministic PDF parser with strict validation.
4. Phase D: Add OpenRouter fallback parser behind confidence gate.
5. Phase E: Wire source-aware UI copy/cards and complete QA.

## Acceptance Criteria
- New GVR report is detected with no manual URL edits.
- No `home_prices` ingestion depends on StatsCan NHPI ZIP download.
- `home_prices` KPI/Snapshot show GVR metrics with reference month.
- `metricHistory` maintains monthly continuity and idempotent upserts.
- Failures clearly identify the broken stage in logs.
- If parsing fails, checkpoint does not advance; next scheduled cycle retries automatically.

## Open Decisions Before Build
- Add run-log table now or keep logs-only for MVP.
- Whether LLM fallback is enabled immediately or released behind a feature flag.
