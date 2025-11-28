// Helpers specific to Gemini CLI output/argv handling.

// Preferred binary name for Gemini CLI invocations.
export const GEMINI_BIN = "gemini";

export const GEMINI_IDENTITY_PREFIX =
    "You are Gem running on the user's Mac via warelay. Your scratchpad is /Users/sidhaarthkrishnan/gemini; this is your folder and you can add what you like in markdown files. You don't need to be concise, but WhatsApp replies must stay under ~1500 characters. Media you can send: images ≤6MB, audio/video ≤16MB, documents ≤100MB. The prompt may include a media path and an optional Transcript: section—use them when present. If a prompt is a heartbeat poll and nothing needs attention, reply with exactly HEARTBEAT_OK and nothing else; for any alert, do not include HEARTBEAT_OK.";

export type GeminiJsonParseResult = {
    text?: string;
    parsed: unknown;
    valid: boolean;
    meta?: {
        durationMs?: number;
        cost?: number; // Gemini might not provide cost in the same way, but keeping structure
        tokens?: {
            input?: number;
            output?: number;
        };
    };
};

export function parseGeminiJson(raw: string): GeminiJsonParseResult {
    try {
        let parsed: any;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // If direct parsing fails, try to find a JSON object within the string.
            // This handles cases where the CLI outputs logs/text before/after the JSON.
            const firstOpen = raw.indexOf("{");
            const lastClose = raw.lastIndexOf("}");
            if (firstOpen !== -1 && lastClose > firstOpen) {
                try {
                    const jsonSubstring = raw.substring(firstOpen, lastClose + 1);
                    parsed = JSON.parse(jsonSubstring);
                } catch {
                    // Still failed, return invalid
                    return { parsed: {}, valid: false };
                }
            } else {
                return { parsed: {}, valid: false };
            }
        }

        let text = "";
        let valid = false;
        const meta: GeminiJsonParseResult["meta"] = {};

        if (parsed && typeof parsed === "object") {
            // Attempt to extract text from common Gemini JSON structures
            // Note: The exact schema isn't fully documented publicly, so we'll try common patterns
            // and refine as needed.
            if (typeof parsed.text === "string") {
                text = parsed.text;
                valid = true;
            } else if (typeof parsed.response === "string") {
                text = parsed.response;
                valid = true;
            } else if (typeof parsed.content === "string") {
                text = parsed.content;
                valid = true;
            } else if (
                parsed.candidates &&
                Array.isArray(parsed.candidates) &&
                parsed.candidates.length > 0
            ) {
                const first = parsed.candidates[0];
                if (first.content && first.content.parts && Array.isArray(first.content.parts)) {
                    text = first.content.parts.map((p: any) => p.text).join("");
                    valid = true;
                } else if (typeof first.output === "string") {
                    text = first.output;
                    valid = true;
                }
            }

            // Extract metadata if available
            // Extract metadata if available
            if (parsed.usageMetadata) {
                if (parsed.usageMetadata.promptTokenCount) {
                    meta.tokens = meta.tokens || {};
                    meta.tokens.input = parsed.usageMetadata.promptTokenCount;
                }
                if (parsed.usageMetadata.candidatesTokenCount) {
                    meta.tokens = meta.tokens || {};
                    meta.tokens.output = parsed.usageMetadata.candidatesTokenCount;
                }
            } else if (parsed.stats && parsed.stats.models) {
                // Handle new stats structure: stats.models[modelName].tokens
                let input = 0;
                let output = 0;
                for (const modelKey in parsed.stats.models) {
                    const modelStats = parsed.stats.models[modelKey];
                    if (modelStats.tokens) {
                        input += modelStats.tokens.prompt || 0;
                        output += modelStats.tokens.candidates || 0;
                    }
                }
                if (input > 0 || output > 0) {
                    meta.tokens = { input, output };
                }
            }

            // Handle error field
            if (parsed.error) {
                // If there's an error, we might want to expose it or mark as invalid.
                // For now, if we have no text but have an error, let's treat it as invalid
                // but maybe log it? The caller handles invalid results.
                // If we want to bubble up the error message to the user:
                if (!text && parsed.error.message) {
                    text = `Error from Gemini: ${parsed.error.message}`;
                    // We mark it as valid so the user sees the error message instead of a generic failure
                    valid = true;
                }
            }
        }

        return {
            text: text || undefined,
            parsed,
            valid,
            meta: Object.keys(meta).length > 0 ? meta : undefined,
        };
    } catch {
        return {
            parsed: {},
            valid: false,
        };
    }
}

export function summarizeGeminiMetadata(
    meta: GeminiJsonParseResult["meta"],
): string | undefined {
    if (!meta) return undefined;
    const parts: string[] = [];
    if (meta.durationMs !== undefined)
        parts.push(`duration=${meta.durationMs}ms`);
    if (meta.cost !== undefined) parts.push(`cost=$${meta.cost.toFixed(4)}`);
    if (meta.tokens) {
        parts.push(`tokens=${meta.tokens.input}+${meta.tokens.output}`);
    }
    return parts.length ? parts.join(", ") : undefined;
}
