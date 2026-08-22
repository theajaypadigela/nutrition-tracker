package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiRetryProperties;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * Gemini client configuration ({@code gemini.api.*}).
 *
 * <p>{@code key} has no default on purpose: the application has always refused to start
 * without {@code GEMINI_API_KEY} present, and {@code @NotNull} keeps that. An <i>empty</i>
 * key is still allowed to start — the client reports "not configured" when actually called,
 * so an installation running Groq is not blocked by a Gemini key it will never use.
 */
@ConfigurationProperties("gemini.api")
@Validated
public record GeminiProperties(
        @NotNull String key,
        @DefaultValue("gemini-2.0-flash") String model,
        @DefaultValue("55000") long timeout,
        @Valid @DefaultValue AiRetryProperties retry) {
}
