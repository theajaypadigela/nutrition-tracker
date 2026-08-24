package com.habitbuilder.NutritionTracker.modules.notification.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;

class ApnsHttp2VoipSenderTest {

    @Test
    void incompleteOrInvalidCredentialsKeepTheProviderSafelyDisabled() {
        ApnsVoipProperties properties = new ApnsVoipProperties(
                true,
                "team-id",
                "key-id",
                "not-base64",
                "com.example.app",
                "production",
                10_000,
                10_000,
                120,
                30,
                3);

        ApnsHttp2VoipSender sender = new ApnsHttp2VoipSender(
                properties,
                new ObjectMapper(),
                Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));

        assertFalse(sender.isAvailable());
        assertEquals(ApnsDeliveryResult.Outcome.DISABLED, sender.send(null, null).outcome());
    }

    @Test
    void classifiesApnsResponsesForCleanupAndRetry() {
        assertEquals(
                ApnsDeliveryResult.Outcome.ACCEPTED,
                ApnsHttp2VoipSender.classify(200, "Unknown").outcome());
        assertEquals(
                ApnsDeliveryResult.Outcome.INVALID_TOKEN,
                ApnsHttp2VoipSender.classify(410, "Unregistered").outcome());
        assertEquals(
                ApnsDeliveryResult.Outcome.INVALID_TOKEN,
                ApnsHttp2VoipSender.classify(400, "BadDeviceToken").outcome());
        assertEquals(
                ApnsDeliveryResult.Outcome.INVALID_TOKEN,
                ApnsHttp2VoipSender.classify(400, "DeviceTokenNotForTopic").outcome());
        assertEquals(
                ApnsDeliveryResult.Outcome.RETRYABLE_FAILURE,
                ApnsHttp2VoipSender.classify(503, "Shutdown").outcome());
        assertEquals(
                ApnsDeliveryResult.Outcome.RETRYABLE_FAILURE,
                ApnsHttp2VoipSender.classify(429, "TooManyRequests").outcome());
        assertEquals(
                ApnsDeliveryResult.Outcome.TERMINAL_FAILURE,
                ApnsHttp2VoipSender.classify(403, "InvalidProviderToken").outcome());
    }

    @Test
    void acceptsAnOuterBase64EncodedAppleCompatiblePkcs8EcKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        String encodedKey = Base64.getEncoder().encodeToString(
                generator.generateKeyPair().getPrivate().getEncoded());
        ApnsVoipProperties properties = new ApnsVoipProperties(
                true,
                "team-id",
                "key-id",
                encodedKey,
                "com.example.app",
                "sandbox",
                10_000,
                10_000,
                120,
                30,
                3);

        ApnsHttp2VoipSender sender = new ApnsHttp2VoipSender(
                properties,
                new ObjectMapper(),
                Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));

        assertTrue(sender.isAvailable());
        assertFalse(properties.toString().contains(encodedKey));
        assertFalse(properties.toString().contains("key-id"));
    }

    @Test
    void rejectsAnEcKeyOnTheWrongCurveBeforeAcceptingRegistrations() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp384r1"));
        String encodedKey = Base64.getEncoder().encodeToString(
                generator.generateKeyPair().getPrivate().getEncoded());
        ApnsVoipProperties properties = new ApnsVoipProperties(
                true,
                "team-id",
                "key-id",
                encodedKey,
                "com.example.app",
                "production",
                10_000,
                10_000,
                120,
                30,
                3);

        ApnsHttp2VoipSender sender = new ApnsHttp2VoipSender(
                properties,
                new ObjectMapper(),
                Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));

        assertFalse(sender.isAvailable());
    }
}
