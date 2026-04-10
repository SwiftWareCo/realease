const DEFAULT_OPENROUTER_PRIMARY_MODEL =
    "arcee-ai/trinity-large-preview:free";
const DEFAULT_OPENROUTER_FALLBACK_MODELS = [
    // Strong free models that currently support response_format + structured_outputs.
    "nvidia/nemotron-3-super-120b-a12b:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    // Keep router last as a broad free-capacity catch-all.
    "openrouter/free",
] as const;

function parseModelList(input: string | undefined) {
    return (input ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
}

function dedupeModels(models: string[]) {
    return Array.from(new Set(models));
}

const configuredPrimaryModel =
    process.env.OPENROUTER_PRIMARY_MODEL?.trim() ||
    process.env.OPENROUTER_FREE_MODEL?.trim() ||
    "";
const configuredFallbackModels = parseModelList(
    process.env.OPENROUTER_FALLBACK_MODELS,
);

export const OPENROUTER_PRIMARY_MODEL =
    configuredPrimaryModel || DEFAULT_OPENROUTER_PRIMARY_MODEL;
export const OPENROUTER_FALLBACK_MODELS = dedupeModels([
    ...configuredFallbackModels,
    ...DEFAULT_OPENROUTER_FALLBACK_MODELS,
]).filter((model) => model !== OPENROUTER_PRIMARY_MODEL);

const MAX_OPENROUTER_CANDIDATES_PER_REQUEST = 3;

export const OPENROUTER_MODEL_CANDIDATES = [
    OPENROUTER_PRIMARY_MODEL,
    ...OPENROUTER_FALLBACK_MODELS,
].slice(0, MAX_OPENROUTER_CANDIDATES_PER_REQUEST);

// Backward-compatible alias used across existing call-sites.
export const OPENROUTER_FREE_MODEL = OPENROUTER_PRIMARY_MODEL;
