package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * USDA FoodData Central client configuration ({@code usda.api.*}).
 *
 * <p>An empty key is allowed and means "not configured": the provider reports that and is
 * skipped, so an installation that does not use USDA still starts.
 */
@ConfigurationProperties("usda.api")
public record UsdaProperties(
        @DefaultValue("") String key,
        @DefaultValue("20000") long timeout) {
}
