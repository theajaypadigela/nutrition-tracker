package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Which AI text client the app talks to ({@code ai.provider}).
 *
 * <p>The value is matched case-insensitively against {@code AiTextClient#getProviderName()};
 * an unknown name is a startup failure raised by {@code AiTextService}, not by binding, so
 * the error still names the providers that were available.
 */
@ConfigurationProperties("ai")
public record AiProperties(
        @DefaultValue("groq") String provider) {
}
