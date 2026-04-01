import { action, internalAction, type ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
    getNewsContextSourcesForRegion,
    hasNewsContextSourcesForRegion,
    type NewsContextSource,
} from "./newsSources";
import { NATIONAL_REGION_KEY } from "./metrics.schema";

// Jina AI Reader API - free, no auth required
// https://github.com/jina-ai/reader
// Metric keys owned by the BoC structured API — never overwrite with AI extraction
const BOC_OWNED_METRIC_KEYS = new Set([
    "boc_policy_rate",
    "prime_rate",
    "5yr_fixed_mortgage",
    "3yr_fixed_mortgage",
]);

const JINA_API_BASE = "https://r.jina.ai/";
const JINA_TIMEOUT_MS = 25_000;
const JINA_MAX_ATTEMPTS = 2;

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

type GvrBackfillResult = {
    requestedMonths: number;
    processed: number;
    succeeded: number;
    failed: number;
};
type ManualBatchResult = {
    success: boolean;
    totalRegions: number;
    succeededRegions: number;
    failedRegions: number;
};

type SourceFetchResult = { source: string; success: boolean };
type SourceCandidate = {
    url: string;
    title?: string;
    publishedAt?: string;
};
type RegionInput = { city: string; state?: string; country: string };
type ExtractedDataPoint = {
    label: string;
    value: string;
    trend?: "up" | "down" | "neutral";
};
type ExtractedNumericMetric = {
    metricKey: string;
    label: string;
    value: number;
    formattedValue: string;
    unit: string;
    category:
        | "mortgage_rates"
        | "home_prices"
        | "inventory"
        | "market_trend"
        | "rental";
    trend: "up" | "down" | "neutral";
};
type ExtractionPayload = {
    dataPoints: ExtractedDataPoint[];
    aiSummary?: string;
    marketCondition?: "buyers" | "balanced" | "sellers";
    numericMetrics: ExtractedNumericMetric[];
};
type SharedNewsContextCache = {
    discoveredTargetBySourceId: Map<string, SourceCandidate>;
    fetchedByUrl: Map<string, JinaFetchResult>;
    extractionByUrlAndCategory: Map<string, ExtractionPayload>;
};

const EMPTY_EXTRACTION_PAYLOAD: ExtractionPayload = {
    dataPoints: [],
    aiSummary: undefined,
    marketCondition: undefined,
    numericMetrics: [],
};

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

const gvrBackfillResultSchema = v.object({
    requestedMonths: v.number(),
    processed: v.number(),
    succeeded: v.number(),
    failed: v.number(),
});

const manualBatchResultSchema = v.object({
    success: v.boolean(),
    totalRegions: v.number(),
    succeededRegions: v.number(),
    failedRegions: v.number(),
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

type NormalizedSourceBody = {
    title: string;
    content: string;
    summary: string;
    warning?: string;
    fromJson: boolean;
};

const MIN_SOURCE_CONTENT_LENGTH = 120;

function buildRegionKey(region: RegionInput) {
    return `${region.city.toLowerCase().replace(/\s+/g, "-")}-${region.state?.toLowerCase() || ""}-${region.country.toLowerCase()}`;
}

function clampRelevanceScore(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

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

function looksLikeJsonBlob(input: string) {
    const trimmed = input.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
        return false;
    }
    return /"status"\s*:|"code"\s*:|"data"\s*:|"warning"\s*:/.test(trimmed);
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

function extractFromJsonBody(
    raw: string,
    fallbackTitle: string,
): NormalizedSourceBody | null {
    try {
        const parsed = JSON.parse(raw) as ParsedJinaBody;
        const source = parsed.data ?? parsed;
        const warning = source.warning;
        const title = source.title?.trim() || fallbackTitle;
        const content = cleanText(source.content || source.description || "");

        return {
            title,
            content,
            summary: content
                ? buildSummary(content)
                : "Summary unavailable. Open the source for details.",
            warning,
            fromJson: true,
        };
    } catch {
        return null;
    }
}

function extractFromTextBody(
    raw: string,
    fallbackTitle: string,
): NormalizedSourceBody | null {
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
        fromJson: false,
    };
}

function decodeXmlEntities(input: string) {
    return input
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function normalizeDiscoveredUrl(rawUrl: string) {
    try {
        const parsed = new URL(rawUrl);
        const paramsToDrop = [
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "fbclid",
            "gclid",
        ];
        for (const param of paramsToDrop) {
            parsed.searchParams.delete(param);
        }
        parsed.hash = "";
        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

function toDateMs(input?: string) {
    if (!input) return -Infinity;
    const parsed = Date.parse(input);
    return Number.isFinite(parsed) ? parsed : -Infinity;
}

function scoreHousingRelevance(text: string) {
    const normalized = text.toLowerCase();
    let score = 0;
    const keywords = [
        "housing",
        "home sales",
        "mls",
        "benchmark",
        "inventory",
        "listings",
        "detached",
        "condo",
        "townhome",
        "market",
        "mortgage",
        "rate",
        "policy rate",
    ];
    for (const keyword of keywords) {
        if (normalized.includes(keyword)) {
            score += 1;
        }
    }
    return score;
}

function parseAtomFeedCandidates(rawXml: string): SourceCandidate[] {
    const entryRegex = /<entry\b[\s\S]*?<\/entry>/gi;
    const entries = rawXml.match(entryRegex) ?? [];
    const candidates: SourceCandidate[] = [];

    for (const entry of entries) {
        const linkMatch =
            entry.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i) ?? null;
        const titleMatch = entry.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
        const summaryMatch = entry.match(
            /<summary\b[^>]*>([\s\S]*?)<\/summary>/i,
        );
        const categoryMatch = entry.match(
            /<category\b[^>]*\bterm=["']([^"']+)["'][^>]*>/i,
        );
        const publishedMatch =
            entry.match(/<published\b[^>]*>([\s\S]*?)<\/published>/i) ??
            entry.match(/<updated\b[^>]*>([\s\S]*?)<\/updated>/i);

        if (!linkMatch?.[1]) {
            continue;
        }

        const title = decodeXmlEntities(titleMatch?.[1]?.trim() ?? "");
        const summary = decodeXmlEntities(summaryMatch?.[1]?.trim() ?? "");
        const category = (categoryMatch?.[1] ?? "").toLowerCase();
        const score =
            scoreHousingRelevance(`${title} ${summary}`) +
            (category === "statistics" || category === "press releases"
                ? 2
                : 0);

        if (score < 2) {
            continue;
        }

        candidates.push({
            url: normalizeDiscoveredUrl(decodeXmlEntities(linkMatch[1].trim())),
            title,
            publishedAt: publishedMatch?.[1]?.trim(),
        });
    }

    return candidates.sort(
        (a, b) => toDateMs(b.publishedAt) - toDateMs(a.publishedAt),
    );
}

function parseRdfFeedCandidates(rawXml: string): SourceCandidate[] {
    const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
    const items = rawXml.match(itemRegex) ?? [];
    const candidates: Array<SourceCandidate & { score: number }> = [];

    for (const item of items) {
        const aboutMatch = item.match(
            /<item\b[^>]*\brdf:about=["']([^"']+)["']/i,
        );
        const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
        const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
        const descriptionMatch = item.match(
            /<description>([\s\S]*?)<\/description>/i,
        );
        const dateMatch = item.match(/<dc:date>([\s\S]*?)<\/dc:date>/i);

        const rawUrl =
            aboutMatch?.[1]?.trim() ?? decodeXmlEntities(linkMatch?.[1] ?? "");
        if (!rawUrl) {
            continue;
        }

        const title = decodeXmlEntities(titleMatch?.[1]?.trim() ?? "");
        const description = decodeXmlEntities(
            descriptionMatch?.[1]?.trim() ?? "",
        );
        const url = normalizeDiscoveredUrl(rawUrl);
        const score = scoreHousingRelevance(`${title} ${description} ${url}`);

        candidates.push({
            url,
            title,
            publishedAt: dateMatch?.[1]?.trim(),
            score,
        });
    }

    const policyFirst = candidates
        .filter((candidate) => candidate.score >= 2)
        .sort((a, b) => toDateMs(b.publishedAt) - toDateMs(a.publishedAt));

    if (policyFirst.length > 0) {
        return policyFirst.map((candidate) => ({
            url: candidate.url,
            title: candidate.title,
            publishedAt: candidate.publishedAt,
        }));
    }

    return candidates
        .sort((a, b) => toDateMs(b.publishedAt) - toDateMs(a.publishedAt))
        .slice(0, 1)
        .map((candidate) => ({
            url: candidate.url,
            title: candidate.title,
            publishedAt: candidate.publishedAt,
        }));
}

function toYearMonth(date: Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function shiftMonth(date: Date, offset: number) {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1),
    );
}

async function discoverBcreaMonthlyPdfCandidate(): Promise<SourceCandidate[]> {
    const now = new Date();
    for (let offset = 0; offset > -12; offset--) {
        const date = shiftMonth(now, offset);
        const yearMonth = toYearMonth(date);
        const url = `https://www.bcrea.bc.ca/wp-content/uploads/${yearMonth}HousingMarketUpdate_charts.pdf`;
        try {
            const response = await fetch(url, {
                method: "HEAD",
                signal: AbortSignal.timeout(8_000),
            });
            if (!response.ok) {
                continue;
            }
            const contentType = response.headers.get("content-type") ?? "";
            if (!contentType.toLowerCase().includes("pdf")) {
                continue;
            }

            return [
                {
                    url,
                    title: `BCREA Housing Market Update ${yearMonth}`,
                    publishedAt: `${yearMonth}-01`,
                },
            ];
        } catch {
            // Continue scanning older months.
        }
    }

    return [];
}

async function discoverSourceCandidates(
    source: NewsContextSource,
): Promise<SourceCandidate[]> {
    if (source.sourceKind === "monthly_pdf_discovery") {
        return discoverBcreaMonthlyPdfCandidate();
    }

    if (source.sourceKind !== "atom_feed" && source.sourceKind !== "rdf_feed") {
        return [{ url: source.url, title: source.name }];
    }

    const response = await fetch(source.url, {
        signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
        throw new Error(`Source discovery fetch failed (${response.status})`);
    }

    const body = await response.text();
    if (source.sourceKind === "atom_feed") {
        return parseAtomFeedCandidates(body);
    }
    return parseRdfFeedCandidates(body);
}

function createSharedNewsContextCache(): SharedNewsContextCache {
    return {
        discoveredTargetBySourceId: new Map<string, SourceCandidate>(),
        fetchedByUrl: new Map<string, JinaFetchResult>(),
        extractionByUrlAndCategory: new Map<string, ExtractionPayload>(),
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

            let response: Response | null = null;
            for (let attempt = 1; attempt <= JINA_MAX_ATTEMPTS; attempt++) {
                try {
                    response = await fetch(jinaUrl, {
                        headers: {
                            Accept: "application/json",
                            "X-With-Links-Summary": "true",
                        },
                        signal: AbortSignal.timeout(JINA_TIMEOUT_MS),
                    });

                    if (
                        !response.ok &&
                        (response.status === 429 || response.status >= 500) &&
                        attempt < JINA_MAX_ATTEMPTS
                    ) {
                        console.warn(
                            `[Jina] ${sourceName} returned ${response.status}, retrying (${attempt}/${JINA_MAX_ATTEMPTS})`,
                        );
                        await new Promise((resolve) =>
                            setTimeout(resolve, attempt * 1_000),
                        );
                        continue;
                    }

                    break;
                } catch (error) {
                    const isAbortError =
                        error instanceof Error && error.name === "AbortError";

                    if (isAbortError && attempt < JINA_MAX_ATTEMPTS) {
                        console.warn(
                            `[Jina] Timeout for ${sourceName}, retrying (${attempt}/${JINA_MAX_ATTEMPTS})`,
                        );
                        await new Promise((resolve) =>
                            setTimeout(resolve, attempt * 1_000),
                        );
                        continue;
                    }
                    throw error;
                }
            }

            if (!response) {
                throw new Error("No response from Jina");
            }

            if (!response.ok) {
                throw new Error(`Jina API returned ${response.status}`);
            }

            const raw = await response.text();
            const jsonResult = extractFromJsonBody(raw, sourceName);
            const normalized =
                jsonResult ??
                (looksLikeJsonBlob(raw)
                    ? null
                    : extractFromTextBody(raw, sourceName));

            if (!normalized) {
                throw new Error("No readable content from source");
            }

            if (normalized.content.length < MIN_SOURCE_CONTENT_LENGTH) {
                throw new Error(
                    `Source content too short (${normalized.content.length} chars)`,
                );
            }

            if (normalized.fromJson && !normalized.content) {
                throw new Error("JSON payload had no readable content");
            }

            if (
                normalized.warning &&
                /404|not found|forbidden|blocked|captcha|access denied/i.test(
                    normalized.warning,
                )
            ) {
                throw new Error(`Source unavailable: ${normalized.warning}`);
            }

            if (looksLikeJsonBlob(normalized.content)) {
                throw new Error("Source content was JSON payload metadata");
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

async function ingestNewsContextForRegionImpl(
    ctx: ActionCtx,
    { city, state, country }: RegionInput,
    sharedCache?: SharedNewsContextCache,
): Promise<RegionFetchResult> {
    const region = { city, state, country };
    const regionKey = buildRegionKey(region);

    if (!hasNewsContextSourcesForRegion(city, state, country)) {
        console.log(
            `[NewsContext] No sources configured for region: ${regionKey}`,
        );
        return {
            success: false,
            error: "No news sources configured for region",
        };
    }

    const sources = getNewsContextSourcesForRegion(city, state, country);
    console.log(
        `[NewsContext] Ingesting ${sources.length} sources for ${regionKey}`,
    );

    // Resolve source URLs first (feed/PDF discovery), then fetch in parallel.
    const fetchedSources = await Promise.all(
        sources.map(async (source) => {
            const fallbackTarget: SourceCandidate = {
                url: source.url,
                title: source.name,
            };

            const cachedTarget = sharedCache?.discoveredTargetBySourceId.get(
                source.id,
            );
            if (cachedTarget) {
                const cachedFetch = sharedCache?.fetchedByUrl.get(
                    cachedTarget.url,
                );
                if (cachedFetch) {
                    return {
                        source,
                        target: cachedTarget,
                        result: cachedFetch,
                    };
                }

                const result = await ctx.runAction(
                    internal.insights.actions.fetchWithJina,
                    {
                        url: cachedTarget.url,
                        sourceName: source.name,
                        regionKey,
                    },
                );
                sharedCache?.fetchedByUrl.set(cachedTarget.url, result);
                return { source, target: cachedTarget, result };
            }

            try {
                const discoveredCandidates =
                    await discoverSourceCandidates(source);
                if (discoveredCandidates.length === 0) {
                    throw new Error("No candidate URLs discovered");
                }
                const target = discoveredCandidates[0];
                sharedCache?.discoveredTargetBySourceId.set(source.id, target);

                const cachedFetch = sharedCache?.fetchedByUrl.get(target.url);
                const result =
                    cachedFetch ??
                    (await ctx.runAction(
                        internal.insights.actions.fetchWithJina,
                        {
                            url: target.url,
                            sourceName: source.name,
                            regionKey,
                        },
                    ));
                if (!cachedFetch) {
                    sharedCache?.fetchedByUrl.set(target.url, result);
                }
                return { source, target, result };
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                console.warn(
                    `[NewsContext] Source discovery failed for ${source.name}: ${errorMessage}`,
                );

                sharedCache?.discoveredTargetBySourceId.set(
                    source.id,
                    fallbackTarget,
                );
                const cachedFallbackFetch = sharedCache?.fetchedByUrl.get(
                    fallbackTarget.url,
                );
                if (cachedFallbackFetch) {
                    return {
                        source,
                        target: fallbackTarget,
                        result: cachedFallbackFetch,
                    };
                }

                const fallbackResult = {
                    success: false,
                    error: `source_discovery_failed: ${errorMessage}`,
                } satisfies JinaFetchResult;
                sharedCache?.fetchedByUrl.set(
                    fallbackTarget.url,
                    fallbackResult,
                );

                return {
                    source,
                    target: fallbackTarget,
                    result: fallbackResult,
                };
            }
        }),
    );

    // Process extraction + storage in parallel for all fetched sources.
    const results: SourceFetchResult[] = await Promise.all(
        fetchedSources.map(async ({ source, target, result }) => {
            if (!result.success || !result.content) {
                return {
                    source: source.name,
                    success: result.success,
                };
            }

            const primaryCategory = source.categories[0] || "market_trend";
            const extractionCacheKey = `${target.url}|${primaryCategory}`;
            let dataPoints: ExtractedDataPoint[] | undefined;
            let aiSummary: string | undefined;

            try {
                const cachedExtraction =
                    sharedCache?.extractionByUrlAndCategory.get(
                        extractionCacheKey,
                    );
                const extraction =
                    cachedExtraction ??
                    (await ctx.runAction(
                        internal.insights.extractMetrics
                            .extractDataPointsFromContent,
                        {
                            rawContent: result.content,
                            category: primaryCategory,
                            regionKey,
                        },
                    ));
                if (!cachedExtraction) {
                    sharedCache?.extractionByUrlAndCategory.set(
                        extractionCacheKey,
                        extraction,
                    );
                }

                if (extraction.dataPoints.length > 0) {
                    dataPoints = extraction.dataPoints;
                }
                aiSummary = extraction.aiSummary;

                // Upsert numeric metrics into marketMetrics table.
                const now = Date.now();
                const expiresAt = now + 48 * 60 * 60 * 1000;
                for (const metric of extraction.numericMetrics) {
                    // Skip metrics owned by the BoC structured API.
                    if (BOC_OWNED_METRIC_KEYS.has(metric.metricKey)) {
                        continue;
                    }
                    await ctx.runMutation(
                        internal.insights.metricsMutations.upsertMetric,
                        {
                            regionKey,
                            metricKey: metric.metricKey,
                            label: metric.label,
                            value: metric.value,
                            formattedValue: metric.formattedValue,
                            trend: metric.trend,
                            unit: metric.unit,
                            category: metric.category,
                            source: "ai_extracted",
                            sourceLabel: source.name,
                            referenceDate: new Date()
                                .toISOString()
                                .split("T")[0],
                            fetchedAt: now,
                            expiresAt,
                        },
                    );
                }
            } catch (extractionError) {
                console.warn(
                    `[NewsContext] LLM extraction failed for ${source.name}, storing context without data points`,
                    extractionError instanceof Error
                        ? extractionError.message
                        : extractionError,
                );
                sharedCache?.extractionByUrlAndCategory.set(
                    extractionCacheKey,
                    EMPTY_EXTRACTION_PAYLOAD,
                );
            }

            const safeSummary =
                result.summary && !looksLikeJsonBlob(result.summary)
                    ? result.summary
                    : buildSummary(result.content);

            await ctx.runMutation(internal.insights.mutations.storeInsight, {
                regionKey,
                region,
                category: primaryCategory,
                title: result.title || target.title || source.name,
                summary: safeSummary,
                sourceUrl: target.url,
                sourceName: source.name,
                rawContent: result.content,
                relevanceScore: clampRelevanceScore(source.trustWeight),
                dataPoints,
                aiSummary,
            });

            return {
                source: source.name,
                success: true,
            };
        }),
    );

    const successCount = results.filter((r) => r.success).length;
    console.log(
        `[NewsContext] Completed ${successCount}/${results.length} sources for ${regionKey}`,
    );

    return {
        success: true,
        fetched: successCount,
        total: results.length,
    };
}

/**
 * Ingest regional news context sources for a specific region.
 */
export const ingestNewsContextForRegion = internalAction({
    args: {
        city: v.string(),
        state: v.optional(v.string()),
        country: v.string(),
    },
    returns: regionFetchResultSchema,
    handler: async (ctx, args): Promise<RegionFetchResult> => {
        return ingestNewsContextForRegionImpl(ctx, args);
    },
});

/**
 * @deprecated Use ingestNewsContextForRegion.
 */
export const fetchRegionData = internalAction({
    args: {
        city: v.string(),
        state: v.optional(v.string()),
        country: v.string(),
    },
    returns: regionFetchResultSchema,
    handler: async (ctx, args): Promise<RegionFetchResult> => {
        console.warn(
            "[Insights] fetchRegionData is deprecated; use ingestNewsContextForRegion",
        );
        return ingestNewsContextForRegionImpl(ctx, args);
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
        console.log("[Insights] Starting daily structured + news context job");
        const sharedCache = createSharedNewsContextCache();

        const users = await ctx.runQuery(
            internal.insights.queries.getActiveRegions,
        );
        const uniqueRegions = new Map<string, RegionInput>();
        for (const userRegion of users) {
            const region: RegionInput = {
                city: userRegion.region.city,
                state: userRegion.region.state,
                country: userRegion.region.country,
            };
            const regionKey = buildRegionKey(region);
            if (!uniqueRegions.has(regionKey)) {
                uniqueRegions.set(regionKey, region);
            }
        }

        try {
            await ctx.runAction(
                internal.insights.apiFetchers.fetchAllStructuredData,
            );
        } catch (error) {
            console.error("[Insights] Structured data fetch failed:", error);
        }

        for (const [regionKey, region] of uniqueRegions) {
            try {
                const newsResult = await ingestNewsContextForRegionImpl(
                    ctx,
                    region,
                    sharedCache,
                );
                if (!newsResult.success) {
                    console.warn(
                        `[NewsContext] Ingestion returned non-success for ${regionKey}: ${newsResult.error ?? "unknown_error"}`,
                    );
                }
            } catch (error) {
                console.error(
                    `[NewsContext] Failed to ingest context for ${regionKey}:`,
                    error,
                );
            }

            try {
                await ctx.runAction(
                    internal.insights.marketSummary.generateMarketSummary,
                    { regionKey },
                );
            } catch (error) {
                console.error(
                    `[Insights] Failed to generate summary for ${regionKey}:`,
                    error,
                );
            }
        }

        try {
            await ctx.runAction(
                internal.insights.marketSummary.generateMarketSummary,
                { regionKey: NATIONAL_REGION_KEY },
            );
        } catch (error) {
            console.error(
                "[Insights] Failed to generate national summary:",
                error,
            );
        }

        return {
            success: true,
            regionsFetched: uniqueRegions.size,
            totalRegions: uniqueRegions.size,
        };
    },
});

/**
 * Run a manual refresh for one or more regions.
 * Structured fetch runs once, then per-region context+summary.
 */
async function runManualFetchBatch(
    ctx: ActionCtx,
    inputRegions: RegionInput[],
): Promise<ManualBatchResult> {
    const sharedCache = createSharedNewsContextCache();
    const uniqueRegions = new Map<string, RegionInput>();
    for (const region of inputRegions) {
        const regionKey = buildRegionKey(region);
        if (!uniqueRegions.has(regionKey)) {
            uniqueRegions.set(regionKey, region);
        }
    }

    if (uniqueRegions.size === 0) {
        return {
            success: false,
            totalRegions: 0,
            succeededRegions: 0,
            failedRegions: 0,
        };
    }

    let structuredFetchSucceeded = true;
    try {
        await ctx.runAction(
            internal.insights.apiFetchers.fetchAllStructuredData,
        );
    } catch (error) {
        structuredFetchSucceeded = false;
        console.error("[ManualFetch] Structured data fetch failed:", error);
    }

    let succeededRegions = 0;
    let failedRegions = 0;

    for (const [regionKey, region] of uniqueRegions) {
        let regionSucceeded = true;

        try {
            const newsResult = await ingestNewsContextForRegionImpl(
                ctx,
                region,
                sharedCache,
            );
            if (!newsResult.success) {
                regionSucceeded = false;
            }
        } catch (error) {
            regionSucceeded = false;
            console.error(
                `[ManualFetch] News context ingestion failed for ${regionKey}:`,
                error,
            );
        }

        try {
            await ctx.scheduler.runAfter(
                0,
                internal.insights.marketSummary.generateMarketSummary,
                { regionKey },
            );
        } catch (error) {
            regionSucceeded = false;
            console.error(
                `[ManualFetch] Failed to generate summary for ${regionKey}:`,
                error,
            );
        }

        if (regionSucceeded) {
            succeededRegions += 1;
        } else {
            failedRegions += 1;
        }
    }

    try {
        await ctx.scheduler.runAfter(
            0,
            internal.insights.marketSummary.generateMarketSummary,
            {
                regionKey: NATIONAL_REGION_KEY,
            },
        );
    } catch (error) {
        console.error(
            "[ManualFetch] Failed to generate national summary:",
            error,
        );
    }

    return {
        success: structuredFetchSucceeded && failedRegions === 0,
        totalRegions: uniqueRegions.size,
        succeededRegions,
        failedRegions,
    };
}

export const manualFetchBatch = action({
    args: {
        regions: v.array(
            v.object({
                city: v.string(),
                state: v.optional(v.string()),
                country: v.string(),
            }),
        ),
    },
    returns: manualBatchResultSchema,
    handler: async (ctx, { regions }): Promise<ManualBatchResult> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        return runManualFetchBatch(ctx, regions);
    },
});

/**
 * Manually trigger a fetch for a single region.
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
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const batch = await runManualFetchBatch(ctx, [
            { city, state, country },
        ]);

        return {
            success: batch.success,
            fetched: batch.succeededRegions,
            total: batch.totalRegions > 0 ? batch.totalRegions : 1,
            error: batch.success
                ? undefined
                : "Manual fetch batch had failures",
        };
    },
});

/**
 * Backfill recent GVR monthly reports into metric history.
 */
export const backfillGvrHistory = action({
    args: {
        months: v.optional(v.number()),
    },
    returns: gvrBackfillResultSchema,
    handler: async (ctx, args): Promise<GvrBackfillResult> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const months = Math.max(1, Math.min(24, Math.floor(args.months ?? 12)));
        const result: GvrBackfillResult = await ctx.runAction(
            internal.insights.gvrDiscovery.backfillRecentGvrReports,
            { months },
        );
        return result;
    },
});
