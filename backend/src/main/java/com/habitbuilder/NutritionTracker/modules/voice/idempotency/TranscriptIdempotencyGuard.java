package com.habitbuilder.NutritionTracker.modules.voice.idempotency;

/**
 * Guards against logging the same voice transcript twice — the client retries a slow parse,
 * and Vapi itself retries a webhook, so the same transcript arrives more than once.
 *
 * <p>An interface rather than a concrete map because the shipped implementation is
 * per-process: see {@link InMemoryTranscriptIdempotencyGuard}. Making the boundary explicit
 * is what lets a shared-store implementation drop in when a second instance runs.
 */
public interface TranscriptIdempotencyGuard {

    /**
     * Claims {@code key} for the caller. Returns {@code false} when an identical transcript
     * was already claimed inside the dedup window, meaning the caller should skip the work.
     */
    boolean tryClaim(String key);

    /**
     * Drops a claim so a failed attempt can be retried immediately rather than waiting out
     * the window.
     */
    void release(String key);
}
