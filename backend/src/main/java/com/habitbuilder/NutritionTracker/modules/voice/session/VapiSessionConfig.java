package com.habitbuilder.NutritionTracker.modules.voice.session;

/** Client-side configuration for one Vapi call: the SDK token and the assistant to dial. */
public record VapiSessionConfig(String token, String assistantId, String purpose) {
}
