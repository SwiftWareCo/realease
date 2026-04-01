export function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function shouldRetryOpenRouterError(error: unknown) {
    const message =
        error instanceof Error ? error.message.toLowerCase() : String(error);

    return /provider returned error|rate limit|429|timeout|timed out|502|503|504|connection|network|econnreset|internal/i.test(
        message,
    );
}

function collectText(
    value: unknown,
    chunks: string[],
    visited: WeakSet<object>,
    depth: number,
) {
    if (depth > 6 || value === null || value === undefined) {
        return;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            chunks.push(trimmed);
        }
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            collectText(item, chunks, visited, depth + 1);
        }
        return;
    }

    if (typeof value !== "object") {
        return;
    }

    if (visited.has(value)) {
        return;
    }
    visited.add(value);

    const obj = value as Record<string, unknown>;

    const prioritizedKeys = [
        "text",
        "content",
        "output_text",
        "value",
        "message",
    ] as const;

    for (const key of prioritizedKeys) {
        if (key in obj) {
            collectText(obj[key], chunks, visited, depth + 1);
        }
    }

    if (chunks.length === 0) {
        for (const nested of Object.values(obj)) {
            collectText(nested, chunks, visited, depth + 1);
        }
    }
}

export function normalizeOpenRouterText(messageContent: unknown) {
    const chunks: string[] = [];
    collectText(messageContent, chunks, new WeakSet<object>(), 0);

    const text = chunks.join("\n").trim();
    if (text.length > 0) {
        return text;
    }

    if (messageContent === null || messageContent === undefined) {
        return "";
    }

    try {
        return JSON.stringify(messageContent);
    } catch {
        return String(messageContent);
    }
}

function tryParseJson<T>(input: string): T | null {
    const cleaned = input
        .trim()
        .replace(/^\uFEFF/, "")
        .replace(/\u0000/g, "");

    if (!cleaned) return null;

    try {
        return JSON.parse(cleaned) as T;
    } catch {
        return null;
    }
}

function extractBalancedJsonObject(text: string): string | null {
    const start = text.indexOf("{");
    if (start === -1) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === "{") {
            depth += 1;
            continue;
        }

        if (char === "}") {
            depth -= 1;
            if (depth === 0) {
                return text.slice(start, i + 1);
            }
        }
    }

    return null;
}

export function parseJsonObjectFromText<T>(text: string): T | null {
    const candidates: string[] = [];

    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch?.[1]) {
        candidates.push(codeBlockMatch[1]);
    }

    const balanced = extractBalancedJsonObject(text);
    if (balanced) {
        candidates.push(balanced);
    }

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        candidates.push(text.slice(firstBrace, lastBrace + 1));
    }

    for (const candidate of candidates) {
        const direct = tryParseJson<T>(candidate);
        if (direct) {
            return direct;
        }

        // Common model error: trailing commas in objects/arrays.
        const noTrailingCommas = candidate.replace(/,\s*([}\]])/g, "$1");
        const repaired = tryParseJson<T>(noTrailingCommas);
        if (repaired) {
            return repaired;
        }
    }

    return null;
}
