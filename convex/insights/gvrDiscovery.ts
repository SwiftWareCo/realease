import { v } from "convex/values";
import {
    internalAction,
    internalMutation,
    internalQuery,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { GVR_SOURCE_KEY } from "./ingestionCheckpoint.schema";

const GVR_LISTING_PAGE_URL =
    "https://www.gvrealtors.ca/market-watch/monthly-market-report.html";

const MONTH_TO_INDEX: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
};
const INDEX_TO_MONTH_SLUG = [
    "",
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
];

type GvrReportDescriptor = {
    reportUrl: string;
    reportMonth: string;
    reportPageUrl: string;
    listingPageUrl: string;
    publishedAt?: string;
};

type GvrCheckpoint = {
    reportUrl: string;
    reportMonth: string;
    publishedAt?: string;
    lastIngestedAt: number;
} | null;

type GvrDiscoveryResult = {
    changed: boolean;
    scheduled: boolean;
    discovered: GvrReportDescriptor;
    checkpointMonth?: string;
};

export const gvrReportDescriptorValidator = v.object({
    reportUrl: v.string(),
    reportMonth: v.string(), // YYYY-MM
    reportPageUrl: v.string(),
    listingPageUrl: v.string(),
    publishedAt: v.optional(v.string()),
});

function extractSelectedOrFirstOptionValue(selectHtml: string) {
    const selected =
        selectHtml.match(
            /<option[^>]*value=["']([^"']+)["'][^>]*selected[^>]*>/i,
        ) ??
        selectHtml.match(
            /<option[^>]*selected[^>]*value=["']([^"']+)["'][^>]*>/i,
        );
    if (selected?.[1]) {
        return selected[1].trim();
    }

    const first = selectHtml.match(/<option[^>]*value=["']([^"']+)["'][^>]*>/i);
    return first?.[1]?.trim() || null;
}

function extractSelectValue(html: string, selectId: string) {
    const selectRegex = new RegExp(
        `<select[^>]*id=["']${selectId}["'][^>]*>[\\s\\S]*?<\\/select>`,
        "i",
    );
    const selectMatch = html.match(selectRegex);
    if (!selectMatch) {
        return null;
    }
    return extractSelectedOrFirstOptionValue(selectMatch[0]);
}

function toReportMonth(monthSlug: string, yearRaw: string) {
    const monthIndex = MONTH_TO_INDEX[monthSlug.toLowerCase()];
    const year = parseInt(yearRaw, 10);
    if (!monthIndex || Number.isNaN(year) || year < 1990 || year > 2100) {
        throw new Error(
            `Unable to derive report month from month=${monthSlug}, year=${yearRaw}`,
        );
    }
    return `${year}-${String(monthIndex).padStart(2, "0")}`;
}

function extractPdfUrl(reportPageHtml: string, reportPageUrl: string) {
    const candidates = Array.from(
        reportPageHtml.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi),
    ).map((m) => m[1]);

    if (candidates.length === 0) {
        throw new Error("No PDF link found on report page");
    }

    const preferred =
        candidates.find((href) => /stats|package|market/i.test(href)) ??
        candidates[0];
    return new URL(preferred, reportPageUrl).href;
}

function extractPublishedAt(reportPageHtml: string) {
    const metaMatch = reportPageHtml.match(
        /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    );
    if (metaMatch?.[1]) return metaMatch[1];

    const timeMatch = reportPageHtml.match(
        /<time[^>]*datetime=["']([^"']+)["'][^>]*>/i,
    );
    return timeMatch?.[1];
}

async function discoverLatestReportDescriptor() {
    const listingResponse = await fetch(GVR_LISTING_PAGE_URL, {
        signal: AbortSignal.timeout(20_000),
    });
    if (!listingResponse.ok) {
        throw new Error(
            `GVR listing fetch failed with ${listingResponse.status}`,
        );
    }

    const listingHtml = await listingResponse.text();
    const monthSlug = extractSelectValue(listingHtml, "month");
    const year = extractSelectValue(listingHtml, "year");
    if (!monthSlug || !year) {
        throw new Error(
            "Unable to parse selected month/year from listing page",
        );
    }

    const reportMonth = toReportMonth(monthSlug, year);
    const reportPageUrl = `https://www.gvrealtors.ca/market-watch/monthly-market-report/${monthSlug.toLowerCase()}-${year}.html`;

    const reportPageResponse = await fetch(reportPageUrl, {
        signal: AbortSignal.timeout(20_000),
    });
    if (!reportPageResponse.ok) {
        throw new Error(
            `GVR report page fetch failed with ${reportPageResponse.status}`,
        );
    }
    const reportPageHtml = await reportPageResponse.text();
    const reportUrl = extractPdfUrl(reportPageHtml, reportPageUrl);
    const publishedAt = extractPublishedAt(reportPageHtml);

    return {
        reportUrl,
        reportMonth,
        reportPageUrl,
        listingPageUrl: GVR_LISTING_PAGE_URL,
        publishedAt,
    };
}

function parseReportMonth(reportMonth: string) {
    const match = reportMonth.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    if (year < 1990 || year > 2100) return null;
    if (month < 1 || month > 12) return null;
    return { year, month };
}

function toReportMonthFromDate(date: Date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
}

function toDateFromReportMonth(reportMonth: string) {
    const parts = parseReportMonth(reportMonth);
    if (!parts) {
        throw new Error(`Invalid reportMonth: ${reportMonth}`);
    }
    return new Date(Date.UTC(parts.year, parts.month - 1, 1));
}

async function discoverReportDescriptorForMonth(reportMonth: string) {
    const parts = parseReportMonth(reportMonth);
    if (!parts) {
        throw new Error(`Invalid reportMonth: ${reportMonth}`);
    }

    const monthSlug = INDEX_TO_MONTH_SLUG[parts.month];
    if (!monthSlug) {
        throw new Error(`No month slug for reportMonth: ${reportMonth}`);
    }

    const reportPageUrl = `https://www.gvrealtors.ca/market-watch/monthly-market-report/${monthSlug}-${parts.year}.html`;
    const reportPageResponse = await fetch(reportPageUrl, {
        signal: AbortSignal.timeout(20_000),
    });

    if (reportPageResponse.status === 404) {
        return null;
    }

    if (!reportPageResponse.ok) {
        throw new Error(
            `GVR report page fetch failed (${reportMonth}) with ${reportPageResponse.status}`,
        );
    }

    const reportPageHtml = await reportPageResponse.text();
    const reportUrl = extractPdfUrl(reportPageHtml, reportPageUrl);
    const publishedAt = extractPublishedAt(reportPageHtml);

    return {
        reportUrl,
        reportMonth,
        reportPageUrl,
        listingPageUrl: GVR_LISTING_PAGE_URL,
        publishedAt,
    };
}

export const getLatestCheckpoint = internalQuery({
    args: {},
    returns: v.union(
        v.object({
            reportUrl: v.string(),
            reportMonth: v.string(),
            publishedAt: v.optional(v.string()),
            lastIngestedAt: v.number(),
        }),
        v.null(),
    ),
    handler: async (ctx) => {
        const checkpoint = await ctx.db
            .query("ingestionCheckpoints")
            .withIndex("by_source_key", (q) =>
                q.eq("sourceKey", GVR_SOURCE_KEY),
            )
            .unique();

        if (!checkpoint) return null;
        return {
            reportUrl: checkpoint.lastArtifactUrl,
            reportMonth: checkpoint.lastArtifactPeriod,
            publishedAt: checkpoint.lastPublishedAt,
            lastIngestedAt: checkpoint.lastIngestedAt,
        };
    },
});

export const saveCheckpoint = internalMutation({
    args: {
        reportUrl: v.string(),
        reportMonth: v.string(),
        publishedAt: v.optional(v.string()),
        ingestedAt: v.number(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("ingestionCheckpoints")
            .withIndex("by_source_key", (q) =>
                q.eq("sourceKey", GVR_SOURCE_KEY),
            )
            .unique();

        const row = {
            sourceKey: GVR_SOURCE_KEY,
            lastArtifactUrl: args.reportUrl,
            lastArtifactPeriod: args.reportMonth,
            lastPublishedAt: args.publishedAt,
            lastIngestedAt: args.ingestedAt,
            updatedAt: Date.now(),
        };

        if (existing) {
            await ctx.db.patch(existing._id, row);
        } else {
            await ctx.db.insert("ingestionCheckpoints", row);
        }

        return null;
    },
});

export const discoverLatestGvrReport = internalAction({
    args: {},
    returns: v.object({
        changed: v.boolean(),
        scheduled: v.boolean(),
        discovered: gvrReportDescriptorValidator,
        checkpointMonth: v.optional(v.string()),
    }),
    handler: async (ctx): Promise<GvrDiscoveryResult> => {
        const discovered = await discoverLatestReportDescriptor();
        const checkpoint: GvrCheckpoint = await ctx.runQuery(
            internal.insights.gvrDiscovery.getLatestCheckpoint,
            {},
        );

        const changed =
            !checkpoint ||
            checkpoint.reportUrl !== discovered.reportUrl ||
            checkpoint.reportMonth !== discovered.reportMonth;

        if (!changed) {
            console.log(
                `[GVR][discovery] no_new_report month=${discovered.reportMonth} url=${discovered.reportUrl}`,
            );
            return {
                changed: false,
                scheduled: false,
                discovered,
                checkpointMonth: checkpoint.reportMonth,
            };
        }

        await ctx.scheduler.runAfter(
            0,
            internal.insights.gvrParser.ingestGvrReport,
            discovered,
        );

        console.log(
            `[GVR][discovery] new_report_detected month=${discovered.reportMonth} url=${discovered.reportUrl}`,
        );

        return {
            changed: true,
            scheduled: true,
            discovered,
            checkpointMonth: checkpoint?.reportMonth,
        };
    },
});

export const backfillRecentGvrReports = internalAction({
    args: { months: v.number() },
    returns: v.object({
        requestedMonths: v.number(),
        processed: v.number(),
        succeeded: v.number(),
        failed: v.number(),
    }),
    handler: async (ctx, args) => {
        const months = Math.max(1, Math.min(24, Math.floor(args.months)));
        const latestDescriptor = await discoverLatestReportDescriptor();
        const anchorDate = toDateFromReportMonth(latestDescriptor.reportMonth);
        const reportMonths: string[] = [];

        for (let offset = months - 1; offset >= 0; offset -= 1) {
            const monthDate = new Date(
                Date.UTC(
                    anchorDate.getUTCFullYear(),
                    anchorDate.getUTCMonth() - offset,
                    1,
                ),
            );
            reportMonths.push(toReportMonthFromDate(monthDate));
        }

        let processed = 0;
        let succeeded = 0;
        let failed = 0;

        for (const reportMonth of reportMonths) {
            try {
                const descriptor =
                    await discoverReportDescriptorForMonth(reportMonth);
                if (!descriptor) {
                    failed += 1;
                    continue;
                }

                processed += 1;
                const ingestResult = await ctx.runAction(
                    internal.insights.gvrParser.ingestGvrReport,
                    descriptor,
                );

                if (ingestResult.success) {
                    succeeded += 1;
                } else {
                    failed += 1;
                    console.error(
                        `[GVR][backfill] ingest failed for ${reportMonth}: ${ingestResult.error ?? "unknown_error"}`,
                    );
                }
            } catch (error) {
                failed += 1;
                console.error(
                    `[GVR][backfill] failed for ${reportMonth}:`,
                    error,
                );
            }
        }

        return {
            requestedMonths: months,
            processed,
            succeeded,
            failed,
        };
    },
});
