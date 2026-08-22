package com.habitbuilder.NutritionTracker.modules.nutrition.ai;

import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Retry tuning shared by every {@code AiTextClient}, bound as the nested {@code retry} block
 * of each provider's properties.
 *
 * <p>The canonical constructor clamps the values so a nonsensical configuration — zero
 * attempts, a max backoff below the initial one — can never reach the retry loop.
 */
public record AiRetryProperties(
        @DefaultValue("3") int maxAttempts,
        @DefaultValue("700") long initialBackoffMs,
        @DefaultValue("3000") long maxBackoffMs) {

    public AiRetryProperties {
        maxAttempts = Math.max(1, maxAttempts);
        initialBackoffMs = Math.max(100, initialBackoffMs);
        maxBackoffMs = Math.max(initialBackoffMs, maxBackoffMs);
    }
}
