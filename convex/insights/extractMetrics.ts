"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { OpenRouter } from "@openrouter/sdk";
import {
    OPENROUTER_MODEL_CANDIDATES,
    OPENROUTER_PRIMARY_MODEL,
} from "../openrouterConfig";
import {
    normalizeOpenRouterText,
    parseJsonObjectFromText,
    shouldRetryOpenRouterError,
    sleep,
} from "./openrouterUtils";

const dataPointSchema = v.object({
    label: v.string(),
    value: v.string(),
    trend: v.optional(
        v.union(v.literal("up"), v.literal("down"), v.literal("neutral")),
    ),
});

const extractionResultSchema = v.object({
    dataPoints: v.array(dataPointSchema),
    aiSummary: v.optional(v.string()),
    marketCondition: v.optional(
        v.union(
            v.literal("buyers"),
            v.literal("balanced"),
            v.literal("sellers"),
        ),
    ),
    numericMetrics: v.array(
        v.object({
            metricKey: v.string(),
            label: v.string(),
            value: v.number(),
            formattedValue: v.string(),
            unit: v.string(),
            category: v.union(
                v.literal("mortgage_rates"),
                v.literal("home_prices"),
                v.literal("inventory"),
                v.literal("market_trend"),
                v.literal("rental"),
            ),
            trend: v.union(
                v.literal("up"),
                v.literal("down"),
                v.literal("neutral"),
            ),
        }),
    ),
});

type ExtractionResult = {
    dataPoints: Array<{
        label: string;
        value: string;
        trend?: "up" | "down" | "neutral";
    }>;
    aiSummary?: string;
    marketCondition?: "buyers" | "balanced" | "sellers";
    numericMetrics: Array<{
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
    }>;
};

const EMPTY_RESULT: ExtractionResult = {
    dataPoints: [],
    aiSummary: undefined,
    marketCondition: undefined,
    numericMetrics: [],
};

const OPENROUTER_MAX_ATTEMPTS = 3;
const EXTRACTION_RESPONSE_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        dataPoints: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "value"],
                properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                    trend: {
                        type: "string",
                        enum: ["up", "down", "neutral"],
                    },
                },
            },
        },
        aiSummary: { type: "string" },
        marketCondition: {
            type: "string",
            enum: ["buyers", "balanced", "sellers"],
        },
        numericMetrics: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: [
                    "metricKey",
                    "label",
                    "value",
                    "formattedValue",
                    "unit",
                    "category",
                    "trend",
                ],
                properties: {
                    metricKey: { type: "string" },
                    label: { type: "string" },
                    value: { type: "number" },
                    formattedValue: { type: "string" },
                    unit: {
                        type: "string",
                        enum: ["percent", "cad", "days", "count"],
                    },
                    category: {
                        type: "string",
                        enum: [
                            "mortgage_rates",
                            "home_prices",
                            "inventory",
                            "market_trend",
                            "rental",
                        ],
                    },
                    trend: {
                        type: "string",
                        enum: ["up", "down", "neutral"],
                    },
                },
            },
        },
    },
    required: ["dataPoints", "numericMetrics"],
};

/**
 * Extract structured data points from article content using LLM.
 * Returns data points, an AI summary, and numeric metrics suitable for
 * the marketMetrics table.
 */
export const extractDataPointsFromContent = internalAction({
    args: {
        rawContent: v.string(),
        category: v.string(),
        regionKey: v.string(),
    },
    returns: extractionResultSchema,
    handler: async (
        _ctx,
        { rawContent, category, regionKey },
    ): Promise<ExtractionResult> => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.warn(
                "[Extract] OPENROUTER_API_KEY not configured, skipping extraction",
            );
            return EMPTY_RESULT;
        }

        // Truncate content to stay within token limits
        const truncated = rawContent.slice(0, 4000);
        if (truncated.length < 400) {
            return EMPTY_RESULT;
        }

        const prompt = `You are a real estate data analyst. Extract structured data from this article content.

Category: ${category}
Region: ${regionKey}

Content:
${truncated}

Return JSON only (no markdown). Follow this exact structure:
{
  "dataPoints": [
    { "label": "Short Label", "value": "formatted value string", "trend": "up|down|neutral" }
  ],
  "aiSummary": "A concise 2-sentence summary of the key takeaway from this article.",
  "marketCondition": "buyers|balanced|sellers",
  "numericMetrics": [
    {
      "metricKey": "snake_case_key",
      "label": "Display Label",
      "value": 123.45,
      "formattedValue": "$123.45K",
      "unit": "percent|cad|days|count",
      "category": "mortgage_rates|home_prices|inventory|market_trend|rental",
      "trend": "up|down|neutral"
    }
  ]
}

Rules:
- dataPoints: extract 2-5 key facts from the article as label/value pairs
- numericMetrics: extract only clear numeric data points (prices, rates, counts, percentages)
- If no numeric metrics are clear, return an empty numericMetrics array
- marketCondition: infer from article tone; omit if unclear
- aiSummary: focus on actionable insights for a realtor`;

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
                        model: OPENROUTER_PRIMARY_MODEL,
                        models: OPENROUTER_MODEL_CANDIDATES,
                        route: "fallback",
                        messages: [{ role: "user", content: prompt }],
                        maxTokens: 500,
                        provider: {
                            requireParameters: true,
                        },
                        plugins: [{ id: "response-healing", enabled: true }],
                        responseFormat: {
                            type: "json_schema",
                            jsonSchema: {
                                name: "insights_extract_metrics",
                                strict: true,
                                schema: EXTRACTION_RESPONSE_JSON_SCHEMA,
                            },
                        },
                    });
                    const resolvedModel =
                        (response as { model?: string })?.model ??
                        OPENROUTER_PRIMARY_MODEL;
                    if (resolvedModel !== OPENROUTER_PRIMARY_MODEL) {
                        console.warn(
                            `[Extract] Fallback model used (primary=${OPENROUTER_PRIMARY_MODEL}, resolved=${resolvedModel})`,
                        );
                    }
                    break;
                } catch (error) {
                    lastError = error;
                    console.warn(
                        `[Extract] OpenRouter attempt ${attempt}/${OPENROUTER_MAX_ATTEMPTS} failed (primary=${OPENROUTER_PRIMARY_MODEL}): ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    );

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
                    "[Extract] Empty response payload from OpenRouter",
                );
                return EMPTY_RESULT;
            }

            const text = normalizeOpenRouterText(
                response.choices[0].message.content,
            );
            const parsed = parseJsonObjectFromText<ExtractionResult>(text);

            if (!parsed) {
                console.warn(
                    `[Extract] Could not parse JSON response for ${regionKey}/${category}`,
                );
                return EMPTY_RESULT;
            }

            // Validate and sanitize
            const dataPoints = Array.isArray(parsed.dataPoints)
                ? parsed.dataPoints
                      .filter((dp) => dp.label && dp.value)
                      .slice(0, 5)
                      .map((dp) => ({
                          label: String(dp.label).slice(0, 50),
                          value: String(dp.value).slice(0, 50),
                          trend: (["up", "down", "neutral"].includes(
                              dp.trend ?? "",
                          )
                              ? dp.trend
                              : undefined) as
                              | "up"
                              | "down"
                              | "neutral"
                              | undefined,
                      }))
                : [];

            const numericMetrics = Array.isArray(parsed.numericMetrics)
                ? parsed.numericMetrics
                      .filter(
                          (m) =>
                              m.metricKey &&
                              typeof m.value === "number" &&
                              !isNaN(m.value),
                      )
                      .slice(0, 5)
                      .map((m) => ({
                          metricKey: String(m.metricKey).slice(0, 50),
                          label: String(m.label).slice(0, 50),
                          value: m.value,
                          formattedValue: String(m.formattedValue).slice(0, 30),
                          unit: (["percent", "cad", "days", "count"].includes(
                              m.unit,
                          )
                              ? m.unit
                              : "count") as string,
                          category: ([
                              "mortgage_rates",
                              "home_prices",
                              "inventory",
                              "market_trend",
                              "rental",
                          ].includes(m.category)
                              ? m.category
                              : "market_trend") as
                              | "mortgage_rates"
                              | "home_prices"
                              | "inventory"
                              | "market_trend"
                              | "rental",
                          trend: (["up", "down", "neutral"].includes(m.trend)
                              ? m.trend
                              : "neutral") as "up" | "down" | "neutral",
                      }))
                : [];

            const marketCondition = (
                ["buyers", "balanced", "sellers"].includes(
                    parsed.marketCondition ?? "",
                )
                    ? parsed.marketCondition
                    : undefined
            ) as "buyers" | "balanced" | "sellers" | undefined;

            const aiSummary =
                typeof parsed.aiSummary === "string"
                    ? parsed.aiSummary.slice(0, 500)
                    : undefined;

            console.log(
                `[Extract] Extracted ${dataPoints.length} data points, ${numericMetrics.length} numeric metrics for ${regionKey}`,
            );

            return { dataPoints, aiSummary, marketCondition, numericMetrics };
        } catch (error) {
            console.warn(
                `[Extract] Failed for ${regionKey}/${category}:`,
                error instanceof Error ? error.message : error,
            );
            return EMPTY_RESULT;
        }
    },
});
