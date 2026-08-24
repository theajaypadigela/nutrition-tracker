package com.habitbuilder.NutritionTracker.modules.habit.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.modules.habit.entity.Habit;
import com.habitbuilder.NutritionTracker.modules.habit.repository.HabitEntityRepository;
import com.habitbuilder.NutritionTracker.modules.habit.repository.HabitRepository;
import com.habitbuilder.NutritionTracker.modules.notification.service.HabitVoipCallDispatcher;

@ExtendWith(MockitoExtension.class)
class HabitReminderSchedulerTest {

    private static final Instant NOW = Instant.parse("2026-08-24T03:30:45Z");
    private static final Instant FIRE_AT = Instant.parse("2026-08-24T03:30:00Z");

    @Mock
    private HabitRepository habitRepository;

    @Mock
    private HabitEntityRepository habitEntityRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private HabitVoipCallDispatcher dispatcher;

    private HabitReminderScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new HabitReminderScheduler(
                habitRepository,
                habitEntityRepository,
                userRepository,
                dispatcher,
                properties(),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void groupsSameTimeHabitsIntoOneTimezoneAwareCallSlot() {
        User user = user("user-1", "Asia/Kolkata");
        Habit walk = habit("habit-1", "user-1", LocalTime.of(9, 0), List.of("Mon"));
        Habit hydrate = habit("habit-2", "user-1", LocalTime.of(9, 0), List.of("Monday"));

        when(dispatcher.isAvailable()).thenReturn(true);
        when(habitRepository.findByReminderTypeIgnoreCase("call"))
                .thenReturn(List.of(walk, hydrate));
        when(userRepository.findAllById(any())).thenReturn(List.of(user));

        scheduler.checkHabitReminders();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Habit>> habits = ArgumentCaptor.forClass(List.class);
        verify(dispatcher).dispatchSlot(habits.capture(), eq(user), eq(FIRE_AT));
        assertEquals(2, habits.getValue().size());
        assertTrue(habits.getValue().containsAll(List.of(walk, hydrate)));
    }

    @Test
    void excludesHabitsThatAlreadyHaveAnEntryForTheLocalOccurrenceDate() {
        User user = user("user-1", "Asia/Kolkata");
        Habit habit = habit("habit-1", "user-1", LocalTime.of(9, 0), List.of("Mon"));

        when(dispatcher.isAvailable()).thenReturn(true);
        when(habitRepository.findByReminderTypeIgnoreCase("call")).thenReturn(List.of(habit));
        when(userRepository.findAllById(any())).thenReturn(List.of(user));
        when(habitEntityRepository.existsByHabitIdAndUserIdAndEntryDate(
                "habit-1",
                "user-1",
                LocalDate.of(2026, 8, 24))).thenReturn(true);

        scheduler.checkHabitReminders();

        verify(dispatcher, never()).dispatchSlot(any(), any(), any());
    }

    @Test
    void recognizesYesterdayJustAfterLocalMidnight() {
        Habit habit = habit(
                "habit-1",
                "user-1",
                LocalTime.of(23, 59),
                List.of("Sun"));
        Instant now = Instant.parse("2026-08-24T00:00:30Z");

        var occurrence = HabitReminderScheduler.findDueOccurrence(
                habit,
                ZoneOffset.UTC,
                now,
                Duration.ofSeconds(120));

        assertTrue(occurrence.isPresent());
        assertEquals(Instant.parse("2026-08-23T23:59:00Z"), occurrence.get().fireAt());
        assertEquals(LocalDate.of(2026, 8, 23), occurrence.get().localDate());
    }

    @Test
    void invalidOrMissingUserTimezonesFallBackToUtc() {
        assertEquals(ZoneOffset.UTC, HabitReminderScheduler.zoneFor(user("user-1", "bad zone")));
        assertEquals(ZoneOffset.UTC, HabitReminderScheduler.zoneFor(user("user-2", null)));
        assertEquals(ZoneId.of("America/New_York"),
                HabitReminderScheduler.zoneFor(user("user-3", "America/New_York")));
    }

    private static User user(String id, String timezone) {
        User user = new User();
        user.setId(id);
        user.setTimezone(timezone);
        return user;
    }

    private static Habit habit(
            String id,
            String userId,
            LocalTime reminderTime,
            List<String> repeatDays) {
        Habit habit = new Habit();
        habit.setId(id);
        habit.setUserId(userId);
        habit.setReminderTime(reminderTime);
        habit.setRepeatDays(repeatDays);
        habit.setReminderType("call");
        return habit;
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
