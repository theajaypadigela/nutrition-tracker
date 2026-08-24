package com.habitbuilder.NutritionTracker.modules.notification.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.habit.entity.Habit;
import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;

@ExtendWith(MockitoExtension.class)
class HabitVoipCallDispatcherTest {

    private static final Instant FIRE_AT = Instant.parse("2026-08-24T03:30:00Z");

    @Mock
    private IosVoipTokenService tokenService;

    @Mock
    private ApnsVoipSender sender;

    @Mock
    private VoipDispatchLedgerService ledger;

    private HabitVoipCallDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new HabitVoipCallDispatcher(tokenService, sender, ledger);
    }

    @Test
    void sendsOneSlotBasedPayloadForAllHabitsAtTheSameTime() {
        User user = user("user-1");
        Habit walk = habit("habit-b", "Walk", LocalTime.of(9, 0));
        Habit hydrate = habit("habit-a", "Hydrate", LocalTime.of(9, 0));
        IosVoipDeviceToken token = token("device-1", "aa".repeat(32));
        String occurrenceKey = HabitVoipCallDispatcher.occurrenceKey(
                "user-1",
                "09:00",
                FIRE_AT);
        VoipDispatchLedgerService.Claim claim =
                new VoipDispatchLedgerService.Claim("dispatch-1", 1);

        when(tokenService.isDeliveryAvailable()).thenReturn(true);
        when(tokenService.findActiveForUser("user-1")).thenReturn(List.of(token));
        when(ledger.tryClaim(occurrenceKey, token, "user-1", null, FIRE_AT))
                .thenReturn(Optional.of(claim));
        when(sender.send(eq(token), any())).thenReturn(ApnsDeliveryResult.accepted());

        dispatcher.dispatchSlot(List.of(walk, hydrate), user, FIRE_AT);

        ArgumentCaptor<VoipCallPayload> payload = ArgumentCaptor.forClass(VoipCallPayload.class);
        verify(sender).send(eq(token), payload.capture());
        assertEquals("habit", payload.getValue().type());
        assertEquals("habit-call", payload.getValue().kind());
        assertNull(payload.getValue().habitId());
        assertEquals("Hydrate, Walk", payload.getValue().habitName());
        assertEquals("09:00 AM", payload.getValue().habitTime());
        assertEquals("09:00", payload.getValue().slotKey());
        assertEquals(FIRE_AT.toEpochMilli(), payload.getValue().intendedFireAt());
        assertEquals(0, payload.getValue().aps().size());
        assertEquals(
                java.util.UUID.nameUUIDFromBytes(
                        occurrenceKey.getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString(),
                payload.getValue().callUUID());
        verify(ledger).recordAccepted(claim);
    }

    @Test
    void aPriorSlotClaimPreventsAnotherCall() {
        User user = user("user-1");
        Habit habit = habit("habit-1", "Walk", LocalTime.of(9, 0));
        IosVoipDeviceToken token = token("device-1", "aa".repeat(32));

        when(tokenService.isDeliveryAvailable()).thenReturn(true);
        when(tokenService.findActiveForUser("user-1")).thenReturn(List.of(token));
        when(ledger.tryClaim(any(), eq(token), eq("user-1"), eq(null), eq(FIRE_AT)))
                .thenReturn(Optional.empty());

        dispatcher.dispatchSlot(List.of(habit), user, FIRE_AT);

        verify(sender, never()).send(any(), any());
    }

    @Test
    void removesADeviceTokenWhenApnsDeclaresItInvalid() {
        User user = user("user-1");
        Habit habit = habit("habit-1", "Walk", LocalTime.of(9, 0));
        IosVoipDeviceToken token = token("device-1", "aa".repeat(32));
        VoipDispatchLedgerService.Claim claim =
                new VoipDispatchLedgerService.Claim("dispatch-1", 1);

        when(tokenService.isDeliveryAvailable()).thenReturn(true);
        when(tokenService.findActiveForUser("user-1")).thenReturn(List.of(token));
        when(ledger.tryClaim(any(), eq(token), eq("user-1"), eq(null), eq(FIRE_AT)))
                .thenReturn(Optional.of(claim));
        when(sender.send(eq(token), any())).thenReturn(new ApnsDeliveryResult(
                ApnsDeliveryResult.Outcome.INVALID_TOKEN,
                410,
                "Unregistered"));

        dispatcher.dispatchSlot(List.of(habit), user, FIRE_AT);

        verify(ledger).recordFailure(claim, new ApnsDeliveryResult(
                ApnsDeliveryResult.Outcome.INVALID_TOKEN,
                410,
                "Unregistered"));
        verify(tokenService).removeInvalidToken("device-1");
    }

    private static User user(String id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static Habit habit(String id, String name, LocalTime reminderTime) {
        Habit habit = new Habit();
        habit.setId(id);
        habit.setName(name);
        habit.setReminderTime(reminderTime);
        return habit;
    }

    private static IosVoipDeviceToken token(String id, String value) {
        IosVoipDeviceToken token = new IosVoipDeviceToken();
        token.setId(id);
        token.setToken(value);
        return token;
    }
}
