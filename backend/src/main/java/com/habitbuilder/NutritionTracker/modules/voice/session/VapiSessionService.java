package com.habitbuilder.NutritionTracker.modules.voice.session;

import java.util.Locale;

import jakarta.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.habitbuilder.NutritionTracker.common.ApiKeys;
import com.habitbuilder.NutritionTracker.config.properties.VapiProperties;

/**
 * Resolves the client-side Vapi call configuration: which assistant answers a given
 * purpose, and the public token the React Native SDK initialises with.
 *
 * <p>Meal and habit deliberately use two separate Vapi assistants — their voice and persona
 * are aligned in the Vapi dashboard, not here — with the shared {@code VAPI_ASSISTANT_ID} as
 * a fallback for either.
 */
@Service
public class VapiSessionService {

    private static final Logger logger = LoggerFactory.getLogger(VapiSessionService.class);
    private static final String PURPOSE_MEAL = "meal";
    private static final String PURPOSE_HABIT = "habit";

    private final VapiProperties properties;

    public VapiSessionService(VapiProperties properties) {
        this.properties = properties;
    }

    /**
     * Surfaces the meal-assistant configuration at startup so a missing dedicated meal
     * assistant is observable, not a silent accident.
     */
    @PostConstruct
    void logAssistantConfiguration() {
        if (properties.dedicatedMealAssistantId().isBlank()) {
            logger.warn(
                    "Vapi meal assistant id not set (VAPI_MEAL_ASSISTANT_ID); meal calls fall back to the shared "
                            + "VAPI_ASSISTANT_ID. Set a dedicated meal assistant to control the meal call persona/voice "
                            + "independently of habit calls.");
        } else {
            logger.info("Vapi meal assistant configured via VAPI_MEAL_ASSISTANT_ID.");
        }
        if (properties.resolvedHabitAssistantId().isBlank()) {
            logger.warn(
                    "Vapi habit assistant id resolves empty; habit calls will fail until VAPI_HABIT_ASSISTANT_ID "
                            + "(or VAPI_ASSISTANT_ID) is configured.");
        }
    }

    /** Builds the client-side Vapi session config for the given user and purpose. */
    public VapiSessionConfig createSessionConfig(String userId, String purpose) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User id is required to create Vapi session");
        }

        String normalizedPurpose = normalizePurpose(purpose);
        return new VapiSessionConfig(
                resolveClientToken(),
                resolveAssistantIdForPurpose(normalizedPurpose),
                normalizedPurpose);
    }

    /** Backward-compatible helper used by callers that only require the token. */
    public String generateToken(String userId) {
        return createSessionConfig(userId, PURPOSE_MEAL).token();
    }

    private String resolveClientToken() {
        String publicKey = ApiKeys.sanitize(properties.publicKey());
        if (!publicKey.isBlank()) {
            return publicKey;
        }

        throw new IllegalStateException("Vapi public key is not configured");
    }

    private String normalizePurpose(String purpose) {
        if (purpose == null || purpose.isBlank()) {
            return PURPOSE_MEAL;
        }

        String normalized = purpose.trim().toLowerCase(Locale.ROOT);
        if (!PURPOSE_MEAL.equals(normalized) && !PURPOSE_HABIT.equals(normalized)) {
            throw new IllegalArgumentException("Unsupported voice purpose: " + purpose);
        }
        return normalized;
    }

    private String resolveAssistantIdForPurpose(String purpose) {
        String assistantId = PURPOSE_HABIT.equals(purpose)
                ? properties.resolvedHabitAssistantId()
                : properties.resolvedMealAssistantId();
        if (assistantId.isBlank()) {
            throw new IllegalStateException("Vapi assistant id is not configured for purpose: " + purpose);
        }
        return assistantId;
    }
}
