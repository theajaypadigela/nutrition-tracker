package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Browser origins the API answers ({@code cors.*}).
 *
 * <p>Held as the raw comma-separated string rather than a {@code List<String>} on purpose:
 * {@code SecurityConfig} already normalises it (split, trim, drop blanks, fall back to
 * {@code "*"} when nothing survives) and relaxed binding's own splitting is not identical at
 * the edges. Keeping the string keeps that normalisation the single source of truth.
 */
@ConfigurationProperties("cors")
public record CorsProperties(
        @DefaultValue("*") String allowedOrigins) {
}
