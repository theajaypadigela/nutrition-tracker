package com.habitbuilder.NutritionTracker.modules.notification.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;
import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;
import com.habitbuilder.NutritionTracker.modules.notification.repository.IosVoipDeviceTokenRepository;

@Service
public class IosVoipTokenService {

    private final IosVoipDeviceTokenRepository repository;
    private final CurrentUserProvider currentUserProvider;
    private final ApnsVoipProperties properties;
    private final ApnsVoipSender sender;
    private final Clock clock;

    public IosVoipTokenService(
            IosVoipDeviceTokenRepository repository,
            CurrentUserProvider currentUserProvider,
            ApnsVoipProperties properties,
            ApnsVoipSender sender,
            Clock clock) {
        this.repository = repository;
        this.currentUserProvider = currentUserProvider;
        this.properties = properties;
        this.sender = sender;
        this.clock = clock;
    }

    /**
     * Registers only when the APNs provider is usable. The iOS client uses a successful response
     * to suppress its local fallback, so accepting a token while disabled would lose calls.
     */
    public void register(String rawToken) {
        if (!sender.isAvailable()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "iOS VoIP delivery is unavailable");
        }

        String token = normalizeToken(rawToken);
        String tokenHash = tokenHash(token);
        String environment = properties.normalizedEnvironment();
        String userId = currentUserProvider.currentUserId();
        Instant now = clock.instant();

        IosVoipDeviceToken stored = repository.findByEnvironmentAndTokenHash(environment, tokenHash)
                .orElseGet(IosVoipDeviceToken::new);
        if (stored.getCreatedAt() == null) {
            stored.setCreatedAt(now);
        }
        // A PushKit token identifies one installation. Re-registration transfers ownership so a
        // signed-out account can never keep ringing after another account signs in on the device.
        stored.setUserId(userId);
        stored.setToken(token);
        stored.setTokenHash(tokenHash);
        stored.setEnvironment(environment);
        stored.setEnabled(true);
        stored.setUpdatedAt(now);

        try {
            repository.save(stored);
        } catch (DuplicateKeyException race) {
            IosVoipDeviceToken winner = repository.findByEnvironmentAndTokenHash(environment, tokenHash)
                    .orElseThrow(() -> race);
            winner.setUserId(userId);
            winner.setToken(token);
            winner.setTokenHash(tokenHash);
            winner.setEnabled(true);
            winner.setUpdatedAt(now);
            repository.save(winner);
        }
    }

    public void deleteForCurrentUser(String rawToken) {
        String token = normalizeToken(rawToken);
        repository.deleteByUserIdAndEnvironmentAndTokenHash(
                currentUserProvider.currentUserId(),
                properties.normalizedEnvironment(),
                tokenHash(token));
    }

    public boolean isDeliveryAvailable() {
        return sender.isAvailable();
    }

    public List<IosVoipDeviceToken> findActiveForUser(String userId) {
        if (!sender.isAvailable()) {
            return List.of();
        }
        return repository.findByUserIdAndEnvironmentAndEnabledTrue(
                userId,
                properties.normalizedEnvironment());
    }

    /** APNs has declared this installation token unusable. */
    public void removeInvalidToken(String id) {
        if (id != null && !id.isBlank()) {
            repository.deleteById(id);
        }
    }

    static String normalizeToken(String rawToken) {
        if (rawToken == null) {
            throw invalidToken();
        }
        String token = rawToken.trim()
                .replace("<", "")
                .replace(">", "")
                .replaceAll("\\s", "")
                .toLowerCase(Locale.ROOT);
        if (token.length() < 32
                || token.length() > 512
                || token.length() % 2 != 0
                || !token.matches("[0-9a-f]+")) {
            throw invalidToken();
        }
        return token;
    }

    static String tokenHash(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(hash);
        } catch (Exception impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static ResponseStatusException invalidToken() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid PushKit token");
    }
}
