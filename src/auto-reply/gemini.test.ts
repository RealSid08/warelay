import { describe, expect, it } from "vitest";

import { parseGeminiJson } from "./gemini.js";

describe("gemini JSON parsing", () => {
    it("extracts text from simple JSON object with text field", () => {
        const out = parseGeminiJson('{"text":"hello world"}');
        expect(out.text).toBe("hello world");
        expect(out.valid).toBe(true);
    });

    it("extracts text from JSON object with content field", () => {
        const out = parseGeminiJson('{"content":"hello content"}');
        expect(out.text).toBe("hello content");
        expect(out.valid).toBe(true);
    });

    it("extracts text from candidates array structure", () => {
        const sample = {
            candidates: [
                {
                    content: {
                        parts: [{ text: "hello from candidates" }],
                    },
                },
            ],
        };
        const out = parseGeminiJson(JSON.stringify(sample));
        expect(out.text).toBe("hello from candidates");
        expect(out.valid).toBe(true);
    });

    it("extracts text from candidates output field", () => {
        const sample = {
            candidates: [
                {
                    output: "hello from output",
                },
            ],
        };
        const out = parseGeminiJson(JSON.stringify(sample));
        expect(out.text).toBe("hello from output");
        expect(out.valid).toBe(true);
    });

    it("extracts metadata if available", () => {
        const sample = {
            text: "response",
            usageMetadata: {
                promptTokenCount: 10,
                candidatesTokenCount: 20,
            },
        };
        const out = parseGeminiJson(JSON.stringify(sample));
        expect(out.text).toBe("response");
        expect(out.meta?.tokens?.input).toBe(10);
        expect(out.meta?.tokens?.output).toBe(20);
    });

    it("returns invalid on non-JSON input", () => {
        const out = parseGeminiJson("not json");
        expect(out.valid).toBe(false);
        expect(out.text).toBeUndefined();
    });

    it("returns invalid on JSON without recognizable text", () => {
        const out = parseGeminiJson('{"unknown_field": 123}');
        expect(out.valid).toBe(false);
        expect(out.text).toBeUndefined();
    });

    it("extracts text from response field (new format)", () => {
        const sample = {
            response: "yo. what's up?",
            stats: {
                models: {
                    "gemini-2.5-flash-lite": {
                        api: { totalRequests: 1 },
                    },
                },
            },
        };
        const out = parseGeminiJson(JSON.stringify(sample));
        expect(out.text).toBe("yo. what's up?");
        expect(out.valid).toBe(true);
    });
});
