package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiRetryProperties;

import jakarta.validation.Valid;

/** Groq client configuration ({@code groq.api.*}). */
@ConfigurationProperties("groq.api")
public record GroqProperties(
        @DefaultValue("") String key,
        @DefaultValue("https://api.groq.com/openai/v1/chat/completions") String url,
        @DefaultValue("llama-3.1-8b-instant") String model,
        @DefaultValue("55000") long timeout,
        @Valid @DefaultValue AiRetryProperties retry) {
}
