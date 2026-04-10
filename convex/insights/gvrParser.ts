"use node";

import { v } from "convex/values";
import { OpenRouter } from "@openrouter/sdk";
import { extractText } from "unpdf";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
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
import { gvrReportDescriptorValidator } from "./gvrDiscovery";
import {
    GVR_GRAND_TOTAL_REGION_KEY,
    getRegionKeysForGvrArea,
    getRegionKeysForGvrBenchmarkArea,
} from "./gvrActivityMapping";

const GVR_SOURCE = "gvr_market_watch";
const GVR_SOURCE_LABEL = "GVR Market Watch";
const GVR_PRIMARY_REGION_KEY = "greater-vancouver-bc-ca";

const ENABLE_GVR_LLM_FALLBACK =
    process.env.ENABLE_GVR_LLM_FALLBACK === "1" ||
    process.env.ENABLE_GVR_LLM_FALLBACK === "true";
const DETERMINISTIC_CONFIDENCE_THRESHOLD = 0.8;
const OPENROUTER_MAX_ATTEMPTS = 2;
const FALLBACK_TEXT_MAX_CHARS = 7000;

const MONTH_NAMES = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const REQUIRED_KEYS = [
    "gvr_mls_benchmark_price",
    "gvr_mls_sales",
    "gvr_new_listings",
    "gvr_active_listings",
] as const;

type RequiredMetricKey = (typeof REQUIRED_KEYS)[number];

type ParsedGvrMetrics = {
    benchmarkPrice: number;
    sales: number;
    newListings: number;
    activeListings: number;
    ratioPercent?: number;
    detachedBenchmarkPrice?: number;
    townhouseBenchmarkPrice?: number;
    apartmentBenchmarkPrice?: number;
    compositePriceIndex?: number;
    detachedPriceIndex?: number;
    townhousePriceIndex?: number;
    apartmentPriceIndex?: number;
    composite1MonthChangePct?: number;
    detached1MonthChangePct?: number;
    townhouse1MonthChangePct?: number;
    apartment1MonthChangePct?: number;
    composite1YearChangePct?: number;
    detached1YearChangePct?: number;
    townhouse1YearChangePct?: number;
    apartment1YearChangePct?: number;
    detachedSalesToActiveRatio?: number;
    attachedSalesToActiveRatio?: number;
    apartmentSalesToActiveRatio?: number;
    detachedListings?: number;
    attachedListings?: number;
    apartmentListings?: number;
    detachedSales?: number;
    attachedSales?: number;
    apartmentSales?: number;
    detachedListingsYoyChangePct?: number;
    attachedListingsYoyChangePct?: number;
    apartmentListingsYoyChangePct?: number;
    detachedSalesYoyChangePct?: number;
    attachedSalesYoyChangePct?: number;
    apartmentSalesYoyChangePct?: number;
};

type PartialParsedGvrMetrics = Partial<ParsedGvrMetrics>;

type DeterministicParseResult = {
    parsed: PartialParsedGvrMetrics;
    confidence: number;
    matchedFields: string[];
    missingRequired: RequiredMetricKey[];
};

type LlmFallbackResponse = {
    reportMonth?: string;
    metrics?: {
        gvr_mls_benchmark_price?: number | string;
        gvr_mls_sales?: number | string;
        gvr_new_listings?: number | string;
        gvr_active_listings?: number | string;
        gvr_sales_to_active_ratio?: number | string | null;
        gvr_detached_benchmark_price?: number | string | null;
        gvr_townhouse_benchmark_price?: number | string | null;
        gvr_apartment_benchmark_price?: number | string | null;
    };
};

type MetricPayload = {
    metricKey: string;
    label: string;
    value: number;
    formattedValue: string;
    unit: string;
    category: "home_prices" | "inventory" | "market_trend";
};

type PreviousMetricPoint = {
    date: string;
    value: number;
    source: string;
    fetchedAt: number;
} | null;

type StageStatus = "start" | "success" | "error" | "skip";

type ActivityPropertyType = "detached" | "attached" | "apartment";

type ActivitySummaryRow = {
    areaLabel: string;
    propertyType: ActivityPropertyType;
    listingsPrevYear: number;
    listingsPrevMonth: number;
    listingsCurrent: number;
    salesPrevYear: number;
    salesPrevMonth: number;
    salesCurrent: number;
};

type HpiGreaterVancouverRow = {
    benchmarkPrice: number;
    priceIndex: number;
    change1MonthPct: number;
    change3MonthPct: number;
    change6MonthPct: number;
    change1YearPct: number;
    change3YearPct: number;
    change5YearPct: number;
    change10YearPct: number;
};

type ListingSalesGrandTotals = {
    listingsCurrent: number;
    listingsYoyChangePct: number;
    salesCurrent: number;
    salesYoyChangePct: number;
};

type BenchmarkPropertyType =
    | "composite"
    | "detached"
    | "townhouse"
    | "apartment";

type RegionalBenchmarkPriceRow = {
    areaLabel: string;
    propertyType: BenchmarkPropertyType;
    benchmarkPrice: number;
};

const ACTIVITY_HEADER_SKIP_PATTERNS = [
    /^LISTING\s*&\s*SALES\s*ACTIVITY\s*SUMMARY/i,
    /^LISTINGS\s+SALES/i,
    /^COL\./i,
    /^JAN\s+/i,
    /^DEC\s+/i,
    /^PERCENTAGE/i,
    /^VARIANCE/i,
    /^YEAR-TO-DATE/i,
    /^TOTALS?/i,
    /^NOV\s+\d{4}/i,
];

function parseNumber(raw: string) {
    const value = parseFloat(raw.replace(/,/g, "").trim());
    if (Number.isNaN(value)) {
        throw new Error(`Failed parsing numeric value: ${raw}`);
    }
    return value;
}

function coerceNumber(value: unknown, fieldName: string) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = parseNumber(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    throw new Error(`Invalid numeric fallback field: ${fieldName}`);
}

function round(value: number, digits: number) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function formatCount(value: number) {
    return Math.round(value).toLocaleString("en-CA");
}

function formatCurrency(value: number) {
    return `$${Math.round(value).toLocaleString("en-CA")}`;
}

function formatPercent(value: number, digits: number = 1) {
    return `${round(value, digits).toFixed(digits)}%`;
}

function formatIndex(value: number) {
    return round(value, 1).toFixed(1);
}

function previewText(value: string, maxChars: number) {
    const compact = value.replace(/\s+/g, " ").trim();
    if (compact.length <= maxChars) {
        return compact;
    }
    return `${compact.slice(0, maxChars)}...`;
}

function parseReportMonth(reportMonth: string) {
    const monthMatch = reportMonth.match(/^(\d{4})-(\d{2})$/);
    if (!monthMatch) {
        throw new Error(`Invalid reportMonth format: ${reportMonth}`);
    }
    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10);
    const monthName = MONTH_NAMES[month];
    if (!monthName) {
        throw new Error(`Invalid reportMonth month component: ${reportMonth}`);
    }
    return { year, month, monthName };
}

function ensureMonthConsistency(pdfText: string, reportMonth: string) {
    const { year, monthName } = parseReportMonth(reportMonth);
    const monthPattern = new RegExp(`\\b${monthName}\\s+${year}\\b`, "i");
    if (!monthPattern.test(pdfText)) {
        throw new Error(
            `Report month mismatch: could not find "${monthName} ${year}" in extracted PDF text`,
        );
    }
}

function extractOptionalMatch(text: string, regex: RegExp) {
    const match = text.match(regex);
    return match?.[1] ? parseNumber(match[1]) : undefined;
}

function extractHpiGreaterVancouverRow(
    normalizedText: string,
    sectionHeadingRegex: RegExp,
): HpiGreaterVancouverRow | null {
    const sectionStart = normalizedText.search(sectionHeadingRegex);
    if (sectionStart < 0) {
        return null;
    }

    const sectionSlice = normalizedText.slice(sectionStart, sectionStart + 900);
    const rowMatch = sectionSlice.match(
        /Greater\s+Vancouver\s+\$([0-9][0-9,]*(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+(-?[0-9]+(?:\.[0-9]+)?)%\s+(-?[0-9]+(?:\.[0-9]+)?)%\s+(-?[0-9]+(?:\.[0-9]+)?)%\s+(-?[0-9]+(?:\.[0-9]+)?)%\s+(-?[0-9]+(?:\.[0-9]+)?)%\s+(-?[0-9]+(?:\.[0-9]+)?)%\s+(-?[0-9]+(?:\.[0-9]+)?)%/i,
    );
    if (!rowMatch) {
        return null;
    }

    return {
        benchmarkPrice: parseNumber(rowMatch[1]),
        priceIndex: parseNumber(rowMatch[2]),
        change1MonthPct: parseNumber(rowMatch[3]),
        change3MonthPct: parseNumber(rowMatch[4]),
        change6MonthPct: parseNumber(rowMatch[5]),
        change1YearPct: parseNumber(rowMatch[6]),
        change3YearPct: parseNumber(rowMatch[7]),
        change5YearPct: parseNumber(rowMatch[8]),
        change10YearPct: parseNumber(rowMatch[9]),
    };
}

function extractListingSalesGrandTotals(
    normalizedText: string,
    propertyType: "DETACHED" | "ATTACHED" | "APARTMENTS",
): ListingSalesGrandTotals | null {
    const grandTotalsStart = normalizedText.search(/GRAND\s+TOTALS/i);
    if (grandTotalsStart < 0) {
        return null;
    }
    const grandTotalsSlice = normalizedText.slice(
        grandTotalsStart,
        grandTotalsStart + 900,
    );
    const pattern = new RegExp(
        `${propertyType}\\s+([0-9][0-9,]*)\\s+([0-9][0-9,]*)\\s+([0-9][0-9,]*)\\s+(-?[0-9]+(?:\\.[0-9]+)?)\\s+([0-9][0-9,]*)\\s+([0-9][0-9,]*)\\s+([0-9][0-9,]*)\\s+(-?[0-9]+(?:\\.[0-9]+)?)\\s+([0-9][0-9,]*)\\s+([0-9][0-9,]*)\\s+(-?[0-9]+(?:\\.[0-9]+)?)`,
        "i",
    );
    const match = grandTotalsSlice.match(pattern);
    if (!match) {
        return null;
    }
    return {
        listingsCurrent: parseNumber(match[3]),
        listingsYoyChangePct: parseNumber(match[4]),
        salesCurrent: parseNumber(match[7]),
        salesYoyChangePct: parseNumber(match[8]),
    };
}

function toActivityPropertyType(raw: string): ActivityPropertyType | null {
    if (/^DETACHED$/i.test(raw)) return "detached";
    if (/^ATTACHED$/i.test(raw)) return "attached";
    if (/^APARTMENTS?$/i.test(raw)) return "apartment";
    return null;
}

function maybeAreaHeading(line: string) {
    const cleaned = line.replace(/\s+/g, " ").replace(/%/g, "").trim();
    if (!cleaned) return null;
    if (/^(DETACHED|ATTACHED|APARTMENTS?)\b/i.test(cleaned)) {
        return null;
    }
    if (/[0-9]/.test(cleaned)) {
        return null;
    }
    if (
        ACTIVITY_HEADER_SKIP_PATTERNS.some((pattern) => pattern.test(cleaned))
    ) {
        return null;
    }
    if (cleaned !== cleaned.toUpperCase()) {
        return null;
    }
    return cleaned;
}

function parseListingSalesActivityRows(
    pdfTextRaw: string,
): ActivitySummaryRow[] {
    const sectionMatch = pdfTextRaw.match(
        /Listing\s*&\s*Sales\s*Activity\s*Summary([\s\S]*?)(?:Residential\s+Average\s+Sale\s+Prices|$)/i,
    );
    if (!sectionMatch) {
        return [];
    }

    const lines = sectionMatch[1]
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length > 0);

    const rows: ActivitySummaryRow[] = [];
    let currentArea: string | null = null;

    for (const line of lines) {
        const areaHeading = maybeAreaHeading(line);
        if (areaHeading) {
            currentArea = areaHeading;
            continue;
        }

        const propertyMatch = line.match(
            /^(DETACHED|ATTACHED|APARTMENTS?)\s+(.+)$/i,
        );
        if (!propertyMatch || !currentArea) {
            continue;
        }

        const propertyType = toActivityPropertyType(propertyMatch[1]);
        if (!propertyType) {
            continue;
        }

        const numericTokens = propertyMatch[2].match(
            /-?[0-9][0-9,]*(?:\.[0-9]+)?/g,
        );
        if (!numericTokens || numericTokens.length < 11) {
            continue;
        }

        rows.push({
            areaLabel: currentArea,
            propertyType,
            listingsPrevYear: parseNumber(numericTokens[0]),
            listingsPrevMonth: parseNumber(numericTokens[1]),
            listingsCurrent: parseNumber(numericTokens[2]),
            salesPrevYear: parseNumber(numericTokens[4]),
            salesPrevMonth: parseNumber(numericTokens[5]),
            salesCurrent: parseNumber(numericTokens[6]),
        });
    }

    return rows;
}

const BENCHMARK_SECTION_DEFS: Array<{
    propertyType: BenchmarkPropertyType;
    heading: RegExp;
}> = [
    {
        propertyType: "composite",
        heading: /Residential\s*\/\s*Composite\s+Lower\s+Mainland/i,
    },
    {
        propertyType: "detached",
        heading: /Single\s+Family\s+Detached\s+Lower\s+Mainland/i,
    },
    {
        propertyType: "townhouse",
        heading: /Townhouse\s+Lower\s+Mainland/i,
    },
    {
        propertyType: "apartment",
        heading: /Apartment\s+Lower\s+Mainland/i,
    },
];

function parseRegionalBenchmarkPriceRows(
    pdfTextRaw: string,
): RegionalBenchmarkPriceRow[] {
    const normalizedText = pdfTextRaw.replace(/\s+/g, " ").trim();

    const sectionStarts = BENCHMARK_SECTION_DEFS.map((section) => ({
        propertyType: section.propertyType,
        start: normalizedText.search(section.heading),
    }))
        .filter((section) => section.start >= 0)
        .sort((a, b) => a.start - b.start);

    if (sectionStarts.length === 0) {
        return [];
    }

    const bySectionAndArea = new Map<string, RegionalBenchmarkPriceRow>();
    for (let i = 0; i < sectionStarts.length; i += 1) {
        const current = sectionStarts[i];
        let sectionEnd =
            i + 1 < sectionStarts.length
                ? sectionStarts[i + 1].start
                : normalizedText.length;

        const howToReadOffset = normalizedText
            .slice(current.start)
            .search(/HOW\s+TO\s+READ\s+THE\s+TABLE/i);
        if (howToReadOffset >= 0) {
            sectionEnd = Math.min(sectionEnd, current.start + howToReadOffset);
        }

        const sectionSlice = normalizedText.slice(current.start, sectionEnd);
        const rowPattern =
            /([A-Za-z][A-Za-z/&\-\s]*?)\s+\$([0-9][0-9,]*(?:\.[0-9]+)?)\s+[0-9]+(?:\.[0-9]+)?\s+(?:-?[0-9]+(?:\.[0-9]+)?%\s+){5,9}/gi;

        let rowMatch: RegExpExecArray | null;
        while ((rowMatch = rowPattern.exec(sectionSlice)) !== null) {
            const areaLabel = rowMatch[1].replace(/\s+/g, " ").trim();
            if (!areaLabel) {
                continue;
            }

            const row: RegionalBenchmarkPriceRow = {
                areaLabel,
                propertyType: current.propertyType,
                benchmarkPrice: parseNumber(rowMatch[2]),
            };
            const dedupeKey = `${current.propertyType}:${areaLabel.toUpperCase()}`;
            bySectionAndArea.set(dedupeKey, row);
        }
    }

    return Array.from(bySectionAndArea.values());
}

function parseGvrMetricsDeterministic(
    pdfTextRaw: string,
): DeterministicParseResult {
    const pdfText = pdfTextRaw.replace(/\s+/g, " ").trim();

    const benchmarkPrice = extractOptionalMatch(
        pdfText,
        /MLS(?:®)?\s+Home\s+Price\s+Index\s+composite\s+benchmark\s+price[^$]{0,260}\$([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    );
    const sales = extractOptionalMatch(
        pdfText,
        /residential\s+sales\s+in\s+the\s+region\s+totalled\s+([0-9][0-9,]*)/i,
    );
    const newListings = extractOptionalMatch(
        pdfText,
        /There\s+were\s+([0-9][0-9,]*)[^.]{0,220}\s+newly\s+listed/i,
    );
    let activeListings = extractOptionalMatch(
        pdfText,
        /total\s+number\s+of\s+properties\s+currently\s+listed[^.]{0,240}\s+is\s+([0-9][0-9,]*)/i,
    );
    const ratioPercent = extractOptionalMatch(
        pdfText,
        /sales[\s\-\u2013\u2014]*to[\s\-\u2013\u2014]*active\s+listings\s+ratio[^.]{0,220}\s+is\s+([0-9]+(?:\.[0-9]+)?)\s+per\s+cent/i,
    );

    // Some monthly releases omit the explicit "active listings" count.
    // Derive it from sales and sales-to-active ratio when both are present.
    if (
        activeListings === undefined &&
        sales !== undefined &&
        ratioPercent !== undefined &&
        ratioPercent > 0
    ) {
        activeListings = Math.round((sales * 100) / ratioPercent);
    }
    const detachedBenchmarkPrice = extractOptionalMatch(
        pdfText,
        /benchmark\s+price\s+for\s+a\s+detached\s+home\s+is\s+\$([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    );
    const apartmentBenchmarkPrice = extractOptionalMatch(
        pdfText,
        /benchmark\s+price\s+of\s+an?\s+apartment\s+home\s+is\s+\$([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    );
    const townhouseBenchmarkPrice = extractOptionalMatch(
        pdfText,
        /benchmark\s+price\s+of\s+a\s+townhouse\s+is\s+\$([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    );
    const propertyTypeSalesToActiveMatch = pdfText.match(
        /By\s+property\s+type,\s+the\s+ratio\s+is\s+([0-9]+(?:\.[0-9]+)?)\s+per\s+cent\s+for\s+detached[^,]*,\s+([0-9]+(?:\.[0-9]+)?)\s+per\s+cent\s+for\s+attached[^,]*,\s+(?:and\s+)?([0-9]+(?:\.[0-9]+)?)\s+per\s+cent\s+for\s+apartments?/i,
    );
    const detachedSalesToActiveRatio = propertyTypeSalesToActiveMatch?.[1]
        ? parseNumber(propertyTypeSalesToActiveMatch[1])
        : undefined;
    const attachedSalesToActiveRatio = propertyTypeSalesToActiveMatch?.[2]
        ? parseNumber(propertyTypeSalesToActiveMatch[2])
        : undefined;
    const apartmentSalesToActiveRatio = propertyTypeSalesToActiveMatch?.[3]
        ? parseNumber(propertyTypeSalesToActiveMatch[3])
        : undefined;

    const hpiComposite = extractHpiGreaterVancouverRow(
        pdfText,
        /Residential\s*\/\s*Composite\s+Lower\s+Mainland/i,
    );
    const hpiDetached = extractHpiGreaterVancouverRow(
        pdfText,
        /Single\s+Family\s+Detached\s+Lower\s+Mainland/i,
    );
    const hpiTownhouse = extractHpiGreaterVancouverRow(
        pdfText,
        /Townhouse\s+Lower\s+Mainland/i,
    );
    const hpiApartment = extractHpiGreaterVancouverRow(
        pdfText,
        /Apartment\s+Lower\s+Mainland/i,
    );
    const effectiveBenchmarkPrice =
        benchmarkPrice ?? hpiComposite?.benchmarkPrice;

    const grandTotalsDetached = extractListingSalesGrandTotals(
        pdfText,
        "DETACHED",
    );
    const grandTotalsAttached = extractListingSalesGrandTotals(
        pdfText,
        "ATTACHED",
    );
    const grandTotalsApartment = extractListingSalesGrandTotals(
        pdfText,
        "APARTMENTS",
    );

    const matchedFields: string[] = [];
    if (effectiveBenchmarkPrice !== undefined)
        matchedFields.push("gvr_mls_benchmark_price");
    if (sales !== undefined) matchedFields.push("gvr_mls_sales");
    if (newListings !== undefined) matchedFields.push("gvr_new_listings");
    if (activeListings !== undefined) matchedFields.push("gvr_active_listings");
    if (ratioPercent !== undefined)
        matchedFields.push("gvr_sales_to_active_ratio");
    if (detachedBenchmarkPrice !== undefined) {
        matchedFields.push("gvr_detached_benchmark_price");
    }
    if (townhouseBenchmarkPrice !== undefined) {
        matchedFields.push("gvr_townhouse_benchmark_price");
    }
    if (apartmentBenchmarkPrice !== undefined) {
        matchedFields.push("gvr_apartment_benchmark_price");
    }
    if (hpiComposite?.priceIndex !== undefined) {
        matchedFields.push("gvr_composite_price_index");
    }
    if (hpiDetached?.priceIndex !== undefined) {
        matchedFields.push("gvr_detached_price_index");
    }
    if (hpiTownhouse?.priceIndex !== undefined) {
        matchedFields.push("gvr_townhouse_price_index");
    }
    if (hpiApartment?.priceIndex !== undefined) {
        matchedFields.push("gvr_apartment_price_index");
    }
    if (grandTotalsDetached?.salesCurrent !== undefined) {
        matchedFields.push("gvr_detached_sales");
    }
    if (grandTotalsAttached?.salesCurrent !== undefined) {
        matchedFields.push("gvr_attached_sales");
    }
    if (grandTotalsApartment?.salesCurrent !== undefined) {
        matchedFields.push("gvr_apartment_sales");
    }
    if (grandTotalsDetached?.listingsCurrent !== undefined) {
        matchedFields.push("gvr_detached_listings");
    }
    if (grandTotalsAttached?.listingsCurrent !== undefined) {
        matchedFields.push("gvr_attached_listings");
    }
    if (grandTotalsApartment?.listingsCurrent !== undefined) {
        matchedFields.push("gvr_apartment_listings");
    }
    if (detachedSalesToActiveRatio !== undefined) {
        matchedFields.push("gvr_detached_sales_to_active_ratio");
    }
    if (attachedSalesToActiveRatio !== undefined) {
        matchedFields.push("gvr_attached_sales_to_active_ratio");
    }
    if (apartmentSalesToActiveRatio !== undefined) {
        matchedFields.push("gvr_apartment_sales_to_active_ratio");
    }

    const missingRequired: RequiredMetricKey[] = [];
    if (effectiveBenchmarkPrice === undefined)
        missingRequired.push("gvr_mls_benchmark_price");
    if (sales === undefined) missingRequired.push("gvr_mls_sales");
    if (newListings === undefined) missingRequired.push("gvr_new_listings");
    if (activeListings === undefined)
        missingRequired.push("gvr_active_listings");

    const confidence =
        (REQUIRED_KEYS.length - missingRequired.length) / REQUIRED_KEYS.length;

    return {
        parsed: {
            benchmarkPrice: effectiveBenchmarkPrice,
            sales,
            newListings,
            activeListings,
            ratioPercent,
            detachedBenchmarkPrice:
                detachedBenchmarkPrice ?? hpiDetached?.benchmarkPrice,
            townhouseBenchmarkPrice:
                townhouseBenchmarkPrice ?? hpiTownhouse?.benchmarkPrice,
            apartmentBenchmarkPrice:
                apartmentBenchmarkPrice ?? hpiApartment?.benchmarkPrice,
            compositePriceIndex: hpiComposite?.priceIndex,
            detachedPriceIndex: hpiDetached?.priceIndex,
            townhousePriceIndex: hpiTownhouse?.priceIndex,
            apartmentPriceIndex: hpiApartment?.priceIndex,
            composite1MonthChangePct: hpiComposite?.change1MonthPct,
            detached1MonthChangePct: hpiDetached?.change1MonthPct,
            townhouse1MonthChangePct: hpiTownhouse?.change1MonthPct,
            apartment1MonthChangePct: hpiApartment?.change1MonthPct,
            composite1YearChangePct: hpiComposite?.change1YearPct,
            detached1YearChangePct: hpiDetached?.change1YearPct,
            townhouse1YearChangePct: hpiTownhouse?.change1YearPct,
            apartment1YearChangePct: hpiApartment?.change1YearPct,
            detachedSalesToActiveRatio,
            attachedSalesToActiveRatio,
            apartmentSalesToActiveRatio,
            detachedListings: grandTotalsDetached?.listingsCurrent,
            attachedListings: grandTotalsAttached?.listingsCurrent,
            apartmentListings: grandTotalsApartment?.listingsCurrent,
            detachedSales: grandTotalsDetached?.salesCurrent,
            attachedSales: grandTotalsAttached?.salesCurrent,
            apartmentSales: grandTotalsApartment?.salesCurrent,
            detachedListingsYoyChangePct:
                grandTotalsDetached?.listingsYoyChangePct,
            attachedListingsYoyChangePct:
                grandTotalsAttached?.listingsYoyChangePct,
            apartmentListingsYoyChangePct:
                grandTotalsApartment?.listingsYoyChangePct,
            detachedSalesYoyChangePct: grandTotalsDetached?.salesYoyChangePct,
            attachedSalesYoyChangePct: grandTotalsAttached?.salesYoyChangePct,
            apartmentSalesYoyChangePct: grandTotalsApartment?.salesYoyChangePct,
        },
        confidence,
        matchedFields,
        missingRequired,
    };
}

function toValidatedParsedMetrics(
    parsed: PartialParsedGvrMetrics,
    sourceName: string,
): ParsedGvrMetrics {
    if (
        parsed.benchmarkPrice === undefined ||
        parsed.sales === undefined ||
        parsed.newListings === undefined ||
        parsed.activeListings === undefined
    ) {
        throw new Error(
            `${sourceName} parse missing required metrics (${REQUIRED_KEYS.join(", ")})`,
        );
    }

    if (
        parsed.benchmarkPrice <= 0 ||
        parsed.sales <= 0 ||
        parsed.newListings <= 0 ||
        parsed.activeListings <= 0
    ) {
        throw new Error(`${sourceName} parse produced non-positive values`);
    }

    return {
        benchmarkPrice: parsed.benchmarkPrice,
        sales: parsed.sales,
        newListings: parsed.newListings,
        activeListings: parsed.activeListings,
        ratioPercent:
            parsed.ratioPercent !== undefined
                ? round(parsed.ratioPercent, 1)
                : undefined,
        detachedBenchmarkPrice:
            parsed.detachedBenchmarkPrice !== undefined
                ? round(parsed.detachedBenchmarkPrice, 0)
                : undefined,
        townhouseBenchmarkPrice:
            parsed.townhouseBenchmarkPrice !== undefined
                ? round(parsed.townhouseBenchmarkPrice, 0)
                : undefined,
        apartmentBenchmarkPrice:
            parsed.apartmentBenchmarkPrice !== undefined
                ? round(parsed.apartmentBenchmarkPrice, 0)
                : undefined,
        compositePriceIndex:
            parsed.compositePriceIndex !== undefined
                ? round(parsed.compositePriceIndex, 1)
                : undefined,
        detachedPriceIndex:
            parsed.detachedPriceIndex !== undefined
                ? round(parsed.detachedPriceIndex, 1)
                : undefined,
        townhousePriceIndex:
            parsed.townhousePriceIndex !== undefined
                ? round(parsed.townhousePriceIndex, 1)
                : undefined,
        apartmentPriceIndex:
            parsed.apartmentPriceIndex !== undefined
                ? round(parsed.apartmentPriceIndex, 1)
                : undefined,
        composite1MonthChangePct:
            parsed.composite1MonthChangePct !== undefined
                ? round(parsed.composite1MonthChangePct, 1)
                : undefined,
        detached1MonthChangePct:
            parsed.detached1MonthChangePct !== undefined
                ? round(parsed.detached1MonthChangePct, 1)
                : undefined,
        townhouse1MonthChangePct:
            parsed.townhouse1MonthChangePct !== undefined
                ? round(parsed.townhouse1MonthChangePct, 1)
                : undefined,
        apartment1MonthChangePct:
            parsed.apartment1MonthChangePct !== undefined
                ? round(parsed.apartment1MonthChangePct, 1)
                : undefined,
        composite1YearChangePct:
            parsed.composite1YearChangePct !== undefined
                ? round(parsed.composite1YearChangePct, 1)
                : undefined,
        detached1YearChangePct:
            parsed.detached1YearChangePct !== undefined
                ? round(parsed.detached1YearChangePct, 1)
                : undefined,
        townhouse1YearChangePct:
            parsed.townhouse1YearChangePct !== undefined
                ? round(parsed.townhouse1YearChangePct, 1)
                : undefined,
        apartment1YearChangePct:
            parsed.apartment1YearChangePct !== undefined
                ? round(parsed.apartment1YearChangePct, 1)
                : undefined,
        detachedSalesToActiveRatio:
            parsed.detachedSalesToActiveRatio !== undefined
                ? round(parsed.detachedSalesToActiveRatio, 1)
                : undefined,
        attachedSalesToActiveRatio:
            parsed.attachedSalesToActiveRatio !== undefined
                ? round(parsed.attachedSalesToActiveRatio, 1)
                : undefined,
        apartmentSalesToActiveRatio:
            parsed.apartmentSalesToActiveRatio !== undefined
                ? round(parsed.apartmentSalesToActiveRatio, 1)
                : undefined,
        detachedListings:
            parsed.detachedListings !== undefined
                ? round(parsed.detachedListings, 0)
                : undefined,
        attachedListings:
            parsed.attachedListings !== undefined
                ? round(parsed.attachedListings, 0)
                : undefined,
        apartmentListings:
            parsed.apartmentListings !== undefined
                ? round(parsed.apartmentListings, 0)
                : undefined,
        detachedSales:
            parsed.detachedSales !== undefined
                ? round(parsed.detachedSales, 0)
                : undefined,
        attachedSales:
            parsed.attachedSales !== undefined
                ? round(parsed.attachedSales, 0)
                : undefined,
        apartmentSales:
            parsed.apartmentSales !== undefined
                ? round(parsed.apartmentSales, 0)
                : undefined,
        detachedListingsYoyChangePct:
            parsed.detachedListingsYoyChangePct !== undefined
                ? round(parsed.detachedListingsYoyChangePct, 1)
                : undefined,
        attachedListingsYoyChangePct:
            parsed.attachedListingsYoyChangePct !== undefined
                ? round(parsed.attachedListingsYoyChangePct, 1)
                : undefined,
        apartmentListingsYoyChangePct:
            parsed.apartmentListingsYoyChangePct !== undefined
                ? round(parsed.apartmentListingsYoyChangePct, 1)
                : undefined,
        detachedSalesYoyChangePct:
            parsed.detachedSalesYoyChangePct !== undefined
                ? round(parsed.detachedSalesYoyChangePct, 1)
                : undefined,
        attachedSalesYoyChangePct:
            parsed.attachedSalesYoyChangePct !== undefined
                ? round(parsed.attachedSalesYoyChangePct, 1)
                : undefined,
        apartmentSalesYoyChangePct:
            parsed.apartmentSalesYoyChangePct !== undefined
                ? round(parsed.apartmentSalesYoyChangePct, 1)
                : undefined,
    };
}

function extractNarrativeSlice(pdfTextRaw: string) {
    const normalized = pdfTextRaw.replace(/\s+/g, " ").trim();

    const startIdx = normalized.search(/\bNews\s+Release\b/i);
    const start = startIdx >= 0 ? startIdx : 0;

    const endAnchors = [
        /Property\s+Type\s+Area\s+Benchmark\s+Price/i,
        /HOW\s+TO\s+READ\s+THE\s+TABLE/i,
        /Editor'?s\s+Note/i,
    ];

    let end = normalized.length;
    for (const anchor of endAnchors) {
        const idx = normalized.slice(start).search(anchor);
        if (idx >= 0) {
            end = Math.min(end, start + idx);
        }
    }

    return normalized.slice(
        start,
        Math.min(end, start + FALLBACK_TEXT_MAX_CHARS),
    );
}

async function runLlmFallbackParse(args: {
    reportMonth: string;
    extractedText: string;
}): Promise<ParsedGvrMetrics> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const prompt = `You are extracting exact metrics from a Greater Vancouver REALTORS monthly market report.

Report month expected: ${args.reportMonth}

Return JSON only (no markdown) with this exact schema:
{
  "reportMonth": "YYYY-MM",
  "metrics": {
    "gvr_mls_benchmark_price": number,
    "gvr_mls_sales": number,
    "gvr_new_listings": number,
    "gvr_active_listings": number,
    "gvr_sales_to_active_ratio": number | null,
    "gvr_detached_benchmark_price": number | null,
    "gvr_townhouse_benchmark_price": number | null,
    "gvr_apartment_benchmark_price": number | null
  }
}

Rules:
- Extract market-wide Greater Vancouver values only from narrative/news-release text.
- Numbers must be raw numeric values (no commas, no $ signs, no % signs).
- Use null only if ratio is not explicitly present.
- Do not invent values.

Text:
${args.extractedText}`;

    const openrouter = new OpenRouter({ apiKey });
    let lastError: unknown;

    for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS; attempt++) {
        try {
            const response = await openrouter.chat.send({
                model: OPENROUTER_PRIMARY_MODEL,
                models: OPENROUTER_MODEL_CANDIDATES,
                route: "fallback",
                messages: [{ role: "user", content: prompt }],
                maxTokens: 350,
            });
            const resolvedModel =
                (response as { model?: string })?.model ??
                OPENROUTER_PRIMARY_MODEL;
            if (resolvedModel !== OPENROUTER_PRIMARY_MODEL) {
                console.warn(
                    `[GVR][fallback][model_route] Fallback model used (primary=${OPENROUTER_PRIMARY_MODEL}, resolved=${resolvedModel})`,
                );
            }

            const message = response.choices?.[0]?.message?.content;
            const text = normalizeOpenRouterText(message);
            const parsed = parseJsonObjectFromText<LlmFallbackResponse>(text);

            if (!parsed?.metrics) {
                const invalidPayloadError = new Error(
                    "Fallback parser returned invalid JSON payload",
                );
                lastError = invalidPayloadError;
                console.error(
                    `[GVR][fallback][invalid_payload] ${JSON.stringify({
                        reportMonth: args.reportMonth,
                        attempt,
                        responseModel:
                            (response as { model?: string })?.model ?? null,
                        textLength: text.length,
                        textPreview: previewText(text, 700),
                        messageType:
                            message === null
                                ? "null"
                                : message === undefined
                                  ? "undefined"
                                  : Array.isArray(message)
                                    ? "array"
                                    : typeof message,
                    })}`,
                );

                if (attempt < OPENROUTER_MAX_ATTEMPTS) {
                    await sleep(attempt * 1200);
                    continue;
                }

                throw invalidPayloadError;
            }

            const reportedMonth =
                typeof parsed.reportMonth === "string"
                    ? parsed.reportMonth
                    : "";
            if (reportedMonth !== args.reportMonth) {
                throw new Error(
                    `Fallback reportMonth mismatch: expected ${args.reportMonth}, got ${reportedMonth || "<empty>"}`,
                );
            }

            const metrics = parsed.metrics;

            return toValidatedParsedMetrics(
                {
                    benchmarkPrice: coerceNumber(
                        metrics.gvr_mls_benchmark_price,
                        "gvr_mls_benchmark_price",
                    ),
                    sales: coerceNumber(metrics.gvr_mls_sales, "gvr_mls_sales"),
                    newListings: coerceNumber(
                        metrics.gvr_new_listings,
                        "gvr_new_listings",
                    ),
                    activeListings: coerceNumber(
                        metrics.gvr_active_listings,
                        "gvr_active_listings",
                    ),
                    ratioPercent:
                        metrics.gvr_sales_to_active_ratio === null ||
                        metrics.gvr_sales_to_active_ratio === undefined
                            ? undefined
                            : coerceNumber(
                                  metrics.gvr_sales_to_active_ratio,
                                  "gvr_sales_to_active_ratio",
                              ),
                    detachedBenchmarkPrice:
                        metrics.gvr_detached_benchmark_price === null ||
                        metrics.gvr_detached_benchmark_price === undefined
                            ? undefined
                            : coerceNumber(
                                  metrics.gvr_detached_benchmark_price,
                                  "gvr_detached_benchmark_price",
                              ),
                    townhouseBenchmarkPrice:
                        metrics.gvr_townhouse_benchmark_price === null ||
                        metrics.gvr_townhouse_benchmark_price === undefined
                            ? undefined
                            : coerceNumber(
                                  metrics.gvr_townhouse_benchmark_price,
                                  "gvr_townhouse_benchmark_price",
                              ),
                    apartmentBenchmarkPrice:
                        metrics.gvr_apartment_benchmark_price === null ||
                        metrics.gvr_apartment_benchmark_price === undefined
                            ? undefined
                            : coerceNumber(
                                  metrics.gvr_apartment_benchmark_price,
                                  "gvr_apartment_benchmark_price",
                              ),
                },
                "llm_fallback",
            );
        } catch (error) {
            lastError = error;
            console.warn(
                `[GVR][fallback][attempt_failed] attempt=${attempt}/${OPENROUTER_MAX_ATTEMPTS} primary=${OPENROUTER_PRIMARY_MODEL} message=${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            const retryInvalidPayload =
                error instanceof Error &&
                error.message ===
                    "Fallback parser returned invalid JSON payload";
            if (
                attempt < OPENROUTER_MAX_ATTEMPTS &&
                (shouldRetryOpenRouterError(error) || retryInvalidPayload)
            ) {
                await sleep(attempt * 1200);
                continue;
            }
            throw error;
        }
    }

    throw new Error(
        `OpenRouter fallback failed after retries: ${
            lastError instanceof Error ? lastError.message : String(lastError)
        }`,
    );
}

function normalizeMetrics(parsed: ParsedGvrMetrics): MetricPayload[] {
    const computedRatio = (parsed.sales / parsed.activeListings) * 100;
    let ratio = round(computedRatio, 1);

    if (parsed.ratioPercent !== undefined) {
        const delta = Math.abs(parsed.ratioPercent - computedRatio);
        if (delta > 1.5) {
            throw new Error(
                `sales_to_active_ratio validation failed (parsed=${parsed.ratioPercent}, computed=${round(computedRatio, 2)})`,
            );
        }
        ratio = round(parsed.ratioPercent, 1);
    }
    const metrics: MetricPayload[] = [
        {
            metricKey: "gvr_mls_benchmark_price",
            label: "GVR MLS Benchmark Price",
            value: Math.round(parsed.benchmarkPrice),
            formattedValue: formatCurrency(parsed.benchmarkPrice),
            unit: "cad",
            category: "home_prices",
        },
        {
            metricKey: "gvr_mls_sales",
            label: "GVR MLS Sales",
            value: Math.round(parsed.sales),
            formattedValue: formatCount(parsed.sales),
            unit: "count",
            category: "market_trend",
        },
        {
            metricKey: "gvr_new_listings",
            label: "GVR New Listings",
            value: Math.round(parsed.newListings),
            formattedValue: formatCount(parsed.newListings),
            unit: "count",
            category: "inventory",
        },
        {
            metricKey: "gvr_active_listings",
            label: "GVR Active Listings",
            value: Math.round(parsed.activeListings),
            formattedValue: formatCount(parsed.activeListings),
            unit: "count",
            category: "inventory",
        },
        {
            metricKey: "gvr_sales_to_active_ratio",
            label: "GVR Sales-to-Active Ratio",
            value: ratio,
            formattedValue: formatPercent(ratio, 1),
            unit: "percent",
            category: "market_trend",
        },
    ];

    const pushOptionalMetric = (
        metricKey: string,
        label: string,
        value: number | undefined,
        unit: MetricPayload["unit"],
        category: MetricPayload["category"],
    ) => {
        if (value === undefined) return;
        metrics.push({
            metricKey,
            label,
            value,
            formattedValue:
                unit === "cad"
                    ? formatCurrency(value)
                    : unit === "count"
                      ? formatCount(value)
                      : unit === "percent"
                        ? formatPercent(value, 1)
                        : formatIndex(value),
            unit,
            category,
        });
    };

    pushOptionalMetric(
        "gvr_detached_benchmark_price",
        "GVR Detached Benchmark Price",
        parsed.detachedBenchmarkPrice,
        "cad",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_townhouse_benchmark_price",
        "GVR Townhouse Benchmark Price",
        parsed.townhouseBenchmarkPrice,
        "cad",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_apartment_benchmark_price",
        "GVR Apartment Benchmark Price",
        parsed.apartmentBenchmarkPrice,
        "cad",
        "home_prices",
    );

    pushOptionalMetric(
        "gvr_composite_price_index",
        "GVR Composite Price Index",
        parsed.compositePriceIndex,
        "index",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_detached_price_index",
        "GVR Detached Price Index",
        parsed.detachedPriceIndex,
        "index",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_townhouse_price_index",
        "GVR Townhouse Price Index",
        parsed.townhousePriceIndex,
        "index",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_apartment_price_index",
        "GVR Apartment Price Index",
        parsed.apartmentPriceIndex,
        "index",
        "home_prices",
    );

    pushOptionalMetric(
        "gvr_composite_1m_change_pct",
        "GVR Composite 1M Change",
        parsed.composite1MonthChangePct,
        "percent",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_detached_1m_change_pct",
        "GVR Detached 1M Change",
        parsed.detached1MonthChangePct,
        "percent",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_townhouse_1m_change_pct",
        "GVR Townhouse 1M Change",
        parsed.townhouse1MonthChangePct,
        "percent",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_apartment_1m_change_pct",
        "GVR Apartment 1M Change",
        parsed.apartment1MonthChangePct,
        "percent",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_composite_1y_change_pct",
        "GVR Composite 1Y Change",
        parsed.composite1YearChangePct,
        "percent",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_detached_1y_change_pct",
        "GVR Detached 1Y Change",
        parsed.detached1YearChangePct,
        "percent",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_townhouse_1y_change_pct",
        "GVR Townhouse 1Y Change",
        parsed.townhouse1YearChangePct,
        "percent",
        "home_prices",
    );
    pushOptionalMetric(
        "gvr_apartment_1y_change_pct",
        "GVR Apartment 1Y Change",
        parsed.apartment1YearChangePct,
        "percent",
        "home_prices",
    );

    pushOptionalMetric(
        "gvr_detached_sales_to_active_ratio",
        "GVR Detached Sales-to-Active Ratio",
        parsed.detachedSalesToActiveRatio,
        "percent",
        "market_trend",
    );
    pushOptionalMetric(
        "gvr_attached_sales_to_active_ratio",
        "GVR Attached Sales-to-Active Ratio",
        parsed.attachedSalesToActiveRatio,
        "percent",
        "market_trend",
    );
    pushOptionalMetric(
        "gvr_apartment_sales_to_active_ratio",
        "GVR Apartment Sales-to-Active Ratio",
        parsed.apartmentSalesToActiveRatio,
        "percent",
        "market_trend",
    );

    pushOptionalMetric(
        "gvr_detached_sales",
        "GVR Detached Sales",
        parsed.detachedSales,
        "count",
        "market_trend",
    );
    pushOptionalMetric(
        "gvr_attached_sales",
        "GVR Attached Sales",
        parsed.attachedSales,
        "count",
        "market_trend",
    );
    pushOptionalMetric(
        "gvr_apartment_sales",
        "GVR Apartment Sales",
        parsed.apartmentSales,
        "count",
        "market_trend",
    );
    pushOptionalMetric(
        "gvr_detached_listings",
        "GVR Detached Listings",
        parsed.detachedListings,
        "count",
        "inventory",
    );
    pushOptionalMetric(
        "gvr_attached_listings",
        "GVR Attached Listings",
        parsed.attachedListings,
        "count",
        "inventory",
    );
    pushOptionalMetric(
        "gvr_apartment_listings",
        "GVR Apartment Listings",
        parsed.apartmentListings,
        "count",
        "inventory",
    );

    pushOptionalMetric(
        "gvr_detached_listings_yoy_change_pct",
        "GVR Detached Listings YoY Change",
        parsed.detachedListingsYoyChangePct,
        "percent",
        "inventory",
    );
    pushOptionalMetric(
        "gvr_attached_listings_yoy_change_pct",
        "GVR Attached Listings YoY Change",
        parsed.attachedListingsYoyChangePct,
        "percent",
        "inventory",
    );
    pushOptionalMetric(
        "gvr_apartment_listings_yoy_change_pct",
        "GVR Apartment Listings YoY Change",
        parsed.apartmentListingsYoyChangePct,
        "percent",
        "inventory",
    );
    pushOptionalMetric(
        "gvr_detached_sales_yoy_change_pct",
        "GVR Detached Sales YoY Change",
        parsed.detachedSalesYoyChangePct,
        "percent",
        "market_trend",
    );
    pushOptionalMetric(
        "gvr_attached_sales_yoy_change_pct",
        "GVR Attached Sales YoY Change",
        parsed.attachedSalesYoyChangePct,
        "percent",
        "market_trend",
    );
    pushOptionalMetric(
        "gvr_apartment_sales_yoy_change_pct",
        "GVR Apartment Sales YoY Change",
        parsed.apartmentSalesYoyChangePct,
        "percent",
        "market_trend",
    );

    if (
        parsed.detachedSales !== undefined &&
        parsed.detachedListings !== undefined &&
        parsed.detachedListings > 0
    ) {
        const detachedRatio = round(
            (parsed.detachedSales / parsed.detachedListings) * 100,
            1,
        );
        pushOptionalMetric(
            "gvr_detached_sales_to_listings_ratio",
            "GVR Detached Sales-to-Listings Ratio",
            detachedRatio,
            "percent",
            "market_trend",
        );
    }
    if (
        parsed.attachedSales !== undefined &&
        parsed.attachedListings !== undefined &&
        parsed.attachedListings > 0
    ) {
        const attachedRatio = round(
            (parsed.attachedSales / parsed.attachedListings) * 100,
            1,
        );
        pushOptionalMetric(
            "gvr_attached_sales_to_listings_ratio",
            "GVR Attached Sales-to-Listings Ratio",
            attachedRatio,
            "percent",
            "market_trend",
        );
    }
    if (
        parsed.apartmentSales !== undefined &&
        parsed.apartmentListings !== undefined &&
        parsed.apartmentListings > 0
    ) {
        const apartmentRatio = round(
            (parsed.apartmentSales / parsed.apartmentListings) * 100,
            1,
        );
        pushOptionalMetric(
            "gvr_apartment_sales_to_listings_ratio",
            "GVR Apartment Sales-to-Listings Ratio",
            apartmentRatio,
            "percent",
            "market_trend",
        );
    }

    return metrics;
}

function deriveTrend(
    value: number,
    previousValue: number | undefined,
): "up" | "down" | "neutral" {
    if (previousValue === undefined) return "neutral";
    const delta = value - previousValue;
    if (Math.abs(delta) < 0.0001) return "neutral";
    return delta > 0 ? "up" : "down";
}

function deriveChange(
    value: number,
    previousValue: number | undefined,
    unit: string,
) {
    if (previousValue === undefined) {
        return {
            changePercent: undefined as number | undefined,
            changeFormatted: undefined as string | undefined,
        };
    }

    const delta = value - previousValue;
    if (Math.abs(delta) < 0.0001) {
        return { changePercent: undefined, changeFormatted: undefined };
    }

    const changePercent =
        previousValue === 0 ? 0 : round((delta / previousValue) * 100, 2);
    const sign = delta > 0 ? "+" : "";
    const changeFormatted =
        unit === "percent"
            ? `${sign}${round(delta, 1).toFixed(1)}%`
            : `${sign}${Math.round(delta).toLocaleString("en-CA")}`;

    return { changePercent, changeFormatted };
}

function toCanonicalDate(reportMonth: string) {
    return `${reportMonth}-01`;
}

function shiftReportMonth(reportMonth: string, monthDelta: number) {
    const match = reportMonth.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
        throw new Error(`Invalid reportMonth format: ${reportMonth}`);
    }
    const year = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1;
    const d = new Date(Date.UTC(year, monthIndex + monthDelta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function activityMetricKeys(propertyType: ActivityPropertyType) {
    if (propertyType === "detached") {
        return {
            listingsKey: "gvr_detached_listings",
            listingsLabel: "GVR Detached Listings",
            salesKey: "gvr_detached_sales",
            salesLabel: "GVR Detached Sales",
        };
    }
    if (propertyType === "attached") {
        return {
            listingsKey: "gvr_attached_listings",
            listingsLabel: "GVR Attached Listings",
            salesKey: "gvr_attached_sales",
            salesLabel: "GVR Attached Sales",
        };
    }
    return {
        listingsKey: "gvr_apartment_listings",
        listingsLabel: "GVR Apartment Listings",
        salesKey: "gvr_apartment_sales",
        salesLabel: "GVR Apartment Sales",
    };
}

function benchmarkMetricInfo(propertyType: BenchmarkPropertyType) {
    if (propertyType === "composite") {
        return {
            metricKey: "gvr_mls_benchmark_price",
            label: "GVR MLS Benchmark Price",
        };
    }
    if (propertyType === "detached") {
        return {
            metricKey: "gvr_detached_benchmark_price",
            label: "GVR Detached Benchmark Price",
        };
    }
    if (propertyType === "townhouse") {
        return {
            metricKey: "gvr_townhouse_benchmark_price",
            label: "GVR Townhouse Benchmark Price",
        };
    }
    return {
        metricKey: "gvr_apartment_benchmark_price",
        label: "GVR Apartment Benchmark Price",
    };
}

function toAggregateRegionKeys() {
    const keys = [GVR_GRAND_TOTAL_REGION_KEY, GVR_PRIMARY_REGION_KEY];
    return Array.from(new Set(keys));
}

function logStage(params: {
    step: string;
    status: StageStatus;
    reportMonth: string;
    url: string;
    startedAt: number;
    errorKind?: string;
    errorMessage?: string;
    extra?: Record<string, unknown>;
}) {
    const payload = {
        source: GVR_SOURCE,
        step: params.step,
        status: params.status,
        url: params.url,
        reportMonth: params.reportMonth,
        durationMs: Math.max(0, Date.now() - params.startedAt),
        errorKind: params.errorKind,
        errorMessage: params.errorMessage,
        ...params.extra,
    };
    console.log(`[GVR][stage] ${JSON.stringify(payload)}`);
}

export const ingestGvrReport = internalAction({
    args: gvrReportDescriptorValidator,
    returns: v.object({
        success: v.boolean(),
        metricsUpserted: v.number(),
        historyRowsUpserted: v.number(),
        error: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
        try {
            const fetchStart = Date.now();
            logStage({
                step: "fetch_pdf",
                status: "start",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: fetchStart,
            });

            const pdfResponse = await fetch(args.reportUrl, {
                signal: AbortSignal.timeout(30_000),
            });
            if (!pdfResponse.ok) {
                throw new Error(
                    `Report PDF fetch failed with ${pdfResponse.status}`,
                );
            }
            const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
            logStage({
                step: "fetch_pdf",
                status: "success",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: fetchStart,
            });

            const deterministicStart = Date.now();
            logStage({
                step: "deterministic_parse",
                status: "start",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: deterministicStart,
            });

            const extracted = await extractText(pdfBytes, {
                mergePages: false,
            });
            const pageTexts = Array.isArray(extracted.text)
                ? extracted.text
                : [String(extracted.text ?? "")];
            const text = pageTexts.join("\n");

            if (!text || text.trim().length < 200) {
                throw new Error("Extracted PDF text is empty or too short");
            }

            ensureMonthConsistency(text, args.reportMonth);
            const deterministic = parseGvrMetricsDeterministic(text);
            const activityRows = parseListingSalesActivityRows(text);
            const benchmarkRows = parseRegionalBenchmarkPriceRows(text);

            logStage({
                step: "deterministic_parse",
                status: "success",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: deterministicStart,
                extra: {
                    confidence: round(deterministic.confidence, 3),
                    matchedFields: deterministic.matchedFields,
                    missingRequired: deterministic.missingRequired,
                    activityRowsParsed: activityRows.length,
                    benchmarkRowsParsed: benchmarkRows.length,
                },
            });

            let parsed: ParsedGvrMetrics;
            const needsFallback =
                deterministic.missingRequired.length > 0 ||
                deterministic.confidence < DETERMINISTIC_CONFIDENCE_THRESHOLD;

            if (!needsFallback) {
                parsed = toValidatedParsedMetrics(
                    deterministic.parsed,
                    "deterministic",
                );
            } else if (!ENABLE_GVR_LLM_FALLBACK) {
                logStage({
                    step: "llm_fallback_parse",
                    status: "skip",
                    reportMonth: args.reportMonth,
                    url: args.reportUrl,
                    startedAt: Date.now(),
                    extra: {
                        reason: "fallback_disabled",
                        confidence: round(deterministic.confidence, 3),
                        missingRequired: deterministic.missingRequired,
                    },
                });

                throw new Error(
                    `Deterministic parser confidence low (${round(deterministic.confidence, 3)}) and fallback disabled`,
                );
            } else {
                const fallbackStart = Date.now();
                logStage({
                    step: "llm_fallback_parse",
                    status: "start",
                    reportMonth: args.reportMonth,
                    url: args.reportUrl,
                    startedAt: fallbackStart,
                    extra: {
                        confidence: round(deterministic.confidence, 3),
                        missingRequired: deterministic.missingRequired,
                    },
                });

                try {
                    const fallbackParsed = await runLlmFallbackParse({
                        reportMonth: args.reportMonth,
                        extractedText: extractNarrativeSlice(text),
                    });
                    parsed = toValidatedParsedMetrics(
                        {
                            ...deterministic.parsed,
                            benchmarkPrice: fallbackParsed.benchmarkPrice,
                            sales: fallbackParsed.sales,
                            newListings: fallbackParsed.newListings,
                            activeListings: fallbackParsed.activeListings,
                            ratioPercent:
                                fallbackParsed.ratioPercent ??
                                deterministic.parsed.ratioPercent,
                            detachedBenchmarkPrice:
                                fallbackParsed.detachedBenchmarkPrice ??
                                deterministic.parsed.detachedBenchmarkPrice,
                            townhouseBenchmarkPrice:
                                fallbackParsed.townhouseBenchmarkPrice ??
                                deterministic.parsed.townhouseBenchmarkPrice,
                            apartmentBenchmarkPrice:
                                fallbackParsed.apartmentBenchmarkPrice ??
                                deterministic.parsed.apartmentBenchmarkPrice,
                        },
                        "llm_fallback_merged",
                    );

                    logStage({
                        step: "llm_fallback_parse",
                        status: "success",
                        reportMonth: args.reportMonth,
                        url: args.reportUrl,
                        startedAt: fallbackStart,
                    });
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : String(error);
                    logStage({
                        step: "llm_fallback_parse",
                        status: "error",
                        reportMonth: args.reportMonth,
                        url: args.reportUrl,
                        startedAt: fallbackStart,
                        errorKind: "fallback_parse_error",
                        errorMessage,
                    });
                    throw error;
                }
            }

            const normalizeStart = Date.now();
            logStage({
                step: "normalize",
                status: "start",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: normalizeStart,
            });

            const metrics = normalizeMetrics(parsed);
            const aggregateRegionKeys = toAggregateRegionKeys();
            const canonicalDate = toCanonicalDate(args.reportMonth);
            const fetchedAt = Date.now();

            logStage({
                step: "normalize",
                status: "success",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: normalizeStart,
                extra: {
                    metricKeys: metrics.map((metric) => metric.metricKey),
                    regionCount: aggregateRegionKeys.length,
                    referenceDate: canonicalDate,
                },
            });

            const upsertLatestStart = Date.now();
            logStage({
                step: "upsert_latest",
                status: "start",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: upsertLatestStart,
            });

            const historyRows: Array<{
                regionKey: string;
                metricKey: string;
                date: string;
                value: number;
                source: string;
                fetchedAt: number;
            }> = [];

            let metricsUpserted = 0;
            for (const regionKey of aggregateRegionKeys) {
                for (const metric of metrics) {
                    const previousPoint: PreviousMetricPoint =
                        await ctx.runQuery(
                            internal.insights.metricHistoryQueries
                                .getPreviousMetricPoint,
                            {
                                regionKey,
                                metricKey: metric.metricKey,
                                beforeDate: canonicalDate,
                            },
                        );

                    const previousValue = previousPoint?.value;
                    const trend = deriveTrend(metric.value, previousValue);
                    const { changePercent, changeFormatted } = deriveChange(
                        metric.value,
                        previousValue,
                        metric.unit,
                    );

                    await ctx.runMutation(
                        internal.insights.metricsMutations.upsertMetric,
                        {
                            regionKey,
                            metricKey: metric.metricKey,
                            label: metric.label,
                            value: metric.value,
                            formattedValue: metric.formattedValue,
                            previousValue,
                            trend,
                            changePercent,
                            changeFormatted,
                            unit: metric.unit,
                            category: metric.category,
                            source: GVR_SOURCE,
                            sourceLabel: GVR_SOURCE_LABEL,
                            referenceDate: canonicalDate,
                            fetchedAt,
                            expiresAt: fetchedAt + 30 * 24 * 60 * 60 * 1000,
                        },
                    );
                    metricsUpserted++;

                    historyRows.push({
                        regionKey,
                        metricKey: metric.metricKey,
                        date: canonicalDate,
                        value: metric.value,
                        source: GVR_SOURCE,
                        fetchedAt,
                    });
                }
            }

            const previousMonthDate = toCanonicalDate(
                shiftReportMonth(args.reportMonth, -1),
            );
            const previousYearSameMonthDate = toCanonicalDate(
                shiftReportMonth(args.reportMonth, -12),
            );
            const activityAggregates = new Map<
                string,
                {
                    listingsPrevYear: number;
                    listingsPrevMonth: number;
                    listingsCurrent: number;
                    salesPrevYear: number;
                    salesPrevMonth: number;
                    salesCurrent: number;
                }
            >();

            for (const row of activityRows) {
                const mappedRegionKeys = Array.from(
                    new Set(getRegionKeysForGvrArea(row.areaLabel)),
                );
                if (mappedRegionKeys.length === 0) {
                    continue;
                }

                const { listingsKey, listingsLabel, salesKey, salesLabel } =
                    activityMetricKeys(row.propertyType);

                for (const regionKey of mappedRegionKeys) {
                    const aggregate = activityAggregates.get(regionKey) ?? {
                        listingsPrevYear: 0,
                        listingsPrevMonth: 0,
                        listingsCurrent: 0,
                        salesPrevYear: 0,
                        salesPrevMonth: 0,
                        salesCurrent: 0,
                    };
                    aggregate.listingsPrevYear += row.listingsPrevYear;
                    aggregate.listingsPrevMonth += row.listingsPrevMonth;
                    aggregate.listingsCurrent += row.listingsCurrent;
                    aggregate.salesPrevYear += row.salesPrevYear;
                    aggregate.salesPrevMonth += row.salesPrevMonth;
                    aggregate.salesCurrent += row.salesCurrent;
                    activityAggregates.set(regionKey, aggregate);

                    const listingPreviousPoint: PreviousMetricPoint =
                        await ctx.runQuery(
                            internal.insights.metricHistoryQueries
                                .getPreviousMetricPoint,
                            {
                                regionKey,
                                metricKey: listingsKey,
                                beforeDate: canonicalDate,
                            },
                        );
                    const listingPreviousValue = listingPreviousPoint?.value;
                    const listingTrend = deriveTrend(
                        row.listingsCurrent,
                        listingPreviousValue,
                    );
                    const listingChange = deriveChange(
                        row.listingsCurrent,
                        listingPreviousValue,
                        "count",
                    );
                    await ctx.runMutation(
                        internal.insights.metricsMutations.upsertMetric,
                        {
                            regionKey,
                            metricKey: listingsKey,
                            label: listingsLabel,
                            value: row.listingsCurrent,
                            formattedValue: formatCount(row.listingsCurrent),
                            previousValue: listingPreviousValue,
                            trend: listingTrend,
                            changePercent: listingChange.changePercent,
                            changeFormatted: listingChange.changeFormatted,
                            unit: "count",
                            category: "inventory",
                            source: GVR_SOURCE,
                            sourceLabel: GVR_SOURCE_LABEL,
                            referenceDate: canonicalDate,
                            fetchedAt,
                            expiresAt: fetchedAt + 30 * 24 * 60 * 60 * 1000,
                        },
                    );
                    metricsUpserted++;

                    const salesPreviousPoint: PreviousMetricPoint =
                        await ctx.runQuery(
                            internal.insights.metricHistoryQueries
                                .getPreviousMetricPoint,
                            {
                                regionKey,
                                metricKey: salesKey,
                                beforeDate: canonicalDate,
                            },
                        );
                    const salesPreviousValue = salesPreviousPoint?.value;
                    const salesTrend = deriveTrend(
                        row.salesCurrent,
                        salesPreviousValue,
                    );
                    const salesChange = deriveChange(
                        row.salesCurrent,
                        salesPreviousValue,
                        "count",
                    );
                    await ctx.runMutation(
                        internal.insights.metricsMutations.upsertMetric,
                        {
                            regionKey,
                            metricKey: salesKey,
                            label: salesLabel,
                            value: row.salesCurrent,
                            formattedValue: formatCount(row.salesCurrent),
                            previousValue: salesPreviousValue,
                            trend: salesTrend,
                            changePercent: salesChange.changePercent,
                            changeFormatted: salesChange.changeFormatted,
                            unit: "count",
                            category: "market_trend",
                            source: GVR_SOURCE,
                            sourceLabel: GVR_SOURCE_LABEL,
                            referenceDate: canonicalDate,
                            fetchedAt,
                            expiresAt: fetchedAt + 30 * 24 * 60 * 60 * 1000,
                        },
                    );
                    metricsUpserted++;

                    historyRows.push(
                        {
                            regionKey,
                            metricKey: listingsKey,
                            date: previousYearSameMonthDate,
                            value: row.listingsPrevYear,
                            source: GVR_SOURCE,
                            fetchedAt,
                        },
                        {
                            regionKey,
                            metricKey: listingsKey,
                            date: previousMonthDate,
                            value: row.listingsPrevMonth,
                            source: GVR_SOURCE,
                            fetchedAt,
                        },
                        {
                            regionKey,
                            metricKey: listingsKey,
                            date: canonicalDate,
                            value: row.listingsCurrent,
                            source: GVR_SOURCE,
                            fetchedAt,
                        },
                        {
                            regionKey,
                            metricKey: salesKey,
                            date: previousYearSameMonthDate,
                            value: row.salesPrevYear,
                            source: GVR_SOURCE,
                            fetchedAt,
                        },
                        {
                            regionKey,
                            metricKey: salesKey,
                            date: previousMonthDate,
                            value: row.salesPrevMonth,
                            source: GVR_SOURCE,
                            fetchedAt,
                        },
                        {
                            regionKey,
                            metricKey: salesKey,
                            date: canonicalDate,
                            value: row.salesCurrent,
                            source: GVR_SOURCE,
                            fetchedAt,
                        },
                    );
                }
            }

            for (const benchmarkRow of benchmarkRows) {
                const mappedRegionKeys = Array.from(
                    new Set(
                        getRegionKeysForGvrBenchmarkArea(
                            benchmarkRow.areaLabel,
                        ),
                    ),
                );
                if (mappedRegionKeys.length === 0) {
                    continue;
                }

                const { metricKey, label } = benchmarkMetricInfo(
                    benchmarkRow.propertyType,
                );

                for (const regionKey of mappedRegionKeys) {
                    const previousPoint: PreviousMetricPoint =
                        await ctx.runQuery(
                            internal.insights.metricHistoryQueries
                                .getPreviousMetricPoint,
                            {
                                regionKey,
                                metricKey,
                                beforeDate: canonicalDate,
                            },
                        );

                    const previousValue = previousPoint?.value;
                    const trend = deriveTrend(
                        benchmarkRow.benchmarkPrice,
                        previousValue,
                    );
                    const { changePercent, changeFormatted } = deriveChange(
                        benchmarkRow.benchmarkPrice,
                        previousValue,
                        "cad",
                    );

                    await ctx.runMutation(
                        internal.insights.metricsMutations.upsertMetric,
                        {
                            regionKey,
                            metricKey,
                            label,
                            value: benchmarkRow.benchmarkPrice,
                            formattedValue: formatCurrency(
                                benchmarkRow.benchmarkPrice,
                            ),
                            previousValue,
                            trend,
                            changePercent,
                            changeFormatted,
                            unit: "cad",
                            category: "home_prices",
                            source: GVR_SOURCE,
                            sourceLabel: GVR_SOURCE_LABEL,
                            referenceDate: canonicalDate,
                            fetchedAt,
                            expiresAt: fetchedAt + 30 * 24 * 60 * 60 * 1000,
                        },
                    );
                    metricsUpserted++;

                    historyRows.push({
                        regionKey,
                        metricKey,
                        date: canonicalDate,
                        value: benchmarkRow.benchmarkPrice,
                        source: GVR_SOURCE,
                        fetchedAt,
                    });
                }
            }

            for (const [regionKey, aggregate] of activityAggregates.entries()) {
                const salesMetricKey = "gvr_mls_sales";
                const listingsMetricKey = "gvr_new_listings";

                const salesPreviousPoint: PreviousMetricPoint =
                    await ctx.runQuery(
                        internal.insights.metricHistoryQueries
                            .getPreviousMetricPoint,
                        {
                            regionKey,
                            metricKey: salesMetricKey,
                            beforeDate: canonicalDate,
                        },
                    );
                const salesPreviousValue = salesPreviousPoint?.value;
                const salesTrend = deriveTrend(
                    aggregate.salesCurrent,
                    salesPreviousValue,
                );
                const salesChange = deriveChange(
                    aggregate.salesCurrent,
                    salesPreviousValue,
                    "count",
                );
                await ctx.runMutation(
                    internal.insights.metricsMutations.upsertMetric,
                    {
                        regionKey,
                        metricKey: salesMetricKey,
                        label: "GVR MLS Sales",
                        value: aggregate.salesCurrent,
                        formattedValue: formatCount(aggregate.salesCurrent),
                        previousValue: salesPreviousValue,
                        trend: salesTrend,
                        changePercent: salesChange.changePercent,
                        changeFormatted: salesChange.changeFormatted,
                        unit: "count",
                        category: "market_trend",
                        source: GVR_SOURCE,
                        sourceLabel: GVR_SOURCE_LABEL,
                        referenceDate: canonicalDate,
                        fetchedAt,
                        expiresAt: fetchedAt + 30 * 24 * 60 * 60 * 1000,
                    },
                );
                metricsUpserted++;

                const listingsPreviousPoint: PreviousMetricPoint =
                    await ctx.runQuery(
                        internal.insights.metricHistoryQueries
                            .getPreviousMetricPoint,
                        {
                            regionKey,
                            metricKey: listingsMetricKey,
                            beforeDate: canonicalDate,
                        },
                    );
                const listingsPreviousValue = listingsPreviousPoint?.value;
                const listingsTrend = deriveTrend(
                    aggregate.listingsCurrent,
                    listingsPreviousValue,
                );
                const listingsChange = deriveChange(
                    aggregate.listingsCurrent,
                    listingsPreviousValue,
                    "count",
                );
                await ctx.runMutation(
                    internal.insights.metricsMutations.upsertMetric,
                    {
                        regionKey,
                        metricKey: listingsMetricKey,
                        label: "GVR New Listings",
                        value: aggregate.listingsCurrent,
                        formattedValue: formatCount(aggregate.listingsCurrent),
                        previousValue: listingsPreviousValue,
                        trend: listingsTrend,
                        changePercent: listingsChange.changePercent,
                        changeFormatted: listingsChange.changeFormatted,
                        unit: "count",
                        category: "inventory",
                        source: GVR_SOURCE,
                        sourceLabel: GVR_SOURCE_LABEL,
                        referenceDate: canonicalDate,
                        fetchedAt,
                        expiresAt: fetchedAt + 30 * 24 * 60 * 60 * 1000,
                    },
                );
                metricsUpserted++;

                historyRows.push(
                    {
                        regionKey,
                        metricKey: salesMetricKey,
                        date: previousYearSameMonthDate,
                        value: aggregate.salesPrevYear,
                        source: GVR_SOURCE,
                        fetchedAt,
                    },
                    {
                        regionKey,
                        metricKey: salesMetricKey,
                        date: previousMonthDate,
                        value: aggregate.salesPrevMonth,
                        source: GVR_SOURCE,
                        fetchedAt,
                    },
                    {
                        regionKey,
                        metricKey: salesMetricKey,
                        date: canonicalDate,
                        value: aggregate.salesCurrent,
                        source: GVR_SOURCE,
                        fetchedAt,
                    },
                    {
                        regionKey,
                        metricKey: listingsMetricKey,
                        date: previousYearSameMonthDate,
                        value: aggregate.listingsPrevYear,
                        source: GVR_SOURCE,
                        fetchedAt,
                    },
                    {
                        regionKey,
                        metricKey: listingsMetricKey,
                        date: previousMonthDate,
                        value: aggregate.listingsPrevMonth,
                        source: GVR_SOURCE,
                        fetchedAt,
                    },
                    {
                        regionKey,
                        metricKey: listingsMetricKey,
                        date: canonicalDate,
                        value: aggregate.listingsCurrent,
                        source: GVR_SOURCE,
                        fetchedAt,
                    },
                );
            }

            logStage({
                step: "upsert_latest",
                status: "success",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: upsertLatestStart,
                extra: { metricsUpserted },
            });

            const upsertHistoryStart = Date.now();
            logStage({
                step: "upsert_history",
                status: "start",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: upsertHistoryStart,
            });

            let historyRowsUpserted = 0;
            for (let i = 0; i < historyRows.length; i += 50) {
                const batch = historyRows.slice(i, i + 50);
                const result: { inserted: number } = await ctx.runMutation(
                    internal.insights.metricHistoryMutations.batchUpsertHistory,
                    { rows: batch },
                );
                historyRowsUpserted += result.inserted;
            }

            logStage({
                step: "upsert_history",
                status: "success",
                reportMonth: args.reportMonth,
                url: args.reportUrl,
                startedAt: upsertHistoryStart,
                extra: { historyRowsUpserted },
            });

            await ctx.runMutation(
                internal.insights.gvrDiscovery.saveCheckpoint,
                {
                    reportUrl: args.reportUrl,
                    reportMonth: args.reportMonth,
                    publishedAt: args.publishedAt,
                    ingestedAt: fetchedAt,
                },
            );

            try {
                await ctx.scheduler.runAfter(
                    0,
                    internal.insights.marketSummary.generateMarketSummary,
                    { regionKey: GVR_PRIMARY_REGION_KEY },
                );
            } catch (error) {
                console.error(
                    `[GVR][summary_schedule_failed] ${error instanceof Error ? error.message : String(error)}`,
                );
            }

            return {
                success: true,
                metricsUpserted,
                historyRowsUpserted,
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            console.error(`[GVR][ingest_failed] ${message}`);
            return {
                success: false,
                metricsUpserted: 0,
                historyRowsUpserted: 0,
                error: message,
            };
        }
    },
});
