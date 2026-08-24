package com.habitbuilder.NutritionTracker.modules.notification.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;
import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;
import com.habitbuilder.NutritionTracker.modules.notification.entity.VoipCallDispatch;
import com.habitbuilder.NutritionTracker.modules.notification.repository.VoipCallDispatchRepository;

@ExtendWith(MockitoExtension.class)
class VoipDispatchLedgerServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-24T03:30:45Z");

    @Mock
    private VoipCallDispatchRepository repository;

    @Mock
    private MongoTemplate mongoTemplate;

    private VoipDispatchLedgerService service;

    @BeforeEach
    void setUp() {
        service = new VoipDispatchLedgerService(
                repository,
                mongoTemplate,
                properties(),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void firstInsertAtomicallyClaimsADeviceOccurrenceWithoutStoringItsTokenInTheKey() {
        IosVoipDeviceToken token = token("device-1", "aa".repeat(32));
        String occurrence = "habit-call-slot:user-1:09:00:1787542200000";

        var claim = service.tryClaim(
                occurrence,
                token,
                "user-1",
                null,
                Instant.parse("2026-08-24T03:30:00Z"));

        assertTrue(claim.isPresent());
        assertEquals(1, claim.get().attemptCount());
        assertEquals(64, claim.get().dispatchKey().length());
        assertFalse(claim.get().dispatchKey().contains(token.getToken()));

        ArgumentCaptor<VoipCallDispatch> inserted =
                ArgumentCaptor.forClass(VoipCallDispatch.class);
        verify(repository).insert(inserted.capture());
        assertEquals(occurrence, inserted.getValue().getOccurrenceKey());
        assertEquals("device-1", inserted.getValue().getDeviceTokenId());
        assertEquals(VoipCallDispatch.Status.CLAIMED, inserted.getValue().getStatus());
        assertEquals(NOW, inserted.getValue().getClaimedAt());
    }

    @Test
    void duplicateInsertRetriesOnlyWhenTheAtomicRetryQueryFindsAnEligibleFailure() {
        IosVoipDeviceToken token = token("device-1", "aa".repeat(32));
        when(repository.insert(any(VoipCallDispatch.class)))
                .thenThrow(new DuplicateKeyException("already claimed"));

        VoipCallDispatch retry = new VoipCallDispatch();
        retry.setAttemptCount(2);
        when(mongoTemplate.findAndModify(
                any(Query.class),
                any(Update.class),
                any(FindAndModifyOptions.class),
                eq(VoipCallDispatch.class))).thenReturn(retry);

        var claim = service.tryClaim(
                "habit-call-slot:user-1:09:00:1787542200000",
                token,
                "user-1",
                null,
                Instant.parse("2026-08-24T03:30:00Z"));

        assertTrue(claim.isPresent());
        assertEquals(2, claim.get().attemptCount());
        verify(mongoTemplate).findAndModify(
                any(Query.class),
                any(Update.class),
                any(FindAndModifyOptions.class),
                eq(VoipCallDispatch.class));
    }

    @Test
    void dispatchFingerprintIsDeterministicAndDeviceSpecific() {
        String occurrence = "habit-call-slot:user-1:09:00:1787542200000";

        String first = VoipDispatchLedgerService.dispatchKey(occurrence, "aa".repeat(32));
        String again = VoipDispatchLedgerService.dispatchKey(occurrence, "aa".repeat(32));
        String anotherDevice = VoipDispatchLedgerService.dispatchKey(occurrence, "bb".repeat(32));

        assertEquals(first, again);
        assertNotEquals(first, anotherDevice);
    }

    private static IosVoipDeviceToken token(String id, String value) {
        IosVoipDeviceToken token = new IosVoipDeviceToken();
        token.setId(id);
        token.setToken(value);
        return token;
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
