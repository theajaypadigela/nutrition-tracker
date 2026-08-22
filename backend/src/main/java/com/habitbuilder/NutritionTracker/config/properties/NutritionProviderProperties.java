package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Which nutrition sources are consulted, and in what order ({@code nutrition.*}).
 *
 * <p>A comma-separated list of {@code NutritionProvider#source} tags; the first provider to
 * return a result wins.
 */
@ConfigurationProperties("nutrition")
public record NutritionProviderProperties(
        @DefaultValue("spoonacular,ai") String providerChain) {
}
