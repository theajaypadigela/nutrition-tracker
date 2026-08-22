package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Vapi voice-call configuration ({@code vapi.*}).
 *
 * <p>Meal and habit calls each have their own assistant, with {@code vapi.assistant-id} as a
 * shared fallback. The three assistant ids deliberately have no default, so {@code null}
 * (unset) stays distinguishable from {@code ""} (explicitly set empty) — the fallback applies
 * only to the former, matching the nested placeholder this replaced.
 */
@ConfigurationProperties("vapi")
public record VapiProperties(
        @DefaultValue("") String publicKey,
        @DefaultValue("") String webhookSecret,
        String assistantId,
        String mealAssistantId,
        String habitAssistantId) {

    /** The assistant meal calls dial, after the shared fallback. */
    public String resolvedMealAssistantId() {
        return mealAssistantId != null ? mealAssistantId : orEmpty(assistantId);
    }

    /** The assistant habit calls dial, after the shared fallback. */
    public String resolvedHabitAssistantId() {
        return habitAssistantId != null ? habitAssistantId : orEmpty(assistantId);
    }

    /**
     * The meal assistant as configured, <b>without</b> the shared fallback — blank here means
     * meal calls are borrowing the generic assistant, which is worth warning about.
     */
    public String dedicatedMealAssistantId() {
        return orEmpty(mealAssistantId);
    }

    private static String orEmpty(String value) {
        return value != null ? value : "";
    }
}
