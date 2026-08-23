package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Spoonacular client configuration ({@code spoonacular.api.*}).
 *
 * <p>An empty key is allowed and means "not configured": the provider reports that and is
 * skipped, so an installation that does not use Spoonacular still starts.
 */
@ConfigurationProperties("spoonacular.api")
public record SpoonacularProperties(
        @DefaultValue("") String key,
        @DefaultValue("20000") long timeout) {
}
