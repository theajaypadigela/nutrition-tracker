package com.habitbuilder.NutritionTracker.modules.nutrition.provider;

import java.util.Optional;

import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionCache;

/**
 * A source of per-base-unit nutrition data for a food name. Implementations
 * are chained by {@code nutrition.provider-chain}; the first one to return a
 * result wins. Adding a new source means adding a bean, not editing the
 * enrichment flow.
 */
public interface NutritionProvider {

    /** Stable source tag stored on cache entries, e.g. "SPOONACULAR". */
    String source();

    /** Whether required credentials/config are present. Unconfigured providers are skipped. */
    boolean isConfigured();

    /**
     * Looks up nutrition data and maps it to an unsaved {@link NutritionCache}
     * entry. Empty when the source has no usable answer; terminal providers
     * (AI) may throw instead so the failure reaches the retry loop.
     */
    Optional<ProviderResult> fetch(String foodName, String normalizedFoodName);

    /** An unsaved cache entry plus the raw payload it was derived from (kept for auditing). */
    record ProviderResult(NutritionCache cacheEntry, String rawPayload) {
    }
}
