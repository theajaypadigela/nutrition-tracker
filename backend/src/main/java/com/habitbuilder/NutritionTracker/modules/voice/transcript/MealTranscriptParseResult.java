package com.habitbuilder.NutritionTracker.modules.voice.transcript;

/**
 * Outcome of parsing one transcript. {@code duplicateTranscript} distinguishes "nothing to
 * log" from "already logged", so the client can stay quiet instead of reporting a failure.
 */
public record MealTranscriptParseResult(int entriesLogged, boolean duplicateTranscript) {
}
