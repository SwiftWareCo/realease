"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
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

type SummaryMetric = {
    metricKey?: string;
    label: string;
    value?: number;
    formattedValue: string;
    trend: string;
    previousValue?: number;
    changePercent?: number;
    referenceDate?: string;
    unit?: string;
};

type ObjectionHandler = {
    objection: string;
    response: string;
};

type ActionableIntel = {
    seller: string;
    buyer: string;
    sellerObjection?: ObjectionHandler;
    buyerObjection?: ObjectionHandler;
};

type ConfidenceLevel = "high" | "medium" | "low";

type MarketConfidence = {
    level: ConfidenceLevel;
    reason: string;
};

type WhyThisGuidance = {
    rationale: string;
    rateImpact: string;
    rateTranslation?: string;
    evidence: string[];
};

type ObjectionAudience = "seller" | "buyer";

type ObjectionTemplate = {
    id: string;
    audience: ObjectionAudience;
    marketConditions: Array<"buyers" | "balanced" | "sellers">;
    objection: string;
    coachingAngle: string;
    signalHints: string[];
};

const OPENROUTER_MAX_ATTEMPTS = 3;
const OBJECTION_TEMPLATES: ObjectionTemplate[] = [
    {
        id: "seller_anchor_to_last_peak",
        audience: "seller",
        marketConditions: ["buyers", "balanced"],
        objection: "My neighbor sold higher a few months ago, why are we pricing below that?",
        coachingAngle:
            "Anchor to current comparables and current buyer behavior, not a prior cycle print.",
        signalHints: ["rising_inventory", "soft_absorption", "price_softening"],
    },
    {
        id: "seller_test_high_then_reduce",
        audience: "seller",
        marketConditions: ["buyers", "balanced"],
        objection: "Why not test high first and reduce later if needed?",
        coachingAngle:
            "Protect first-week momentum; delayed reductions usually lose leverage.",
        signalHints: ["soft_absorption", "rising_inventory"],
    },
    {
        id: "seller_overprice_in_hot_market",
        audience: "seller",
        marketConditions: ["sellers"],
        objection: "If demand is strong, shouldn't we list well above comps?",
        coachingAngle:
            "In hot conditions, precise pricing can trigger competition better than overpricing.",
        signalHints: ["tight_inventory", "strong_absorption", "price_firming"],
    },
    {
        id: "buyer_wait_for_rate_cuts",
        audience: "buyer",
        marketConditions: ["balanced", "sellers"],
        objection: "Shouldn't we wait for rates to drop before buying?",
        coachingAngle:
            "Waiting can improve rate but worsen competition and price; compare payment and price risk together.",
        signalHints: ["rates_elevated_or_rising", "strong_absorption", "tight_inventory"],
    },
    {
        id: "buyer_wait_for_price_drop",
        audience: "buyer",
        marketConditions: ["buyers", "balanced"],
        objection: "Should we wait for prices to fall more before making offers?",
        coachingAngle:
            "Use today’s negotiating leverage while it exists; waiting can trade one risk for another.",
        signalHints: ["rising_inventory", "price_softening", "rates_elevated_or_rising"],
    },
    {
        id: "buyer_lowball_everything",
        audience: "buyer",
        marketConditions: ["balanced", "sellers"],
        objection: "Can we just lowball and see what sticks?",
        coachingAngle:
            "Use targeted negotiation by property signals, not blanket low anchors.",
        signalHints: ["strong_absorption", "price_firming"],
    },
    {
        id: "buyer_stretch_budget_on_fomo",
        audience: "buyer",
        marketConditions: ["sellers"],
        objection: "Should we stretch our budget now so we don't miss out?",
        coachingAngle:
            "Keep offers inside sustainable payment limits even in fast markets.",
        signalHints: ["strong_absorption", "rates_elevated_or_rising"],
    },
    {
        id: "seller_delay_listing",
        audience: "seller",
        marketConditions: ["sellers", "balanced"],
        objection: "Should we hold off listing for a better month?",
        coachingAngle:
            "Lead with timing tradeoffs versus active demand and current competition depth.",
        signalHints: ["tight_inventory", "strong_absorption"],
    },
];

const SUMMARY_RESPONSE_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: [
        "summary",
        "marketCondition",
        "confidence",
        "whatChanged",
        "keyDrivers",
        "actionableIntel",
        "whyThisGuidance",
    ],
    properties: {
        summary: { type: "string" },
        marketCondition: {
            type: "string",
            enum: ["buyers", "balanced", "sellers"],
        },
        confidence: {
            type: "object",
            additionalProperties: false,
            required: ["level", "reason"],
            properties: {
                level: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                },
                reason: { type: "string" },
            },
        },
        whatChanged: { type: "string" },
        keyDrivers: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 4,
        },
        actionableIntel: {
            type: "object",
            additionalProperties: false,
            required: ["seller", "buyer", "sellerObjection", "buyerObjection"],
            properties: {
                seller: { type: "string" },
                buyer: { type: "string" },
                sellerObjection: {
                    type: "object",
                    additionalProperties: false,
                    required: ["objection", "response"],
                    properties: {
                        objection: { type: "string" },
                        response: { type: "string" },
                    },
                },
                buyerObjection: {
                    type: "object",
                    additionalProperties: false,
                    required: ["objection", "response"],
                    properties: {
                        objection: { type: "string" },
                        response: { type: "string" },
                    },
                },
            },
        },
        whyThisGuidance: {
            type: "object",
            additionalProperties: false,
            required: ["rationale", "rateImpact", "rateTranslation", "evidence"],
            properties: {
                rationale: { type: "string" },
                rateImpact: { type: "string" },
                rateTranslation: { type: "string" },
                evidence: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 2,
                    maxItems: 5,
                },
            },
        },
    },
};

function formatRegionLabel(regionKey: string) {
    if (regionKey === "national-ca") {
        return "Canada (National)";
    }

    const parts = regionKey.split("-");
    if (parts.length < 3) {
        return regionKey.replace(/-/g, " ");
    }

    const country = parts[parts.length - 1]?.toUpperCase() || "CA";
    const province = parts[parts.length - 2]?.toUpperCase() || "";
    const cityParts = parts.slice(0, -2);
    const cityLabel = cityParts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

    if (!cityLabel) {
        return country;
    }

    return province ? `${cityLabel}, ${province}` : cityLabel;
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatReferenceMonth(referenceDate?: string) {
    if (!referenceDate) return null;
    const date = new Date(`${referenceDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-CA", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
}

const METRIC_CONTEXT_BY_KEY: Record<
    string,
    {
        meaning: string;
        coachingUse: string;
    }
> = {
    gvr_mls_benchmark_price: {
        meaning: "Tracks where benchmark home values are sitting relative to recent market pressure.",
        coachingUse:
            "Use it to set realistic pricing anchors and buyer budget guardrails.",
    },
    gvr_mls_sales: {
        meaning: "Shows how many transactions actually closed in the month.",
        coachingUse:
            "Use it to judge demand depth; low closings mean buyers are active but selective.",
    },
    gvr_new_listings: {
        meaning: "Measures how much fresh supply hit the market this month.",
        coachingUse:
            "Use it to assess whether buyers have growing choice and leverage.",
    },
    gvr_active_listings: {
        meaning: "Represents current inventory still available to buy.",
        coachingUse:
            "Use it to estimate competition pressure and time-on-market risk.",
    },
    gvr_sales_to_active_ratio: {
        meaning: "Proxy for market absorption speed (sales as a share of inventory).",
        coachingUse:
            "Use it to classify buyer/balanced/seller conditions and expected negotiation intensity.",
    },
    boc_policy_rate: {
        meaning: "Sets the baseline for variable borrowing costs through lender prime and mortgage pricing.",
        coachingUse:
            "Use it to explain affordability shifts, qualification changes, and demand timing.",
    },
    prime_rate: {
        meaning: "Impacts variable-rate mortgage carrying costs and payment sensitivity.",
        coachingUse:
            "Use it to explain monthly payment pressure and refinancing behavior.",
    },
    "5yr_fixed_mortgage": {
        meaning: "Signals fixed-rate borrowing cost for common mortgage terms.",
        coachingUse:
            "Use it to frame payment certainty tradeoffs for buyers.",
    },
    "3yr_fixed_mortgage": {
        meaning: "Signals shorter fixed-term borrowing costs.",
        coachingUse:
            "Use it to discuss near-term payment strategy and renewal risk.",
    },
};

function metricSortWeight(metric: SummaryMetric) {
    const key = metric.metricKey ?? "";
    if (key === "gvr_sales_to_active_ratio") return 0;
    if (key === "gvr_active_listings") return 1;
    if (key === "gvr_new_listings") return 2;
    if (key === "gvr_mls_sales") return 3;
    if (key === "gvr_mls_benchmark_price") return 4;
    if (key === "boc_policy_rate") return 5;
    if (key === "prime_rate") return 6;
    return 99;
}

function buildMetricContextRows(allMetrics: SummaryMetric[]) {
    const deduped = Array.from(
        new Map(
            allMetrics.map((metric) => [
                metric.metricKey ?? metric.label,
                metric,
            ]),
        ).values(),
    )
        .sort((a, b) => metricSortWeight(a) - metricSortWeight(b))
        .slice(0, 10);

    return deduped.map((metric) => {
        const context = metric.metricKey
            ? METRIC_CONTEXT_BY_KEY[metric.metricKey]
            : undefined;
        const month = formatReferenceMonth(metric.referenceDate);
        const previous =
            typeof metric.previousValue === "number"
                ? `${Math.round(metric.previousValue * 100) / 100}`
                : null;
        const changePct =
            typeof metric.changePercent === "number"
                ? `${metric.changePercent > 0 ? "+" : ""}${metric.changePercent.toFixed(1)}%`
                : null;

        return [
            `- ${metric.label}`,
            `value=${metric.formattedValue}`,
            `trend=${metric.trend}`,
            month ? `reference=${month}` : null,
            previous ? `previous≈${previous}` : null,
            changePct ? `change=${changePct}` : null,
            context ? `meaning=${context.meaning}` : null,
            context ? `coaching_use=${context.coachingUse}` : null,
        ]
            .filter((part): part is string => Boolean(part))
            .join(" | ");
    });
}

function normalizeSentence(text: string, maxLength: number) {
    return text
        .replace(/\s+/g, " ")
        .replace(/\s+([,.!?;:])/g, "$1")
        .trim()
        .slice(0, maxLength);
}

function sanitizeRegionMentions(text: string, regionKey: string) {
    const regionLabel = formatRegionLabel(regionKey);
    const relaxedRegionLabel = regionLabel
        .replace(/\s*\([^)]+\)/g, "")
        .replace(/,\s*[A-Z]{2}$/g, "")
        .trim();
    const needles = [
        regionKey,
        regionLabel,
        relaxedRegionLabel,
        "Greater Vancouver, BC",
        "Greater Vancouver",
        "GVR",
    ].filter((value) => value.length > 0);

    let next = text;
    for (const needle of needles) {
        next = next.replace(new RegExp(escapeRegExp(needle), "gi"), "this market");
    }

    return next
        .replace(/\bin\s+this market\b/gi, "in this market")
        .replace(/\bfor\s+this market\b/gi, "for this market")
        .replace(/\s+/g, " ")
        .trim();
}

function sanitizeMetricPhrases(text: string) {
    return text
        .replace(/gvr mls benchmark price/gi, "benchmark price")
        .replace(/gvr mls sales/gi, "monthly sales")
        .replace(/gvr new listings/gi, "new listings")
        .replace(/gvr active listings/gi, "active listings")
        .replace(/gvr sales[\s-]*to[\s-]*active ratio/gi, "sales-to-active ratio")
        .replace(/boc policy rate/gi, "BoC overnight rate")
        .replace(/\s+/g, " ")
        .trim();
}

function sanitizeActionableIntelLine(
    input: string,
    regionKey: string,
    maxLength: number,
) {
    const withoutRegion = sanitizeRegionMentions(input, regionKey);
    const normalizedMetrics = sanitizeMetricPhrases(withoutRegion);
    return normalizeSentence(normalizedMetrics, maxLength);
}

function sanitizeObjectionHandler(
    input:
        | {
              objection?: string;
              response?: string;
          }
        | undefined,
    regionKey: string,
): ObjectionHandler | undefined {
    if (!input) return undefined;

    const objection =
        typeof input.objection === "string"
            ? sanitizeActionableIntelLine(input.objection, regionKey, 140)
            : "";
    const response =
        typeof input.response === "string"
            ? sanitizeActionableIntelLine(input.response, regionKey, 260)
            : "";

    if (objection.length < 10 || response.length < 20) {
        return undefined;
    }

    return { objection, response };
}

function sanitizeActionableIntel(
    input:
        | {
              seller?: string;
              buyer?: string;
              sellerObjection?: {
                  objection?: string;
                  response?: string;
              };
              buyerObjection?: {
                  objection?: string;
                  response?: string;
              };
          }
        | undefined,
    regionKey: string,
): ActionableIntel | null {
    if (!input) return null;

    const seller =
        typeof input.seller === "string"
            ? sanitizeActionableIntelLine(input.seller, regionKey, 320)
            : "";
    const buyer =
        typeof input.buyer === "string"
            ? sanitizeActionableIntelLine(input.buyer, regionKey, 320)
            : "";

    if (seller.length < 30 || buyer.length < 30) {
        return null;
    }

    const sellerObjection = sanitizeObjectionHandler(
        input.sellerObjection,
        regionKey,
    );
    const buyerObjection = sanitizeObjectionHandler(
        input.buyerObjection,
        regionKey,
    );

    return {
        seller,
        buyer,
        ...(sellerObjection ? { sellerObjection } : {}),
        ...(buyerObjection ? { buyerObjection } : {}),
    };
}

function sanitizeConfidence(
    input:
        | {
              level?: string;
              reason?: string;
          }
        | undefined,
    regionKey: string,
): MarketConfidence | null {
    if (!input) return null;

    const level =
        input.level === "high" || input.level === "medium" || input.level === "low"
            ? (input.level as ConfidenceLevel)
            : null;
    const reason =
        typeof input.reason === "string"
            ? sanitizeGuidanceText(input.reason, regionKey, 220)
            : "";

    if (!level || reason.length < 10) {
        return null;
    }

    return { level, reason };
}

function sanitizeWhatChanged(
    input: string | undefined,
    regionKey: string,
): string | null {
    if (typeof input !== "string") return null;
    const cleaned = sanitizeGuidanceText(input, regionKey, 180);
    if (cleaned.length < 15) return null;
    return cleaned;
}

function sanitizeGuidanceText(text: string, regionKey: string, maxLength: number) {
    return normalizeSentence(
        sanitizeMetricPhrases(sanitizeRegionMentions(text, regionKey)),
        maxLength,
    );
}

function inferMarketCondition(
    text: string,
    allMetrics: SummaryMetric[],
): "buyers" | "balanced" | "sellers" {
    const salesToActiveRatioMetric = allMetrics.find(
        (metric) =>
            metric.metricKey === "gvr_sales_to_active_ratio" &&
            typeof metric.value === "number" &&
            Number.isFinite(metric.value),
    );

    if (
        salesToActiveRatioMetric &&
        typeof salesToActiveRatioMetric.value === "number"
    ) {
        // Common GVR framing:
        // < 12% = buyer-leaning, 12-20% = balanced, > 20% = seller-leaning.
        if (salesToActiveRatioMetric.value < 12) return "buyers";
        if (salesToActiveRatioMetric.value > 20) return "sellers";
        return "balanced";
    }

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

function getMetricByKey(allMetrics: SummaryMetric[], key: string) {
    return allMetrics.find((metric) => metric.metricKey === key);
}

function getPrimaryRateMetric(allMetrics: SummaryMetric[]) {
    return (
        getMetricByKey(allMetrics, "5yr_fixed_mortgage") ??
        getMetricByKey(allMetrics, "3yr_fixed_mortgage") ??
        getMetricByKey(allMetrics, "prime_rate") ??
        getMetricByKey(allMetrics, "boc_policy_rate")
    );
}

type ObjectionSignals = {
    rising_inventory: boolean;
    tight_inventory: boolean;
    soft_absorption: boolean;
    strong_absorption: boolean;
    price_softening: boolean;
    price_firming: boolean;
    rates_elevated_or_rising: boolean;
};

function deriveObjectionSignals(allMetrics: SummaryMetric[]): ObjectionSignals {
    const active = getMetricByKey(allMetrics, "gvr_active_listings");
    const newListings = getMetricByKey(allMetrics, "gvr_new_listings");
    const price = getMetricByKey(allMetrics, "gvr_mls_benchmark_price");
    const sales = getMetricByKey(allMetrics, "gvr_mls_sales");
    const ratio = getMetricByKey(allMetrics, "gvr_sales_to_active_ratio");
    const rate = getPrimaryRateMetric(allMetrics);
    const ratioValue =
        typeof ratio?.value === "number" && Number.isFinite(ratio.value)
            ? ratio.value
            : undefined;
    const rateValue =
        typeof rate?.value === "number" && Number.isFinite(rate.value)
            ? rate.value
            : undefined;

    return {
        rising_inventory:
            active?.trend === "up" ||
            newListings?.trend === "up" ||
            (typeof ratioValue === "number" && ratioValue < 12),
        tight_inventory:
            active?.trend === "down" ||
            (typeof ratioValue === "number" && ratioValue > 20),
        soft_absorption:
            (typeof ratioValue === "number" && ratioValue < 12) ||
            sales?.trend === "down",
        strong_absorption:
            (typeof ratioValue === "number" && ratioValue > 20) ||
            sales?.trend === "up",
        price_softening: price?.trend === "down",
        price_firming: price?.trend === "up",
        rates_elevated_or_rising:
            rate?.trend === "up" ||
            (typeof rateValue === "number" && rateValue >= 4.5),
    };
}

function scoreObjectionTemplate(
    template: ObjectionTemplate,
    marketCondition: "buyers" | "balanced" | "sellers",
    signals: ObjectionSignals,
) {
    let score = 0;
    if (template.marketConditions.includes(marketCondition)) {
        score += 4;
    }
    for (const hint of template.signalHints) {
        if (signals[hint as keyof ObjectionSignals]) {
            score += 2;
        }
    }
    return score;
}

function buildObjectionCandidateRows(
    allMetrics: SummaryMetric[],
    marketCondition: "buyers" | "balanced" | "sellers",
) {
    const signals = deriveObjectionSignals(allMetrics);

    const rowsByAudience: Record<ObjectionAudience, string[]> = {
        seller: [],
        buyer: [],
    };

    (["seller", "buyer"] as const).forEach((audience) => {
        const ranked = OBJECTION_TEMPLATES.filter(
            (template) => template.audience === audience,
        )
            .map((template) => ({
                template,
                score: scoreObjectionTemplate(template, marketCondition, signals),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        rowsByAudience[audience] = ranked.map(({ template, score }) => {
            const hints = template.signalHints.join(", ");
            return `- [${template.id}] "${template.objection}" | angle=${template.coachingAngle} | score=${score} | signals=${hints}`;
        });
    });

    return rowsByAudience;
}

function sanitizeWhyThisGuidance(
    input:
        | {
              rationale?: string;
              rateImpact?: string;
              rateTranslation?: string;
              evidence?: string[];
          }
        | undefined,
    regionKey: string,
): WhyThisGuidance | null {
    if (!input) {
        return null;
    }

    const rationale =
        typeof input.rationale === "string"
            ? sanitizeGuidanceText(input.rationale, regionKey, 520)
            : "";
    const rateImpact =
        typeof input.rateImpact === "string"
            ? sanitizeGuidanceText(input.rateImpact, regionKey, 360)
            : "";
    const rateTranslation =
        typeof input.rateTranslation === "string"
            ? sanitizeGuidanceText(input.rateTranslation, regionKey, 220)
            : "";
    const evidence = Array.isArray(input.evidence)
        ? input.evidence
              .filter(
                  (item): item is string =>
                      typeof item === "string" && item.trim().length > 0,
              )
              .map((item) => sanitizeGuidanceText(item, regionKey, 180))
              .slice(0, 5)
        : [];

    if (!rationale || !rateImpact || evidence.length === 0) {
        return null;
    }

    return {
        rationale: rationale.slice(0, 520),
        rateImpact: rateImpact.slice(0, 360),
        ...(rateTranslation.length >= 15
            ? { rateTranslation: rateTranslation.slice(0, 220) }
            : {}),
        evidence,
    };
}

/**
 * Generate a market summary for a region using available metrics.
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

        // Gather current metrics for this region + national.
        const [regionMetrics, nationalMetrics] = await Promise.all([
            ctx.runQuery(internal.insights.metricsQueries.getMetricsByRegion, {
                regionKey,
            }),
            ctx.runQuery(internal.insights.metricsQueries.getMetricsByRegion, {
                regionKey: "national-ca",
            }),
        ]);

        const allMetrics = [...nationalMetrics, ...regionMetrics];

        if (allMetrics.length === 0) {
            console.log(
                `[Summary] No data available for ${regionKey}, skipping`,
            );
            return null;
        }

        // Build context for the LLM
        const metricsText = allMetrics
            .map((m) => `- ${m.label}: ${m.formattedValue} (${m.trend})`)
            .join("\n");
        const contextualMetricsText = buildMetricContextRows(allMetrics).join(
            "\n",
        );
        const inferredConditionForPrompt = inferMarketCondition("", allMetrics);
        const objectionCandidates = buildObjectionCandidateRows(
            allMetrics,
            inferredConditionForPrompt,
        );
        const objectionCandidatesText = [
            "Seller objection candidates:",
            ...(objectionCandidates.seller.length > 0
                ? objectionCandidates.seller
                : ['- [seller_default] "Is now really the right time to list?"']),
            "",
            "Buyer objection candidates:",
            ...(objectionCandidates.buyer.length > 0
                ? objectionCandidates.buyer
                : ['- [buyer_default] "Should we wait before buying?"']),
        ].join("\n");

        const prompt = `You are a senior Canadian real estate market advisor coaching working realtors. Your audience is the realtor — not the end client. Every line they read should be immediately useful in a client conversation today.

Region: ${formatRegionLabel(regionKey)} (${regionKey})

Current Rate & Market Metrics:
${metricsText || "No structured metrics available."}

Metric Context (what each metric means and how to use it):
${contextualMetricsText || "No metric context available."}

Candidate objection patterns (choose the best fit from these, then adapt wording to this snapshot's numbers):
${objectionCandidatesText}

Return JSON only (no markdown), matching this shape:
{
  "summary": "3 short sentences. Sentence 1: the single most important thing about this market right now in plain language. Sentence 2: what financing conditions mean for a typical buyer in $ or qualification terms. Sentence 3: the takeaway a realtor should lead client calls with this week.",
  "marketCondition": "buyers|balanced|sellers",
  "confidence": {
    "level": "high|medium|low",
    "reason": "One sentence explaining the confidence level based on how aligned the signals are (e.g. 'All four signals point the same direction' vs 'Pricing and absorption disagree, mixed read')."
  },
  "whatChanged": "ONE sentence naming the biggest delta versus the previous reference period. Use the change% fields in the metric context. If no change data is available, state that plainly.",
  "keyDrivers": ["2-4 short phrases"],
  "actionableIntel": {
    "seller": "A quote the realtor can say directly to a seller. Max 2 sentences. Recommendation first, then a one-clause reason. No metric jargon, no 'absorption' or 'sales-to-active'. Translate to everyday language like 'buyers are in no rush' or 'homes are selling fast'.",
    "buyer": "Same rules, for a buyer.",
    "sellerObjection": {
      "objection": "The most likely pushback a seller client will give this week based on the metrics (e.g. 'My neighbor listed higher last month').",
      "response": "A 1-2 sentence rebuttal grounded in the actual numbers."
    },
    "buyerObjection": {
      "objection": "Same for a buyer (e.g. 'Shouldn't we wait for rates to drop?').",
      "response": "1-2 sentence rebuttal grounded in actual numbers."
    }
  },
  "whyThisGuidance": {
    "rationale": "3-4 sentences. Explain WHY the market condition label is correct, and WHY the advice above follows from it. Tie each conclusion to a specific metric.",
    "rateImpact": "1-2 sentences. Explain causally: rate -> qualification / payment -> demand / leverage.",
    "rateTranslation": "ONE sentence. Translate the current rate into a concrete client-facing number — e.g. 'At today's 5-yr fixed of X.XX%, a $600k mortgage costs roughly $Y,YYY/month, about $ZZZ more than it would have at a 4.50% rate.' Use the rate metric values provided. If rate data is missing, say 'Rate translation unavailable'.",
    "evidence": [
      "2-5 bullets. Pattern: signal -> interpretation -> implication. Example: 'Active listings +12% YoY -> buyers have more choice -> price discipline beats pushing above comps.' No metadata bullets like 'Source: GVR Market Watch'."
    ]
  }
}

Hard rules:
- Write to the realtor in second person voice ("your seller", "your buyer"), not in third-person analyst voice.
- No region names ("Greater Vancouver", "GVR", region keys).
- Never dump metric labels; translate ("sales-to-active ratio" -> "how fast inventory is moving", "benchmark price" -> "typical home value").
- Objection handlers must be specific to THIS snapshot's numbers, not generic advice.
- Choose one seller objection and one buyer objection from the candidate patterns above; you may rewrite them, but keep their core intent.
- If a signal contradicts another, acknowledge it in the rationale and drop the confidence level accordingly.
- rateTranslation must include a dollar figure OR a qualification example whenever any rate metric is present in the context.`;

        let aiText = "";
        let resolvedModelForRun = OPENROUTER_PRIMARY_MODEL;

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
                        maxTokens: 900,
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
                    const resolvedModel =
                        (response as { model?: string })?.model ??
                        OPENROUTER_PRIMARY_MODEL;
                    resolvedModelForRun = resolvedModel;
                    if (resolvedModel !== OPENROUTER_PRIMARY_MODEL) {
                        console.warn(
                            `[Summary] Fallback model used for ${regionKey} (primary=${OPENROUTER_PRIMARY_MODEL}, resolved=${resolvedModel}, candidates=${OPENROUTER_MODEL_CANDIDATES.join(" | ")})`,
                        );
                    }
                    break;
                } catch (error) {
                    lastError = error;
                    console.warn(
                        `[Summary] OpenRouter attempt ${attempt}/${OPENROUTER_MAX_ATTEMPTS} failed for ${regionKey} (primary=${OPENROUTER_PRIMARY_MODEL}): ${
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
                    `[Summary] Empty response payload for ${regionKey}, skipping summary update`,
                );
                return null;
            } else {
                aiText = normalizeOpenRouterText(
                    response.choices[0].message.content,
                );
                if (aiText.trim().length === 0) {
                    console.warn(
                        `[Summary] Response had no text content for ${regionKey}, skipping summary update`,
                    );
                    return null;
                }
            }
        } catch (error) {
            console.warn(
                `[Summary] AI call failed for ${regionKey}, skipping summary update:`,
                error instanceof Error ? error.message : error,
            );
            return null;
        }

        const parsed = parseJsonObjectFromText<{
            summary?: string;
            marketCondition?: string;
            confidence?: {
                level?: string;
                reason?: string;
            };
            whatChanged?: string;
            keyDrivers?: string[];
            actionableIntel?: {
                seller?: string;
                buyer?: string;
                sellerObjection?: {
                    objection?: string;
                    response?: string;
                };
                buyerObjection?: {
                    objection?: string;
                    response?: string;
                };
            };
            whyThisGuidance?: {
                rationale?: string;
                rateImpact?: string;
                rateTranslation?: string;
                evidence?: string[];
            };
        }>(aiText);

        if (!parsed) {
            console.warn(
                `[Summary] Could not parse JSON response for ${regionKey}, skipping summary update`,
            );
            return null;
        }

        const summary =
            typeof parsed.summary === "string" && parsed.summary.trim().length > 0
                ? parsed.summary.slice(0, 1000)
                : null;
        if (!summary) {
            console.warn(
                `[Summary] Parsed response missing required 'summary' for ${regionKey}, skipping summary update`,
            );
            return null;
        }

        if (
            parsed.marketCondition !== "buyers" &&
            parsed.marketCondition !== "balanced" &&
            parsed.marketCondition !== "sellers"
        ) {
            console.warn(
                `[Summary] Parsed response missing/invalid marketCondition for ${regionKey}, skipping summary update`,
            );
            return null;
        }
        const marketCondition = parsed.marketCondition;

        const keyDrivers = Array.isArray(parsed.keyDrivers)
            ? parsed.keyDrivers
                  .filter(
                      (driver): driver is string => typeof driver === "string",
                  )
                  .map((driver) => driver.trim())
                  .filter((driver) => driver.length > 0)
                  .slice(0, 4)
                  .map((driver) => driver.slice(0, 80))
            : [];
        if (keyDrivers.length < 2) {
            console.warn(
                `[Summary] Parsed response missing sufficient keyDrivers for ${regionKey}, skipping summary update`,
            );
            return null;
        }

        const actionableIntel = sanitizeActionableIntel(
            parsed.actionableIntel,
            regionKey,
        );
        if (!actionableIntel) {
            console.warn(
                `[Summary] Parsed response had invalid actionableIntel for ${regionKey}, skipping summary update`,
            );
            return null;
        }

        const whyThisGuidance = sanitizeWhyThisGuidance(
            parsed.whyThisGuidance,
            regionKey,
        );
        if (!whyThisGuidance) {
            console.warn(
                `[Summary] Parsed response had invalid whyThisGuidance for ${regionKey}, skipping summary update`,
            );
            return null;
        }

        const confidence = sanitizeConfidence(parsed.confidence, regionKey);
        if (!confidence) {
            console.warn(
                `[Summary] Parsed response had invalid confidence for ${regionKey}, skipping summary update`,
            );
            return null;
        }

        const whatChanged = sanitizeWhatChanged(parsed.whatChanged, regionKey);
        if (!whatChanged) {
            console.warn(
                `[Summary] Parsed response had invalid whatChanged for ${regionKey}, skipping summary update`,
            );
            return null;
        }

        try {
            const now = Date.now();
            await ctx.runMutation(
                internal.insights.metricsMutations.upsertMarketSummary,
                {
                    regionKey,
                    summary,
                    summaryStatus: "ai",
                    marketCondition,
                    keyDrivers,
                    confidence,
                    whatChanged,
                    actionableIntel,
                    whyThisGuidance,
                    generatedAt: now,
                    expiresAt: now + 60 * 24 * 60 * 60 * 1000,
                },
            );

            console.log(`[Summary] Generated market summary for ${regionKey}`);
        } catch (error) {
            console.error(
                `[Summary] Failed to persist summary for ${regionKey} (resolved=${resolvedModelForRun}):`,
                error instanceof Error ? error.message : error,
            );
        }

        return null;
    },
});
