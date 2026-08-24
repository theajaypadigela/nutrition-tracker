package com.habitbuilder.NutritionTracker.modules.habit.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.modules.habit.entity.Habit;
import com.habitbuilder.NutritionTracker.modules.habit.repository.HabitEntityRepository;
import com.habitbuilder.NutritionTracker.modules.habit.repository.HabitRepository;
import com.habitbuilder.NutritionTracker.modules.notification.service.HabitVoipCallDispatcher;

@Component
public class HabitReminderScheduler {

    private final HabitRepository habitRepository;
    private final HabitEntityRepository habitEntityRepository;
    private final UserRepository userRepository;
    private final HabitVoipCallDispatcher dispatcher;
    private final ApnsVoipProperties properties;
    private final Clock clock;

    public HabitReminderScheduler(HabitRepository habitRepository,
            HabitEntityRepository habitEntityRepository,
            UserRepository userRepository,
            HabitVoipCallDispatcher dispatcher,
            ApnsVoipProperties properties,
            Clock clock) {
        this.habitRepository = habitRepository;
        this.habitEntityRepository = habitEntityRepository;
        this.userRepository = userRepository;
        this.dispatcher = dispatcher;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Polls wall-clock habit intent and sends a PushKit invitation for call-type habits that are
     * due in each user's own timezone. The short look-back tolerates scheduler jitter and one
     * transient APNs retry without ever issuing a stale call much later in the day.
     */
    @Scheduled(fixedRate = 60000, initialDelay = 60000)
    public void checkHabitReminders() {
        if (!dispatcher.isAvailable()) {
            return;
        }

        List<Habit> habits = habitRepository.findByReminderTypeIgnoreCase("call");
        if (habits == null || habits.isEmpty()) {
            return;
        }

        Map<String, User> users = usersById(habits);
        Instant now = clock.instant();
        Duration dueWindow = Duration.ofSeconds(properties.effectiveDueWindowSeconds());
        Map<SlotOccurrenceKey, List<Habit>> dueSlots = new HashMap<>();

        for (Habit habit : habits) {
            if (habit == null || habit.getUserId() == null || habit.getReminderTime() == null) {
                continue;
            }
            User user = users.get(habit.getUserId());
            if (user == null) {
                continue;
            }

            Optional<DueOccurrence> occurrence = findDueOccurrence(
                    habit,
                    zoneFor(user),
                    now,
                    dueWindow);
            if (occurrence.isEmpty()) {
                continue;
            }

            DueOccurrence due = occurrence.get();
            boolean terminalStateAlreadyExists =
                    habitEntityRepository.existsByHabitIdAndUserIdAndEntryDate(
                            habit.getId(), user.getId(), due.localDate());
            if (!terminalStateAlreadyExists) {
                String slotKey = habit.getReminderTime().toString();
                SlotOccurrenceKey key = new SlotOccurrenceKey(
                        user.getId(),
                        due.localDate(),
                        slotKey,
                        due.fireAt());
                dueSlots.computeIfAbsent(key, ignored -> new ArrayList<>()).add(habit);
            }
        }

        for (Map.Entry<SlotOccurrenceKey, List<Habit>> entry : dueSlots.entrySet()) {
            User user = users.get(entry.getKey().userId());
            dispatcher.dispatchSlot(entry.getValue(), user, entry.getKey().fireAt());
        }
    }

    private Map<String, User> usersById(List<Habit> habits) {
        List<String> userIds = habits.stream()
                .map(Habit::getUserId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        Map<String, User> users = new HashMap<>();
        userRepository.findAllById(userIds).forEach(user -> users.put(user.getId(), user));
        return users;
    }

    static Optional<DueOccurrence> findDueOccurrence(
            Habit habit,
            ZoneId zone,
            Instant now,
            Duration window) {
        if (habit == null || habit.getReminderTime() == null || window.isNegative() || window.isZero()) {
            return Optional.empty();
        }

        LocalDate localToday = now.atZone(zone).toLocalDate();
        Instant earliest = now.minus(window);
        DueOccurrence newest = null;

        // Yesterday matters when a 23:59 occurrence is polled just after local midnight.
        for (int daysAgo = 0; daysAgo <= 1; daysAgo++) {
            LocalDate occurrenceDate = localToday.minusDays(daysAgo);
            if (!repeatsOn(habit.getRepeatDays(), occurrenceDate)) {
                continue;
            }
            Instant fireAt = LocalDateTime.of(occurrenceDate, habit.getReminderTime())
                    .atZone(zone)
                    .toInstant();
            if (fireAt.isAfter(now) || fireAt.isBefore(earliest)) {
                continue;
            }
            if (newest == null || fireAt.isAfter(newest.fireAt())) {
                newest = new DueOccurrence(fireAt, occurrenceDate);
            }
        }
        return Optional.ofNullable(newest);
    }

    static ZoneId zoneFor(User user) {
        if (user != null && user.getTimezone() != null && !user.getTimezone().isBlank()) {
            try {
                return ZoneId.of(user.getTimezone().trim());
            } catch (Exception ignored) {
                // UTC is deterministic and prevents one corrupt profile from stopping the job.
            }
        }
        return ZoneOffset.UTC;
    }

    private static boolean repeatsOn(List<String> repeatDays, LocalDate date) {
        if (repeatDays == null || repeatDays.isEmpty()) {
            return false;
        }
        String expected = date.getDayOfWeek().name().substring(0, 3).toLowerCase(Locale.ROOT);
        return repeatDays.stream()
                .filter(day -> day != null)
                .map(String::trim)
                .filter(day -> day.length() >= 3)
                .map(day -> day.substring(0, 3).toLowerCase(Locale.ROOT))
                .anyMatch(expected::equals);
    }

    record DueOccurrence(Instant fireAt, LocalDate localDate) {
    }

    record SlotOccurrenceKey(String userId, LocalDate localDate, String slotKey, Instant fireAt) {
    }
}
