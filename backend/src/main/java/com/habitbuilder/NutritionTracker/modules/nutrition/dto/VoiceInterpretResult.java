package com.habitbuilder.NutritionTracker.modules.nutrition.dto;

import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiJsonSupport;

/**
 * Shared contract for the fields every voice-transcript interpretation returns, regardless of
 * domain. The meal interpreter (shouldLogMeals) and the habit interpreter (habitStatus) keep
 * their domain-specific outcome fields, but both expose the common follow-up + rationale data
 * through this interface so callers/analytics can treat them uniformly.
 */
public interface VoiceInterpretResult {

    /** Minutes until a follow-up call, or null when no reschedule was requested. */
    Integer getRescheduleMinutes();

    /** Short, machine-stable explanation of the classification (see AiJsonSupport constants). */
    String getRationale();
}
