package com.habitbuilder.NutritionTracker.modules.notification.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;
import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;
import com.habitbuilder.NutritionTracker.modules.notification.repository.IosVoipDeviceTokenRepository;

@ExtendWith(MockitoExtension.class)
class IosVoipTokenServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-24T03:30:45Z");
    private static final String TOKEN = "aa".repeat(32);
    private static final String TOKEN_HASH = IosVoipTokenService.tokenHash(TOKEN);

    @Mock
    private IosVoipDeviceTokenRepository repository;

    @Mock
    private CurrentUserProvider currentUserProvider;

    @Mock
    private ApnsVoipSender sender;

    private IosVoipTokenService service;

    @BeforeEach
    void setUp() {
        service = new IosVoipTokenService(
                repository,
                currentUserProvider,
                properties(),
                sender,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void refusesToRegisterWhenTheProviderCannotActuallySend() {
        when(sender.isAvailable()).thenReturn(false);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.register(TOKEN));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
        verify(repository, never()).save(any());
    }

    @Test
    void normalizesAndStoresTheTokenForTheCurrentUserAndEnvironment() {
        when(sender.isAvailable()).thenReturn(true);
        when(currentUserProvider.currentUserId()).thenReturn("user-1");
        when(repository.findByEnvironmentAndTokenHash("production", TOKEN_HASH))
                .thenReturn(Optional.empty());

        service.register(" <" + "AA ".repeat(32) + "> ");

        ArgumentCaptor<IosVoipDeviceToken> saved =
                ArgumentCaptor.forClass(IosVoipDeviceToken.class);
        verify(repository).save(saved.capture());
        assertEquals("user-1", saved.getValue().getUserId());
        assertEquals(TOKEN, saved.getValue().getToken());
        assertEquals(TOKEN_HASH, saved.getValue().getTokenHash());
        assertEquals("production", saved.getValue().getEnvironment());
        assertEquals(NOW, saved.getValue().getCreatedAt());
        assertEquals(NOW, saved.getValue().getUpdatedAt());
        assertTrue(saved.getValue().isEnabled());
    }

    @Test
    void reRegistrationTransfersTheInstallationToTheCurrentAccount() {
        IosVoipDeviceToken existing = new IosVoipDeviceToken();
        existing.setId("device-1");
        existing.setUserId("old-user");
        existing.setToken(TOKEN);
        existing.setEnvironment("production");
        existing.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));

        when(sender.isAvailable()).thenReturn(true);
        when(currentUserProvider.currentUserId()).thenReturn("new-user");
        when(repository.findByEnvironmentAndTokenHash("production", TOKEN_HASH))
                .thenReturn(Optional.of(existing));

        service.register(TOKEN);

        verify(repository).save(existing);
        assertEquals("new-user", existing.getUserId());
        assertEquals(Instant.parse("2026-01-01T00:00:00Z"), existing.getCreatedAt());
        assertEquals(NOW, existing.getUpdatedAt());
    }

    @Test
    void deletionRemainsAvailableWhenDeliveryIsDisabled() {
        when(currentUserProvider.currentUserId()).thenReturn("user-1");

        service.deleteForCurrentUser(TOKEN.toUpperCase());

        verify(repository).deleteByUserIdAndEnvironmentAndTokenHash(
                "user-1",
                "production",
                TOKEN_HASH);
    }

    @Test
    void rejectsMalformedTokensBeforePersistingThem() {
        when(sender.isAvailable()).thenReturn(true);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.register("not-a-pushkit-token"));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(repository, never()).save(any());
    }

    private static ApnsVoipProperties properties() {
        return new ApnsVoipProperties(
                true,
                "team-id",
                "key-id",
                "private-key",
                "com.example.app",
                "production",
                10_000,
                10_000,
                120,
                30,
                3);
    }
}
