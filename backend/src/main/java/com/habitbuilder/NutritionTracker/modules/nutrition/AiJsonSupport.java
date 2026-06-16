package com.habitbuilder.NutritionTracker.modules.nutrition;

/**
 * Shared helpers for the two voice-transcript interpreters (meal + habit), which previously
 * each carried a byte-for-byte copy of the JSON-cleanup logic and their own ad-hoc rationale
 * strings. Centralizing them keeps the cleanup behavior and the analytics sentinels identical
 * across both modules.
 */
public final class AiJsonSupport {

    private AiJsonSupport() {
    }

    /** Rationale emitted when the transcript was empty/missing. */
    public static final String RATIONALE_NO_TRANSCRIPT = "no_transcript";
    /** Rationale fallback when the model classified but omitted its own rationale. */
    public static final String RATIONALE_CLASSIFIED = "classified_by_ai";
    /** Rationale emitted when interpretation threw and we fell back to the safe default. */
    public static final String RATIONALE_FAILED = "ai_interpretation_failed";

    /**
     * Strips ```json / ``` fences and trims to the outer {...} object. Returns "{}" for null
     * input so callers can always parse the result without a separate null check.
     */
    public static String extractJson(String text) {
        if (text == null) {
            return "{}";
        }

        String cleaned = text.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7).trim();
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3).trim();
        }
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3).trim();
        }

        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start != -1 && end != -1 && end > start) {
            return cleaned.substring(start, end + 1);
        }

        return cleaned;
    }
}
