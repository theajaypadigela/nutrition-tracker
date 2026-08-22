package com.habitbuilder.NutritionTracker.modules.nutrition.ai;

/**
 * Retry tuning shared by every {@code AiTextClient}. The canonical constructor clamps the
 * values so a nonsensical configuration (zero attempts, a max backoff below the initial
 * one) can never reach the retry loop.
 */
public record AiRetryProperties(int maxAttempts, long initialBackoffMs, long maxBackoffMs) {

    /** Defaults matching the historical {@code *.api.retry.*} property defaults. */
    public static final int DEFAULT_MAX_ATTEMPTS = 3;
    public static final long DEFAULT_INITIAL_BACKOFF_MS = 700;
    public static final long DEFAULT_MAX_BACKOFF_MS = 3000;

    public AiRetryProperties {
        maxAttempts = Math.max(1, maxAttempts);
        initialBackoffMs = Math.max(100, initialBackoffMs);
        maxBackoffMs = Math.max(initialBackoffMs, maxBackoffMs);
    }

    public static AiRetryProperties defaults() {
        return new AiRetryProperties(DEFAULT_MAX_ATTEMPTS, DEFAULT_INITIAL_BACKOFF_MS, DEFAULT_MAX_BACKOFF_MS);
    }
}
