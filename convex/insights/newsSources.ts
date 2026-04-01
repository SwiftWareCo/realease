import { CITY_SOURCES } from "./sources";

export type NewsContextCategory =
    | "home_prices"
    | "inventory"
    | "mortgage_rates"
    | "market_trend"
    | "new_construction"
    | "rental";

export type NewsContextScope = "national" | "province" | "region";

export interface NewsContextSource {
    id: string;
    name: string;
    url: string;
    sourceKind?: "direct" | "atom_feed" | "rdf_feed" | "monthly_pdf_discovery";
    categories: NewsContextCategory[];
    scope: NewsContextScope;
    provinces?: string[];
    regionKeys?: string[];
    trustWeight: number; // 0-100
    cadenceHours: number;
    freshnessWindowDays: number;
    enabled?: boolean;
}

const GVR_REGION_KEYS = Object.keys(CITY_SOURCES);

/**
 * Curated source registry for regional news context ingestion.
 * Edit this list to add/remove sources or adjust trust/freshness weights.
 */
export const NEWS_CONTEXT_SOURCES: NewsContextSource[] = [
    {
        id: "boc-press-releases-feed",
        name: "Bank of Canada Press Releases Feed",
        url: "https://www.bankofcanada.ca/feed/?content_type=press-releases&post_type%5B0%5D=post&post_type%5B1%5D=page",
        sourceKind: "rdf_feed",
        categories: ["mortgage_rates", "market_trend"],
        scope: "national",
        trustWeight: 100,
        cadenceHours: 24,
        freshnessWindowDays: 14,
        enabled: true,
    },
    {
        id: "bcrea-monthly-housing-update",
        name: "BCREA Monthly Housing Market Update",
        url: "https://www.bcrea.bc.ca/wp-content/uploads/",
        sourceKind: "monthly_pdf_discovery",
        categories: ["home_prices", "inventory", "new_construction", "rental"],
        scope: "province",
        provinces: ["bc"],
        trustWeight: 90,
        cadenceHours: 24,
        freshnessWindowDays: 21,
        enabled: true,
    },
    {
        id: "gvr-media-room-feed",
        name: "GVR Media Room Feed",
        url: "https://www.gvrealtors.ca/content/rebgv-org/media-room.xml",
        sourceKind: "atom_feed",
        categories: ["home_prices", "inventory", "market_trend"],
        scope: "region",
        regionKeys: GVR_REGION_KEYS,
        trustWeight: 95,
        cadenceHours: 24,
        freshnessWindowDays: 14,
        enabled: true,
    },
];

type RegionInput = {
    city: string;
    state?: string;
    country?: string;
};

function toRegionKey({ city, state, country = "CA" }: RegionInput) {
    return `${city.toLowerCase().replace(/\s+/g, "-")}-${state?.toLowerCase() || ""}-${country.toLowerCase()}`;
}

function normalizeProvince(state?: string) {
    return (state ?? "").trim().toLowerCase();
}

function dedupeSourcesByUrl(sources: NewsContextSource[]) {
    const byUrl = new Map<string, NewsContextSource>();
    for (const source of sources) {
        if (!byUrl.has(source.url)) {
            byUrl.set(source.url, source);
            continue;
        }

        const existing = byUrl.get(source.url)!;
        if (source.trustWeight > existing.trustWeight) {
            byUrl.set(source.url, source);
        }
    }
    return Array.from(byUrl.values());
}

export function getNewsContextSourcesForRegion(
    city: string,
    state?: string,
    country: string = "CA",
): NewsContextSource[] {
    const regionKey = toRegionKey({ city, state, country });
    const province = normalizeProvince(state);

    const matched = NEWS_CONTEXT_SOURCES.filter((source) => {
        if (source.enabled === false) {
            return false;
        }

        if (source.scope === "national") {
            return true;
        }

        if (source.scope === "province") {
            return (source.provinces ?? []).includes(province);
        }

        return (source.regionKeys ?? []).includes(regionKey);
    });

    return dedupeSourcesByUrl(matched).sort(
        (a, b) => b.trustWeight - a.trustWeight,
    );
}

export function hasNewsContextSourcesForRegion(
    city: string,
    state?: string,
    country: string = "CA",
) {
    return getNewsContextSourcesForRegion(city, state, country).length > 0;
}
