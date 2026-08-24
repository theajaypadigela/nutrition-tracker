package com.habitbuilder.NutritionTracker.modules.notification.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.habit.entity.Habit;
import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;

@Service
public class HabitVoipCallDispatcher {

    private static final Logger log = LoggerFactory.getLogger(HabitVoipCallDispatcher.class);
    private static final DateTimeFormatter DISPLAY_TIME =
            DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);
    private static final DateTimeFormatter SLOT_TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final IosVoipTokenService tokenService;
    private final ApnsVoipSender sender;
    private final VoipDispatchLedgerService ledger;

    public HabitVoipCallDispatcher(
            IosVoipTokenService tokenService,
            ApnsVoipSender sender,
            VoipDispatchLedgerService ledger) {
        this.tokenService = tokenService;
        this.sender = sender;
        this.ledger = ledger;
    }

    public boolean isAvailable() {
        return tokenService.isDeliveryAvailable();
    }

    /** Sends one consolidated call for every pending call-habit sharing this user's time slot. */
    public void dispatchSlot(List<Habit> habits, User user, Instant intendedFireAt) {
        if (!isAvailable()
                || habits == null
                || habits.isEmpty()
                || user == null
                || intendedFireAt == null) {
            return;
        }

        List<Habit> ordered = habits.stream()
                .filter(habit -> habit != null && habit.getReminderTime() != null)
                .sorted(Comparator.comparing(Habit::getId, Comparator.nullsLast(String::compareTo)))
                .toList();
        if (ordered.isEmpty()) {
            return;
        }
        Habit sample = ordered.get(0);
        String slotKey = sample.getReminderTime().format(SLOT_TIME);
        String occurrenceKey = occurrenceKey(user.getId(), slotKey, intendedFireAt);
        String callUuid = UUID.nameUUIDFromBytes(occurrenceKey.getBytes(StandardCharsets.UTF_8))
                .toString();
        VoipCallPayload payload = new VoipCallPayload(
                Map.of(),
                callUuid,
                "habit",
                "habit-call",
                null,
                slotDisplayName(ordered),
                sample.getReminderTime().format(DISPLAY_TIME),
                intendedFireAt.toEpochMilli(),
                slotKey);

        for (IosVoipDeviceToken deviceToken : tokenService.findActiveForUser(user.getId())) {
            var claim = ledger.tryClaim(
                    occurrenceKey,
                    deviceToken,
                    user.getId(),
                    null,
                    intendedFireAt);
            if (claim.isEmpty()) {
                continue;
            }

            ApnsDeliveryResult result = sender.send(deviceToken, payload);
            if (result.outcome() == ApnsDeliveryResult.Outcome.ACCEPTED) {
                ledger.recordAccepted(claim.get());
                log.info("Accepted iOS VoIP dispatch for habit occurrence {}", callUuid);
                continue;
            }

            ledger.recordFailure(claim.get(), result);
            if (result.outcome() == ApnsDeliveryResult.Outcome.INVALID_TOKEN) {
                tokenService.removeInvalidToken(deviceToken.getId());
            }
            log.warn("iOS VoIP dispatch failed for habit occurrence {} (outcome={}, status={})",
                    callUuid, result.outcome(), result.statusCode());
        }
    }

    static String occurrenceKey(String userId, String slotKey, Instant intendedFireAt) {
        return "habit-call-slot:" + userId + ":" + slotKey + ":" + intendedFireAt.toEpochMilli();
    }

    private static String slotDisplayName(List<Habit> habits) {
        String joined = habits.stream()
                .map(Habit::getName)
                .filter(name -> name != null && !name.isBlank())
                .map(String::trim)
                .distinct()
                .sorted()
                .reduce((left, right) -> left + ", " + right)
                .orElse("Habit check-in");
        if (joined.isBlank()) {
            return "Habit check-in";
        }
        return joined.length() <= 160 ? joined : joined.substring(0, 160);
    }
}
