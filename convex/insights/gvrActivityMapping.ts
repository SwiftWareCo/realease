const AREA_TO_REGION_KEYS: Record<string, string[]> = {
    "GRAND TOTALS": ["gvr-grand-total-ca", "greater-vancouver-bc-ca"],
    "BOWEN ISLAND": [],
    BURNABY: [
        "burnaby-east-bc-ca",
        "burnaby-north-bc-ca",
        "burnaby-south-bc-ca",
    ],
    COQUITLAM: ["coquitlam-bc-ca"],
    DELTA: ["ladner-bc-ca", "tsawwassen-bc-ca"],
    "ISLANDS - GULF": [],
    "MAPLE RIDGE/PITT MEADOWS": ["maple-ridge-bc-ca", "pitt-meadows-bc-ca"],
    "NEW WESTMINSTER": ["new-westminster-bc-ca"],
    "NORTH VANCOUVER": ["north-vancouver-bc-ca"],
    "PORT COQUITLAM": ["port-coquitlam-bc-ca"],
    "PORT MOODY/BELCARRA": ["port-moody-bc-ca"],
    RICHMOND: ["richmond-bc-ca"],
    SQUAMISH: ["squamish-bc-ca"],
    "SUNSHINE COAST": ["sunshine-coast-bc-ca"],
    "VANCOUVER EAST": ["vancouver-east-bc-ca"],
    "VANCOUVER WEST": ["vancouver-west-bc-ca"],
    "WEST VANCOUVER/HOWE SOUND": ["west-vancouver-bc-ca"],
    "WHISTLER/PEMBERTON": ["whistler-bc-ca"],
};

const REGION_KEY_TO_AREA: Record<string, string> = {
    "greater-vancouver-bc-ca": "GRAND TOTALS",
    "burnaby-east-bc-ca": "BURNABY",
    "burnaby-north-bc-ca": "BURNABY",
    "burnaby-south-bc-ca": "BURNABY",
    "coquitlam-bc-ca": "COQUITLAM",
    "ladner-bc-ca": "DELTA",
    "tsawwassen-bc-ca": "DELTA",
    "maple-ridge-bc-ca": "MAPLE RIDGE/PITT MEADOWS",
    "pitt-meadows-bc-ca": "MAPLE RIDGE/PITT MEADOWS",
    "new-westminster-bc-ca": "NEW WESTMINSTER",
    "north-vancouver-bc-ca": "NORTH VANCOUVER",
    "port-coquitlam-bc-ca": "PORT COQUITLAM",
    "port-moody-bc-ca": "PORT MOODY/BELCARRA",
    "richmond-bc-ca": "RICHMOND",
    "squamish-bc-ca": "SQUAMISH",
    "sunshine-coast-bc-ca": "SUNSHINE COAST",
    "vancouver-east-bc-ca": "VANCOUVER EAST",
    "vancouver-west-bc-ca": "VANCOUVER WEST",
    "west-vancouver-bc-ca": "WEST VANCOUVER/HOWE SOUND",
    "whistler-bc-ca": "WHISTLER/PEMBERTON",
};

export const GVR_GRAND_TOTAL_REGION_KEY = "gvr-grand-total-ca";

const BENCHMARK_AREA_TO_REGION_KEYS: Record<string, string[]> = {
    "GREATER VANCOUVER": [
        GVR_GRAND_TOTAL_REGION_KEY,
        "greater-vancouver-bc-ca",
    ],
    "LOWER MAINLAND": ["lower-mainland-bc-ca"],
    "RESIDENTIAL / COMPOSITE LOWER MAINLAND": ["lower-mainland-bc-ca"],
    "SINGLE FAMILY DETACHED LOWER MAINLAND": ["lower-mainland-bc-ca"],
    "TOWNHOUSE LOWER MAINLAND": ["lower-mainland-bc-ca"],
    "APARTMENT LOWER MAINLAND": ["lower-mainland-bc-ca"],
    "BOWEN ISLAND": [],
    "BURNABY EAST": ["burnaby-east-bc-ca"],
    "BURNABY NORTH": ["burnaby-north-bc-ca"],
    "BURNABY SOUTH": ["burnaby-south-bc-ca"],
    COQUITLAM: ["coquitlam-bc-ca"],
    LADNER: ["ladner-bc-ca"],
    "MAPLE RIDGE": ["maple-ridge-bc-ca"],
    "NEW WESTMINSTER": ["new-westminster-bc-ca"],
    "NORTH VANCOUVER": ["north-vancouver-bc-ca"],
    "PITT MEADOWS": ["pitt-meadows-bc-ca"],
    "PORT COQUITLAM": ["port-coquitlam-bc-ca"],
    "PORT MOODY": ["port-moody-bc-ca"],
    "PORT MOODY/BELCARRA": ["port-moody-bc-ca"],
    RICHMOND: ["richmond-bc-ca"],
    "SOUTH DELTA": ["ladner-bc-ca", "tsawwassen-bc-ca"],
    SQUAMISH: ["squamish-bc-ca"],
    "SUNSHINE COAST": ["sunshine-coast-bc-ca"],
    TSAWWASSEN: ["tsawwassen-bc-ca"],
    "VANCOUVER EAST": ["vancouver-east-bc-ca"],
    "VANCOUVER WEST": ["vancouver-west-bc-ca"],
    "WEST VANCOUVER": ["west-vancouver-bc-ca"],
    "WEST VANCOUVER/HOWE SOUND": ["west-vancouver-bc-ca"],
    WHISTLER: ["whistler-bc-ca"],
    "WHISTLER/PEMBERTON": ["whistler-bc-ca"],
};

export function normalizeGvrAreaLabel(raw: string) {
    return raw.replace(/\s+/g, " ").replace(/[%]+/g, "").trim().toUpperCase();
}

export function getRegionKeysForGvrArea(areaLabel: string) {
    const normalized = normalizeGvrAreaLabel(areaLabel);
    return AREA_TO_REGION_KEYS[normalized] ?? [];
}

export function getGvrAreaForRegionKey(regionKey: string) {
    return REGION_KEY_TO_AREA[regionKey];
}

export function getRegionKeysForGvrBenchmarkArea(areaLabel: string) {
    const normalized = normalizeGvrAreaLabel(areaLabel);
    return BENCHMARK_AREA_TO_REGION_KEYS[normalized] ?? [];
}
