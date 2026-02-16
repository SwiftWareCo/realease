import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily market data fetch at 6:00 AM PT (13:00 UTC / 1:00 PM UTC)
 * Fetches fresh market insights for all active regions
 */
crons.daily(
    "daily-market-insights",
    { hourUTC: 13, minuteUTC: 0 },
    internal.insights.actions.dailyFetch,
    {},
);

/**
 * Cleanup expired insights weekly (Sundays at 2 AM UTC)
 */
crons.weekly(
    "cleanup-expired-insights",
    { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
    internal.insights.mutations.cleanupExpired,
    {},
);

export default crons;
