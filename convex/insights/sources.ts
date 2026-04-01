// Curated market data sources by region.
// Current scope is Greater Vancouver regions only.

export interface MarketSource {
    name: string;
    url: string;
    categories: Array<
        | "home_prices"
        | "inventory"
        | "mortgage_rates"
        | "market_trend"
        | "new_construction"
        | "rental"
    >;
    national?: boolean; // If true, applies to all regions
}

const GVR_MARKET_WATCH_URL =
    "https://www.gvrealtors.ca/market-watch/monthly-market-report.html";

function gvrMarketWatchSource(regionLabel: string): MarketSource[] {
    return [
        {
            name: `GVR Market Watch (${regionLabel})`,
            url: GVR_MARKET_WATCH_URL,
            categories: ["home_prices", "inventory", "market_trend"],
        },
    ];
}

// Greater Vancouver city-specific sources
export const CITY_SOURCES: Record<string, MarketSource[]> = {
    "lower-mainland-bc-ca": gvrMarketWatchSource("Lower Mainland"),
    "greater-vancouver-bc-ca": gvrMarketWatchSource("Greater Vancouver"),
    "burnaby-east-bc-ca": gvrMarketWatchSource("Burnaby East"),
    "burnaby-north-bc-ca": gvrMarketWatchSource("Burnaby North"),
    "burnaby-south-bc-ca": gvrMarketWatchSource("Burnaby South"),
    "coquitlam-bc-ca": gvrMarketWatchSource("Coquitlam"),
    "ladner-bc-ca": gvrMarketWatchSource("Ladner"),
    "maple-ridge-bc-ca": gvrMarketWatchSource("Maple Ridge"),
    "new-westminster-bc-ca": gvrMarketWatchSource("New Westminster"),
    "north-vancouver-bc-ca": gvrMarketWatchSource("North Vancouver"),
    "pitt-meadows-bc-ca": gvrMarketWatchSource("Pitt Meadows"),
    "port-coquitlam-bc-ca": gvrMarketWatchSource("Port Coquitlam"),
    "port-moody-bc-ca": gvrMarketWatchSource("Port Moody"),
    "richmond-bc-ca": gvrMarketWatchSource("Richmond"),
    "squamish-bc-ca": gvrMarketWatchSource("Squamish"),
    "sunshine-coast-bc-ca": gvrMarketWatchSource("Sunshine Coast"),
    "tsawwassen-bc-ca": gvrMarketWatchSource("Tsawwassen"),
    "vancouver-east-bc-ca": gvrMarketWatchSource("Vancouver East"),
    "vancouver-west-bc-ca": gvrMarketWatchSource("Vancouver West"),
    "west-vancouver-bc-ca": gvrMarketWatchSource("West Vancouver"),
    "whistler-bc-ca": gvrMarketWatchSource("Whistler"),
};

// Helper to get sources for a region
export function getSourcesForRegion(
    city: string,
    state?: string,
    country: string = "CA",
): MarketSource[] {
    const province = state || "bc";
    const key = `${city.toLowerCase().replace(/\s+/g, "-")}-${province.toLowerCase()}-${country.toLowerCase()}`;
    const citySpecific = CITY_SOURCES[key] || [];

    if (citySpecific.length === 0) {
        return [];
    }

    return citySpecific;
}

// Helper to get all unique region keys that have sources
export function getSupportedRegions(): Array<{
    city: string;
    state?: string;
    country: string;
    key: string;
}> {
    return Object.keys(CITY_SOURCES).map((key) => {
        const parts = key.split("-");
        const country = parts.pop() || "ca";
        const province = parts.pop() || "bc";
        const city = parts.join("-");

        return {
            city: city
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" "),
            state: province.toUpperCase(),
            country: country.toUpperCase(),
            key,
        };
    });
}

// Check if we have sources for a region
export function hasSourcesForRegion(
    city: string,
    state?: string,
    country: string = "CA",
): boolean {
    const province = state || "bc";
    const key = `${city.toLowerCase().replace(/\s+/g, "-")}-${province.toLowerCase()}-${country.toLowerCase()}`;
    return key in CITY_SOURCES;
}
