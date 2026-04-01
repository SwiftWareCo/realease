"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { OpenRouter } from "@openrouter/sdk";
import { OPENROUTER_FREE_MODEL } from "../openrouterConfig";
import {
    normalizeOpenRouterText,
    parseJsonObjectFromText,
    shouldRetryOpenRouterError,
    sleep,
} from "./openrouterUtils";

type SummaryMetric = {
    label: string;
    formattedValue: string;
    trend: string;
};

type SummaryInsight = {
    category: string;
    summary: string;
};

const OPENROUTER_MAX_ATTEMPTS = 3;
const SUMMARY_RESPONSE_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "marketCondition", "keyDrivers"],
    properties: {
        summary: { type: "string" },
        marketCondition: {
            type: "string",
            enum: ["buyers", "balanced", "sellers"],
        },
        keyDrivers: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 4,
        },
    },
};

function isLikelyNoiseSummary(input: string) {
    const text = input.trim();
    if (!text) return true;
    if (text.startsWith("{") || text.startsWith("[")) return true;
    return (
        /"status"\s*:|"code"\s*:|"data"\s*:|"warning"\s*:/.test(text) ||
        /summary unavailable/i.test(text)
    );
}

function buildFallbackSummary(
    regionKey: string,
    allMetrics: SummaryMetric[],
    recentInsights: SummaryInsight[],
    aiText?: string,
) {
    const regionLabel = regionKey.replace(/-ca$/i, "").replace(/-/g, " ");

    const metricSnippet = allMetrics
        .slice(0, 3)
        .map((metric) => `${metric.label} at ${metric.formattedValue}`)
        .join(", ");

    const firstUsefulInsight = recentInsights.find(
        (insight) => !isLikelyNoiseSummary(insight.summary),
    );
    const insightSnippet = firstUsefulInsight?.summary
        ? firstUsefulInsight.summary.slice(0, 180)
        : undefined;

    const aiSnippet = aiText && aiText.length > 0 ? aiText.slice(0, 240) : "";

    const summary =
        `Market snapshot for ${regionLabel}. ` +
        (metricSnippet
            ? `Current indicators include ${metricSnippet}. `
            : "Structured metrics are limited right now. ") +
        (insightSnippet
            ? `Recent coverage suggests: ${insightSnippet}${
                  insightSnippet.endsWith(".") ? "" : "."
              } `
            : "") +
        (aiSnippet
            ? `AI notes: ${aiSnippet}${aiSnippet.endsWith(".") ? "" : "."} `
            : "") +
        "Use this as directional guidance and validate with local comps before client recommendations.";

    return summary.slice(0, 1000);
}

function inferMarketCondition(
    text: string,
    allMetrics: SummaryMetric[],
): "buyers" | "balanced" | "sellers" {
    const lower = text.toLowerCase();
    if (
        /seller|bidding|competitive|low inventory|tight inventory|multiple offers/.test(
            lower,
        )
    ) {
        return "sellers";
    }
    if (
        /buyer|price decline|rising inventory|higher supply|soft demand/.test(
            lower,
        )
    ) {
        return "buyers";
    }

    const inventory = allMetrics.find((metric) =>
        /inventory|listings|supply/i.test(metric.label),
    );
    const prices = allMetrics.find((metric) =>
        /price|benchmark|median/i.test(metric.label),
    );

    if (inventory?.trend === "up" && prices?.trend === "down") return "buyers";
    if (inventory?.trend === "down" && prices?.trend === "up") return "sellers";
    return "balanced";
}

function buildFallbackKeyDrivers(
    allMetrics: SummaryMetric[],
    recentInsights: SummaryInsight[],
) {
    const metricDrivers = allMetrics.slice(0, 3).map((metric) => {
        if (metric.trend === "up") return `${metric.label} rising`;
        if (metric.trend === "down") return `${metric.label} easing`;
        return `${metric.label} stable`;
    });

    const insightDriver = recentInsights[0]
        ? `${recentInsights[0].category.replace(/_/g, " ")} trends`
        : null;

    const combined = insightDriver
        ? [...metricDrivers, insightDriver]
        : metricDrivers;
    return Array.from(new Set(combined))
        .slice(0, 4)
        .map((item) => item.slice(0, 80));
}

/**
 * Generate an AI market summary for a region using available metrics
 * and recent insight summaries.
 */
export const generateMarketSummary = internalAction({
    args: {
        regionKey: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, { regionKey }) => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.warn(
                "[Summary] OPENROUTER_API_KEY not configured, skipping",
            );
            return null;
        }

        // Gather current metrics for this region + national
        const [regionMetrics, nationalMetrics, recentInsights] =
            await Promise.all([
                ctx.runQuery(
                    internal.insights.metricsQueries.getMetricsByRegion,
                    {
                        regionKey,
                    },
                ),
                ctx.runQuery(
                    internal.insights.metricsQueries.getMetricsByRegion,
                    {
                        regionKey: "national-ca",
                    },
                ),
                ctx.runQuery(
                    internal.insights.marketSummaryQueries
                        .getRecentNewsContextSummaries,
                    {
                        regionKey,
                    },
                ),
            ]);

        const allMetrics = [...nationalMetrics, ...regionMetrics];

        if (allMetrics.length === 0 && recentInsights.length === 0) {
            console.log(
                `[Summary] No data available for ${regionKey}, skipping`,
            );
            return null;
        }

        // Build context for the LLM
        const metricsText = allMetrics
            .map((m) => `- ${m.label}: ${m.formattedValue} (${m.trend})`)
            .join("\n");

        const usefulInsights = recentInsights.filter(
            (insight: SummaryInsight) => !isLikelyNoiseSummary(insight.summary),
        );

        const insightsText = usefulInsights
            .slice(0, 5)
            .map(
                (i: SummaryInsight) =>
                    `- [${i.category}] ${i.summary.slice(0, 200)}`,
            )
            .join("\n");

        const prompt = `You are a senior Canadian real estate market advisor writing for realtors. Generate a market snapshot that helps realtors advise their clients.

Region: ${regionKey}

Current Rate & Market Metrics:
${metricsText || "No structured metrics available."}

Recent Market News Summaries:
${insightsText || "No recent articles available."}

Return JSON only (no markdown):
{
  "summary": "3-4 sentences. Start with the current rate environment and what it means practically (e.g. borrowing costs, affordability). Then cover local market conditions if data is available. End with a specific, actionable takeaway a realtor can share with clients.",
  "marketCondition": "buyers|balanced|sellers",
  "keyDrivers": ["driver 1", "driver 2", "driver 3"]
}

Rules:
- summary: Explain rates in plain language (e.g. 'With the BoC overnight rate at X%, variable-rate mortgages are more/less attractive because...'). Avoid jargon. Be specific about numbers.
- marketCondition: "buyers" if prices falling or inventory rising, "sellers" if prices rising or inventory tight, "balanced" if stable
- keyDrivers: 2-4 short phrases identifying what is driving conditions (e.g. "Rate cuts boosting demand", "Low inventory in detached homes")`;

        let aiText = "";

        try {
            const openrouter = new OpenRouter({ apiKey });
            let response: Awaited<
                ReturnType<typeof openrouter.chat.send>
            > | null = null;
            let lastError: unknown;

            for (
                let attempt = 1;
                attempt <= OPENROUTER_MAX_ATTEMPTS;
                attempt++
            ) {
                try {
                    response = await openrouter.chat.send({
                        model: OPENROUTER_FREE_MODEL,
                        messages: [{ role: "user", content: prompt }],
                        maxTokens: 500,
                        provider: {
                            requireParameters: true,
                        },
                        plugins: [{ id: "response-healing", enabled: true }],
                        responseFormat: {
                            type: "json_schema",
                            jsonSchema: {
                                name: "insights_market_summary",
                                strict: true,
                                schema: SUMMARY_RESPONSE_JSON_SCHEMA,
                            },
                        },
                    });
                    break;
                } catch (error) {
                    lastError = error;
                    if (
                        attempt < OPENROUTER_MAX_ATTEMPTS &&
                        shouldRetryOpenRouterError(error)
                    ) {
                        await sleep(attempt * 1200);
                        continue;
                    }
                    throw error;
                }
            }

            if (!response) {
                throw new Error(
                    `OpenRouter call failed after retries: ${
                        lastError instanceof Error
                            ? lastError.message
                            : String(lastError)
                    }`,
                );
            }

            if (!response.choices?.[0]?.message) {
                console.warn(
                    `[Summary] Empty response payload for ${regionKey}, using fallback`,
                );
            } else {
                aiText = normalizeOpenRouterText(
                    response.choices[0].message.content,
                );
            }
        } catch (error) {
            console.warn(
                `[Summary] AI call failed for ${regionKey}, using fallback:`,
                error instanceof Error ? error.message : error,
            );
        }

        const parsed = parseJsonObjectFromText<{
            summary?: string;
            marketCondition?: string;
            keyDrivers?: string[];
        }>(aiText);

        if (aiText.length > 0 && !parsed) {
            console.warn(
                `[Summary] Could not parse JSON response for ${regionKey}, using fallback`,
            );
        }

        const summary =
            typeof parsed?.summary === "string" &&
            parsed.summary.trim().length > 0
                ? parsed.summary.slice(0, 1000)
                : buildFallbackSummary(
                      regionKey,
                      allMetrics,
                      usefulInsights,
                      aiText,
                  );

        const marketCondition = (
            ["buyers", "balanced", "sellers"].includes(
                parsed?.marketCondition ?? "",
            )
                ? parsed?.marketCondition
                : inferMarketCondition(aiText || summary, allMetrics)
        ) as "buyers" | "balanced" | "sellers";

        const keyDrivers = Array.isArray(parsed?.keyDrivers)
            ? parsed.keyDrivers
                  .filter(
                      (driver): driver is string => typeof driver === "string",
                  )
                  .slice(0, 4)
                  .map((driver) => driver.slice(0, 80))
            : buildFallbackKeyDrivers(allMetrics, usefulInsights);

        try {
            const now = Date.now();
            await ctx.runMutation(
                internal.insights.metricsMutations.upsertMarketSummary,
                {
                    regionKey,
                    summary,
                    marketCondition,
                    keyDrivers,
                    generatedAt: now,
                    expiresAt: now + 24 * 60 * 60 * 1000, // 24hr TTL
                },
            );

            console.log(`[Summary] Generated market summary for ${regionKey}`);
        } catch (error) {
            console.error(
                `[Summary] Failed to persist summary for ${regionKey}:`,
                error instanceof Error ? error.message : error,
            );
        }

        return null;
    },
});
