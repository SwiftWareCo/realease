import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Cleanup expired insights weekly (every 168 hours)
 */
crons.interval(
    "cleanup-expired-insights",
    { hours: 168 },
    internal.insights.mutations.cleanupExpired,
    {},
);

/**
 * Fetch latest Bank of Canada rates daily.
 */
crons.interval(
    "fetch-boc-rates",
    { hours: 24 },
    internal.insights.apiFetchers.fetchBankOfCanadaRates,
    {},
);

/**
 * Check for the latest GVR monthly report daily.
 */
crons.interval(
    "discover-latest-gvr-report",
    { hours: 24 },
    internal.insights.gvrDiscovery.discoverLatestGvrReport,
    {},
);

/**
 * Outreach stale call cleanup guard (every 10 minutes)
 * Closes stuck queued/ringing/in_progress calls into terminal failed state.
 */
crons.interval(
    "cleanup-stale-outreach-calls",
    { minutes: 10 },
    internal.outreach.mutations.cleanupStaleActiveCalls,
    {},
);

/**
 * Outreach state reconciliation watchdog (every 15 minutes)
 * Catches missed scheduled handlers and recovers stale state rows.
 * Replaces the old 5-minute runOutreachAutomation cron.
 */
crons.interval(
    "reconcile-outreach-lead-states",
    { minutes: 15 },
    internal.outreach.campaignLeadState.reconcileDueCampaignLeadStates,
    {},
);

export default crons;
