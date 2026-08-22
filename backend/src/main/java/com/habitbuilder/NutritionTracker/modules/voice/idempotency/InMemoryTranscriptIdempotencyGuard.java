package com.habitbuilder.NutritionTracker.modules.voice.idempotency;

import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * Per-process dedup window backed by a {@link ConcurrentHashMap}.
 *
 * <p><b>Single-instance only.</b> Claims live in this JVM's heap, so the moment a second
 * instance runs, two nodes can each accept the same transcript. That was already true when
 * this map lived inside VoiceLogService; it is stated here so the limitation is a documented
 * property of a named implementation rather than an invisible assumption, and so replacing
 * it means writing one class instead of picking apart a service.
 */
@Component
public class InMemoryTranscriptIdempotencyGuard implements TranscriptIdempotencyGuard {

    static final long WINDOW_MILLIS = 120_000;

    private final ConcurrentHashMap<String, Long> claims = new ConcurrentHashMap<>();

    @Override
    public boolean tryClaim(String key) {
        long now = System.currentTimeMillis();
        evictExpired(now);

        Long previous = claims.putIfAbsent(key, now);
        if (previous == null) {
            return true;
        }
        if (now - previous < WINDOW_MILLIS) {
            return false;
        }

        // Unreachable in practice — eviction above already dropped anything this old — but
        // kept so the claim is refreshed rather than left stale if that ever changes.
        claims.put(key, now);
        return true;
    }

    @Override
    public void release(String key) {
        claims.remove(key);
    }

    private void evictExpired(long nowMillis) {
        claims.entrySet().removeIf(entry -> nowMillis - entry.getValue() >= WINDOW_MILLIS);
    }
}
