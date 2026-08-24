package com.habitbuilder.NutritionTracker.config.properties;

import java.util.Locale;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Apple Push Notification service settings for iOS PushKit call invitations
 * ({@code apns.voip.*}). Delivery is deliberately opt-in: an installation with no Apple
 * credentials starts normally and rejects token registration instead of claiming that remote
 * calls are available.
 */
@ConfigurationProperties("apns.voip")
public record ApnsVoipProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("") String teamId,
        @DefaultValue("") String keyId,
        @DefaultValue("") String privateKeyBase64,
        @DefaultValue("") String bundleId,
        @DefaultValue("production") String environment,
        @DefaultValue("10000") int connectTimeoutMs,
        @DefaultValue("10000") int requestTimeoutMs,
        @DefaultValue("120") long dueWindowSeconds,
        @DefaultValue("30") long retryBackoffSeconds,
        @DefaultValue("3") int maxAttempts) {

    public String normalizedEnvironment() {
        return environment == null ? "" : environment.trim().toLowerCase(Locale.ROOT);
    }

    public boolean hasRequiredMetadata() {
        String normalizedEnvironment = normalizedEnvironment();
        return enabled
                && isPresent(teamId)
                && isPresent(keyId)
                && isPresent(privateKeyBase64)
                && isPresent(bundleId)
                && ("production".equals(normalizedEnvironment)
                        || "sandbox".equals(normalizedEnvironment));
    }

    public String endpoint() {
        return "sandbox".equals(normalizedEnvironment())
                ? "https://api.sandbox.push.apple.com"
                : "https://api.push.apple.com";
    }

    public String topic() {
        return bundleId.trim() + ".voip";
    }

    public int effectiveConnectTimeoutMs() {
        return Math.max(1_000, connectTimeoutMs);
    }

    public int effectiveRequestTimeoutMs() {
        return Math.max(1_000, requestTimeoutMs);
    }

    public long effectiveDueWindowSeconds() {
        return Math.max(60, Math.min(dueWindowSeconds, 300));
    }

    public long effectiveRetryBackoffSeconds() {
        return Math.max(1, retryBackoffSeconds);
    }

    public int effectiveMaxAttempts() {
        return Math.max(1, Math.min(maxAttempts, 10));
    }

    /** Keep the signing key out of diagnostic property dumps. */
    @Override
    public String toString() {
        return "ApnsVoipProperties[enabled=" + enabled
                + ", teamId=" + teamId
                + ", keyId=***"
                + ", privateKeyBase64=***"
                + ", bundleId=" + bundleId
                + ", environment=" + environment
                + ", connectTimeoutMs=" + connectTimeoutMs
                + ", requestTimeoutMs=" + requestTimeoutMs
                + ", dueWindowSeconds=" + dueWindowSeconds
                + ", retryBackoffSeconds=" + retryBackoffSeconds
                + ", maxAttempts=" + maxAttempts + "]";
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
