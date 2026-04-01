# Insights News Context Iteration Plan

Date: April 1, 2026  
Status: Draft for review

## 1. Why this plan exists

Recent manual fetch logs show ingestion and summary generation technically completing, but user-facing quality and visibility issues remain:

1. Market Snapshot did not appear for some users.
2. Ingested sources are often broad landing pages instead of specific, timely items.
3. News extraction frequently fails JSON parsing, reducing structured signal quality.

This plan addresses those issues without expanding scope beyond the current `Market Insights` experience.

## 2. Observed log signals

From the logs provided (April 1, 2026):

1. Structured fetch is successful (`BoC latest`, `BoC history`, `GVR discovery` all `OK`/`NO_CHANGE`).
2. News context ingestion reports `Completed 5/5 sources` for both `richmond-bc-ca` and `new-westminster-bc-ca`.
3. `extractMetrics` frequently logs `Could not parse JSON response`.
4. Summaries are generated for `richmond-bc-ca`, `new-westminster-bc-ca`, and `national-ca`.
5. `fetchAllStructuredData` runs again when manual fetch is repeated for a second region in the same settings flow.

## 3. Root causes identified

## 3.1 Market Snapshot visibility gap

For multi-region selections, the summary query targets `greater-vancouver-bc-ca` by default.  
If no summary row exists for that key, `getMarketSummary` returns `null`, so snapshot UI renders nothing.

Impact:

1. Summaries can exist for selected regions but still not show in snapshot.
2. User perceives fetch as failed even when backend succeeded.

## 3.2 Source quality mismatch

Current source registry mostly points to category/index pages (for example economics hubs, stats landing pages, monthly report index), not article/release-level URLs.

Impact:

1. Model receives broad page text instead of one clear news item.
2. Harder to extract clean numeric/context signals.
3. Lower perceived relevance for users.

## 3.3 Extraction reliability weakness

`extractMetrics` expects strict JSON output, but logs show frequent parse failures.

Impact:

1. Fallback storage still happens, but numeric metrics/data points are often empty.
2. Summary quality depends more on generic text than structured evidence.

## 3.4 Manual fetch efficiency issue

Settings manual fetch loops per saved region.  
Each loop currently invokes full structured fetch plus region ingestion and summary generation.

Impact:

1. Duplicate BoC/GVR calls in the same user action.
2. Extra cost and noise for users with 2+ regions.

## 4. Scope guardrails

In scope:

1. Snapshot visibility reliability.
2. Source quality and recency quality.
3. Extraction robustness.
4. Manual fetch efficiency.
5. Better summary input contract.

Out of scope for this iteration:

1. Building a full source admin UI.
2. New end-user article feed redesign.
3. Large model/provider changes.
4. Major multi-table analytics subsystem.

## 5. Proposed phased plan

## Phase 1: Snapshot always shows when data exists

Goal: prevent missing snapshot when backend summary rows exist.

Steps:

1. Update summary region selection logic for multi-region mode.
2. Add fallback read order in summary query:
   1. requested region
   2. first selected region (if applicable)
   3. `national-ca`
3. Ensure loading/empty states distinguish `no summary yet` vs `query unresolved`.

Acceptance:

1. If any selected region or national summary exists, Market Snapshot renders.
2. No silent blank snapshot after successful manual fetch.

## Phase 2: Upgrade source registry quality (file-first)

Goal: improve source relevance while staying editable in code.

Steps:

1. Keep file-first registry (`newsSources.ts`) as canonical config.
2. Split source types explicitly:
   1. release pages (preferred)
   2. feed/index pages (discovery only)
   3. evergreen reference pages (low weight)
3. Replace/augment landing URLs with direct release/article URLs where possible.
4. Add region layering rule:
   1. national baseline
   2. province baseline
   3. region-specific overlays

Acceptance:

1. Majority of ingested items are specific releases/articles, not hubs.
2. Relevance of stored summaries improves in manual QA.

## Phase 3: Harden extraction pipeline

Goal: reduce parse-failure rate and preserve structured outputs.

Steps:

1. Add strict response normalization/repair before JSON parse.
2. Use source-type-specific extraction prompts (release vs index page).
3. Add parse-failure metrics counters and per-source failure tracking.
4. Keep fallback storage, but mark extraction confidence.

Acceptance:

1. Parse failure rate materially drops.
2. Numeric/data-point extraction appears consistently for high-quality sources.

## Phase 4: Recency-aware summary contract

Goal: prevent misleading “latest/today” claims.

Steps:

1. Include explicit dates in summary input:
   1. `today` (system date)
   2. per-item `publishedAt` if available
   3. fallback `fetchedAt`
   4. metric `referenceDate`
2. Add prompt rules:
   1. Use absolute dates.
   2. Only claim “latest” within freshness window.
   3. If stale, say “as of YYYY-MM-DD”.
3. Weight source trust + freshness in context ranking.

Acceptance:

1. Summary text consistently contains defensible date framing.
2. Fewer vague recency claims.

## Phase 5: Manual fetch orchestration efficiency

Goal: avoid duplicate structured fetch work.

Steps:

1. Batch manual fetch execution:
   1. run structured fetch once
   2. run region news ingestion for each selected region
   3. generate summaries
2. Return per-region result summary in one operation.

Acceptance:

1. One settings action no longer repeats BoC/GVR structured fetch per region.
2. Lower latency and cleaner logs for multi-region users.

## 6. Risks and mitigations

Risk: source URLs still return poor extractable content.  
Mitigation: maintain per-source success/parse metrics and prune low performers.

Risk: summary still missing for uncommon region keys.  
Mitigation: explicit fallback chain and logging for missing summary keys.

Risk: prompt changes increase token/cost.  
Mitigation: bound source count and context snippet length.

## 7. Metrics to track during iteration

1. Snapshot render success rate after manual fetch.
2. Extraction JSON parse success rate by source.
3. Numeric metrics extracted per ingestion run.
4. Structured fetch calls per manual-fetch session.
5. Median manual-fetch completion time.

## 8. Open questions for next review

1. Should multi-region snapshot default to `national-ca` or “first selected region”?
2. Should we keep ingesting known monthly sources daily, or detect cadence and downsample?
3. What minimum parse success threshold triggers disabling a source?
4. Do we want a separate “portfolio summary” when users have 3+ regions?

## 9. Recommended immediate sequence

1. Implement Phase 1 (snapshot fallback) first.
2. Implement Phase 5 (manual fetch batching) second.
3. Then run Phase 2 and Phase 3 together on source quality and extraction reliability.
4. Finish with Phase 4 recency contract once quality inputs are stable.
