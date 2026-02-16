import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getSourcesForRegion, hasSourcesForRegion } from "./sources";

// Jina AI Reader API - free, no auth required
// https://github.com/jina-ai/reader
const JINA_API_BASE = "https://r.jina.ai/";

function buildJinaUrl(sourceUrl: string) {
    const hasProtocol = /^https?:\/\//i.test(sourceUrl);
    const normalizedUrl = hasProtocol ? sourceUrl : `https://${sourceUrl}`;
    return `${JINA_API_BASE}${normalizedUrl}`;
}

type JinaFetchResult = {
    success: boolean;
    content?: string;
    summary?: string;
    title?: string;
    error?: string;
};

type RegionFetchResult = {
    success: boolean;
    fetched?: number;
    total?: number;
    error?: string;
};

type DailyFetchResult = {
    success: boolean;
    regionsFetched: number;
    totalRegions: number;
};

type SourceFetchResult = { source: string; success: boolean };

const jinaFetchResultSchema = v.object({
    success: v.boolean(),
    content: v.optional(v.string()),
    summary: v.optional(v.string()),
    title: v.optional(v.string()),
    error: v.optional(v.string()),
});

const regionFetchResultSchema = v.object({
    success: v.boolean(),
    fetched: v.optional(v.number()),
    total: v.optional(v.number()),
    error: v.optional(v.string()),
});

const dailyFetchResultSchema = v.object({
    success: v.boolean(),
    regionsFetched: v.number(),
    totalRegions: v.number(),
});

type ParsedJinaBody = {
    title?: string;
    content?: string;
    description?: string;
    warning?: string;
    data?: {
        title?: string;
        content?: string;
        description?: string;
        warning?: string;
    };
};

function cleanText(input: string) {
    return input
        .replace(/\r/g, "")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/`{1,3}/g, "")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\s+/g, " ")
        .trim();
}

function buildSummary(content: string, maxLength: number = 420) {
    const normalized = cleanText(content);
    if (!normalized) {
        return "Summary unavailable. Open the source for details.";
    }

    const sentences = normalized.match(/[^.!?]+[.!?]+/g);
    const candidate =
        sentences && sentences.length > 0
            ? sentences.slice(0, 3).join(" ").trim()
            : normalized;

    if (candidate.length <= maxLength) {
        return candidate;
    }

    return `${candidate.slice(0, maxLength).trimEnd()}...`;
}

function extractFromJsonBody(raw: string, fallbackTitle: string) {
    try {
        const parsed = JSON.parse(raw) as ParsedJinaBody;
        const source = parsed.data ?? parsed;
        const warning = source.warning;
        const title = source.title?.trim() || fallbackTitle;
        const content = source.content || source.description;

        if (!content) {
            return null;
        }

        return {
            title,
            content: cleanText(content),
            summary: buildSummary(content),
            warning,
        };
    } catch {
        return null;
    }
}

function extractFromTextBody(raw: string, fallbackTitle: string) {
    const lines = raw.split("\n");
    let title = fallbackTitle;
    let content = raw;

    if (lines[0]?.startsWith("# ")) {
        title = lines[0].replace("# ", "").trim() || fallbackTitle;
        content = lines.slice(1).join("\n").trim();
    } else if (lines[0]?.startsWith("Title: ")) {
        title = lines[0].replace("Title: ", "").trim() || fallbackTitle;
        content = lines.slice(1).join("\n").trim();
    }

    const normalizedContent = cleanText(content);
    if (!normalizedContent) {
        return null;
    }

    return {
        title,
        content: normalizedContent,
        summary: buildSummary(normalizedContent),
        warning: undefined as string | undefined,
    };
}

/**
 * Fetch content from a URL using Jina AI Reader (FREE)
 * Falls back gracefully on failure
 */
export const fetchWithJina = internalAction({
    args: {
        url: v.string(),
        sourceName: v.string(),
        regionKey: v.string(),
    },
    returns: jinaFetchResultSchema,
    handler: async (
        ctx,
        { url, sourceName, regionKey },
    ): Promise<JinaFetchResult> => {
        try {
            const jinaUrl = buildJinaUrl(url);

            console.log(`[Jina] Fetching: ${sourceName} (${url})`);

            const response = await fetch(jinaUrl, {
                headers: {
                    Accept: "application/json",
                    "X-With-Links-Summary": "true",
                },
                // Jina is usually fast, but give it some time
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                throw new Error(`Jina API returned ${response.status}`);
            }

            const raw = await response.text();
            const jsonResult = extractFromJsonBody(raw, sourceName);
            const normalized =
                jsonResult ?? extractFromTextBody(raw, sourceName);

            if (!normalized) {
                throw new Error("No readable content from source");
            }

            if (
                normalized.warning &&
                /404|not found/i.test(normalized.warning)
            ) {
                throw new Error(`Source unavailable: ${normalized.warning}`);
            }

            console.log(
                `[Jina] Success: ${sourceName} - ${normalized.content.length} chars`,
            );

            // Log the fetch
            await ctx.runMutation(internal.insights.mutations.logFetch, {
                regionKey,
                sourceUrl: url,
                sourceName,
                success: true,
                contentLength: normalized.content.length,
            });

            return {
                success: true,
                content: normalized.content,
                summary: normalized.summary,
                title: normalized.title,
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.error(`[Jina] Failed: ${sourceName} - ${errorMessage}`);

            // Log the failure
            await ctx.runMutation(internal.insights.mutations.logFetch, {
                regionKey,
                sourceUrl: url,
                sourceName,
                success: false,
                errorMessage,
            });

            return {
                success: false,
                error: errorMessage,
            };
        }
    },
});

/**
 * Fetch all sources for a specific region
 */
export const fetchRegionData = internalAction({
    args: {
        city: v.string(),
        state: v.optional(v.string()),
        country: v.string(),
    },
    returns: regionFetchResultSchema,
    handler: async (
        ctx,
        { city, state, country },
    ): Promise<RegionFetchResult> => {
        const regionKey = `${city.toLowerCase().replace(/\s+/g, "-")}-${state?.toLowerCase() || ""}-${country.toLowerCase()}`;

        if (!hasSourcesForRegion(city, state, country)) {
            console.log(`[Insights] No sources for region: ${regionKey}`);
            return { success: false, error: "No sources for region" };
        }

        const sources = getSourcesForRegion(city, state, country);
        console.log(
            `[Insights] Fetching ${sources.length} sources for ${regionKey}`,
        );

        // Fetch all sources in parallel
        const results: SourceFetchResult[] = await Promise.all(
            sources.map(async (source) => {
                const result: JinaFetchResult = await ctx.runAction(
                    internal.insights.actions.fetchWithJina,
                    {
                        url: source.url,
                        sourceName: source.name,
                        regionKey,
                    },
                );

                if (result.success && result.content) {
                    // Store the insight
                    // Pick the primary category for storage
                    const primaryCategory =
                        source.categories[0] || "market_trend";

                    await ctx.runMutation(
                        internal.insights.mutations.storeInsight,
                        {
                            regionKey,
                            region: { city, state, country },
                            category: primaryCategory,
                            title: result.title || source.name,
                            summary:
                                result.summary || buildSummary(result.content),
                            sourceUrl: source.url,
                            sourceName: source.name,
                            rawContent: result.content,
                            relevanceScore: 80, // Default score, could be improved with AI
                        },
                    );
                }

                return {
                    source: source.name,
                    success: result.success,
                };
            }),
        );

        const successCount = results.filter((r) => r.success).length;
        console.log(
            `[Insights] Completed: ${successCount}/${results.length} sources fetched for ${regionKey}`,
        );

        return {
            success: true,
            fetched: successCount,
            total: results.length,
        };
    },
});

/**
 * Daily fetch job - triggered by cron
 * Fetches data for all unique regions that have users
 */
export const dailyFetch = internalAction({
    args: {},
    returns: dailyFetchResultSchema,
    handler: async (ctx): Promise<DailyFetchResult> => {
        console.log("[Insights] Starting daily fetch job");

        // Get all unique regions from users with a configured region
        const users = await ctx.runQuery(
            internal.insights.queries.getActiveRegions,
        );

        if (users.length === 0) {
            console.log("[Insights] No active regions to fetch");
            return { success: true, regionsFetched: 0, totalRegions: 0 };
        }

        // Get unique regions
        const uniqueRegions = new Map<
            string,
            { city: string; state?: string; country: string }
        >();

        for (const user of users) {
            if (user.region) {
                const key = `${user.region.city}-${user.region.state || ""}-${user.region.country}`;
                if (!uniqueRegions.has(key)) {
                    uniqueRegions.set(key, user.region);
                }
            }
        }

        console.log(
            `[Insights] Fetching for ${uniqueRegions.size} unique regions`,
        );

        // Fetch for each region (sequential to be nice to Jina API)
        let totalFetched = 0;
        for (const [key, region] of uniqueRegions) {
            try {
                const result = await ctx.runAction(
                    internal.insights.actions.fetchRegionData,
                    {
                        city: region.city,
                        state: region.state,
                        country: region.country,
                    },
                );

                if (result.success) {
                    totalFetched++;
                }

                // Small delay between regions to be polite
                await new Promise((r) => setTimeout(r, 2000));
            } catch (error) {
                console.error(
                    `[Insights] Failed to fetch region ${key}:`,
                    error,
                );
            }
        }

        console.log(
            `[Insights] Daily fetch complete: ${totalFetched}/${uniqueRegions.size} regions`,
        );

        return {
            success: true,
            regionsFetched: totalFetched,
            totalRegions: uniqueRegions.size,
        };
    },
});

/**
 * Manually trigger a fetch for testing
 */
export const manualFetch = action({
    args: {
        city: v.string(),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
    },
    returns: regionFetchResultSchema,
    handler: async (
        ctx,
        { city, state, country = "CA" },
    ): Promise<RegionFetchResult> => {
        // Verify user is authenticated
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        return await ctx.runAction(internal.insights.actions.fetchRegionData, {
            city,
            state,
            country,
        });
    },
});
