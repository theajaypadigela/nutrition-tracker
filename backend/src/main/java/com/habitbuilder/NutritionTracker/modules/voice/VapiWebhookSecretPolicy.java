package com.habitbuilder.NutritionTracker.modules.voice;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Authenticates the public Vapi webhook without short-circuit string comparison.
 */
public final class VapiWebhookSecretPolicy {

    private final String configuredSecret;

    public VapiWebhookSecretPolicy(String configuredSecret) {
        this.configuredSecret = configuredSecret;
    }

    public boolean accepts(String providedSecret) {
        if (!isConfigured() || providedSecret == null) {
            return false;
        }
        return MessageDigest.isEqual(
                sha256(configuredSecret),
                sha256(providedSecret));
    }

    public boolean isConfigured() {
        return configuredSecret != null && !configuredSecret.isBlank();
    }

    private byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
