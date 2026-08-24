package com.habitbuilder.NutritionTracker.modules.notification.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;
import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

/** APNs provider client using Java 17 HTTP/2 and Apple's token-based ES256 authentication. */
@Component
public class ApnsHttp2VoipSender implements ApnsVoipSender {

    private static final Logger log = LoggerFactory.getLogger(ApnsHttp2VoipSender.class);
    private static final Duration PROVIDER_TOKEN_LIFETIME = Duration.ofMinutes(50);

    private final ApnsVoipProperties properties;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final HttpClient httpClient;
    private final PrivateKey privateKey;
    private final boolean available;

    private volatile String cachedProviderToken;
    private volatile Instant cachedProviderTokenCreatedAt;

    @Autowired
    public ApnsHttp2VoipSender(
            ApnsVoipProperties properties,
            ObjectMapper objectMapper,
            Clock clock) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.clock = clock;

        HttpClient configuredClient = null;
        PrivateKey configuredKey = null;
        boolean configured = false;

        if (!properties.enabled()) {
            log.info("APNs VoIP delivery is disabled");
        } else if (!properties.hasRequiredMetadata()) {
            log.warn("APNs VoIP delivery requested but required configuration is incomplete; delivery remains disabled");
        } else {
            try {
                configuredKey = decodePrivateKey(properties.privateKeyBase64());
                configuredClient = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofMillis(properties.effectiveConnectTimeoutMs()))
                        .version(HttpClient.Version.HTTP_2)
                        .build();
                configured = true;
                log.info("APNs VoIP delivery is enabled for the {} environment",
                        properties.normalizedEnvironment());
            } catch (Exception ignored) {
                // A private-key parse failure must not take down unrelated API functionality.
                // Never include the exception or configured value: parsers may echo key material.
                log.warn("APNs VoIP private key is invalid; delivery remains disabled");
            }
        }

        this.httpClient = configuredClient;
        this.privateKey = configuredKey;
        this.available = configured;
    }

    /** Test seam that avoids parsing or logging credential material. */
    ApnsHttp2VoipSender(
            ApnsVoipProperties properties,
            ObjectMapper objectMapper,
            Clock clock,
            HttpClient httpClient,
            PrivateKey privateKey) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.httpClient = httpClient;
        this.privateKey = privateKey;
        this.available = properties.hasRequiredMetadata() && httpClient != null && privateKey != null;
    }

    @Override
    public boolean isAvailable() {
        return available;
    }

    @Override
    public ApnsDeliveryResult send(IosVoipDeviceToken deviceToken, VoipCallPayload payload) {
        if (!available) {
            return ApnsDeliveryResult.disabled();
        }
        if (deviceToken == null || !isHexToken(deviceToken.getToken())) {
            return new ApnsDeliveryResult(
                    ApnsDeliveryResult.Outcome.INVALID_TOKEN,
                    0,
                    "InvalidDeviceToken");
        }

        try {
            byte[] body = objectMapper.writeValueAsBytes(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(properties.endpoint() + "/3/device/" + deviceToken.getToken()))
                    .timeout(Duration.ofMillis(properties.effectiveRequestTimeoutMs()))
                    .version(HttpClient.Version.HTTP_2)
                    .header("authorization", "bearer " + providerToken())
                    .header("apns-push-type", "voip")
                    .header("apns-topic", properties.topic())
                    .header("apns-priority", "10")
                    .header("apns-expiration", "0")
                    .header("apns-id", payload.callUUID())
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            String reason = responseReason(response.body());
            return classify(response.statusCode(), reason);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new ApnsDeliveryResult(
                    ApnsDeliveryResult.Outcome.RETRYABLE_FAILURE,
                    0,
                    "Interrupted");
        } catch (Exception e) {
            // Network, serialization and signing failures are intentionally generic. The request
            // contains both a device token and user-authored habit fields.
            return new ApnsDeliveryResult(
                    ApnsDeliveryResult.Outcome.RETRYABLE_FAILURE,
                    0,
                    "ProviderRequestFailed");
        }
    }

    static ApnsDeliveryResult classify(int statusCode, String reason) {
        String safeReason = reason == null || reason.isBlank() ? "Unknown" : reason;
        if (statusCode == 200) {
            return ApnsDeliveryResult.accepted();
        }
        if (statusCode == 410
                || (statusCode == 400
                        && ("BadDeviceToken".equals(safeReason)
                                || "DeviceTokenNotForTopic".equals(safeReason)
                                || "Unregistered".equals(safeReason)))) {
            return new ApnsDeliveryResult(
                    ApnsDeliveryResult.Outcome.INVALID_TOKEN,
                    statusCode,
                    safeReason);
        }
        if (statusCode == 429 || statusCode >= 500 || statusCode == 0) {
            return new ApnsDeliveryResult(
                    ApnsDeliveryResult.Outcome.RETRYABLE_FAILURE,
                    statusCode,
                    safeReason);
        }
        return new ApnsDeliveryResult(
                ApnsDeliveryResult.Outcome.TERMINAL_FAILURE,
                statusCode,
                safeReason);
    }

    private synchronized String providerToken() {
        Instant now = clock.instant();
        if (cachedProviderToken != null
                && cachedProviderTokenCreatedAt != null
                && now.isBefore(cachedProviderTokenCreatedAt.plus(PROVIDER_TOKEN_LIFETIME))) {
            return cachedProviderToken;
        }

        cachedProviderToken = Jwts.builder()
                .setHeaderParam("kid", properties.keyId().trim())
                .setIssuer(properties.teamId().trim())
                .setIssuedAt(Date.from(now))
                .signWith(privateKey, SignatureAlgorithm.ES256)
                .compact();
        cachedProviderTokenCreatedAt = now;
        return cachedProviderToken;
    }

    private String responseReason(String body) {
        if (body == null || body.isBlank()) {
            return "Unknown";
        }
        try {
            JsonNode root = objectMapper.readTree(body);
            return root.path("reason").asText("Unknown");
        } catch (Exception ignored) {
            return "Unknown";
        }
    }

    private static PrivateKey decodePrivateKey(String encodedPem) throws Exception {
        byte[] decoded = Base64.getMimeDecoder().decode(encodedPem.trim());
        String possiblePem = new String(decoded, StandardCharsets.US_ASCII);
        byte[] der = decoded;
        if (possiblePem.contains("BEGIN PRIVATE KEY")) {
            String pemBody = possiblePem
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");
            der = Base64.getDecoder().decode(pemBody);
        }
        PrivateKey privateKey = KeyFactory.getInstance("EC")
                .generatePrivate(new PKCS8EncodedKeySpec(der));
        if (!(privateKey instanceof ECPrivateKey ecPrivateKey)
                || ecPrivateKey.getParams() == null
                || ecPrivateKey.getParams().getOrder().bitLength() != 256) {
            throw new InvalidKeySpecException("APNs provider keys must use the P-256 curve");
        }
        return privateKey;
    }

    private static boolean isHexToken(String token) {
        return token != null
                && token.length() >= 32
                && token.length() <= 512
                && token.length() % 2 == 0
                && token.matches("[0-9a-fA-F]+");
    }
}
