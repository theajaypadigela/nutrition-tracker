package com.habitbuilder.NutritionTracker.modules.habit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.service.UserTimeZone;
import com.habitbuilder.NutritionTracker.security.AuthenticatedUserProvider;

@ExtendWith(MockitoExtension.class)
class HabitServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-19T23:30:00Z");
    private static final ZoneId USER_ZONE = ZoneId.of("Asia/Kolkata");

    @Mock
    private HabitRepository habitRepository;
    @Mock
    private HabitEntityRepository habitEntityRepository;
    @Mock
    private AuthenticatedUserProvider authenticatedUserProvider;

    private HabitService habitService;
    private User currentUser;

    @BeforeEach
    void setUp() {
        currentUser = new User();
        currentUser.setId(41L);
        currentUser.setTimezone(USER_ZONE.getId());
        when(authenticatedUserProvider.getAuthenticatedUser()).thenReturn(currentUser);
        UserTimeZone userTimeZone = new UserTimeZone(Clock.fixed(NOW, java.time.ZoneOffset.UTC));
        habitService = new HabitService(
                habitRepository,
                habitEntityRepository,
                authenticatedUserProvider,
                userTimeZone);
    }

    @Test
    void presentDayHabitsUseDateAndZoneFromInjectedClock() {
        when(habitRepository.findByUserAndRepeatDaysContaining(41L, "THU"))
                .thenReturn(List.of());

        assertThat(habitService.getPresentDayHabits()).isEmpty();

        verify(habitRepository).findByUserAndRepeatDaysContaining(41L, "THU");
    }

    @Test
    void allHabitsQueryIsScopedToTheAuthenticatedUser() {
        Habit habit = habitOwnedByCurrentUser(7L);
        when(habitRepository.findByUser_IdOrderByIdAsc(41L)).thenReturn(List.of(habit));

        assertThat(habitService.getAllHabits()).containsExactly(habit);

        verify(habitRepository).findByUser_IdOrderByIdAsc(41L);
    }

    @Test
    void togglingHabitUsesDateAndCompletionTimeFromInjectedClock() {
        Habit habit = habitOwnedByCurrentUser(7L);
        when(habitRepository.findById(7L)).thenReturn(Optional.of(habit));
        when(habitEntityRepository.findByHabitIdAndUserIdAndEntryDate(
                "7", "41", LocalDate.of(2026, 8, 20)))
                .thenReturn(Optional.empty());
        HabitCompletionDTO completion = new HabitCompletionDTO();
        completion.setId(7L);

        habitService.toggleHabit(completion);

        ArgumentCaptor<HabitEntity> savedEntity = ArgumentCaptor.forClass(HabitEntity.class);
        verify(habitEntityRepository).save(savedEntity.capture());
        assertThat(savedEntity.getValue()).satisfies(entity -> {
            assertThat(entity.getEntryDate()).isEqualTo(LocalDate.of(2026, 8, 20));
            assertThat(entity.getCompletionTime()).isEqualTo("05:00");
            assertThat(entity.getStatus()).isEqualTo(HabitStatus.COMPLETED);
        });
    }

    @Test
    void voiceRescheduleUsesDateTimeFromInjectedClock() {
        Habit habit = habitOwnedByCurrentUser(7L);
        when(habitRepository.findById(7L)).thenReturn(Optional.of(habit));
        when(habitEntityRepository.findByHabitIdAndUserIdAndEntryDate(
                "7", "41", LocalDate.of(2026, 8, 20)))
                .thenReturn(Optional.empty());
        HabitVoiceResultDTO result = new HabitVoiceResultDTO();
        result.setHabitId(7L);
        result.setHabitStatus("rescheduled");
        result.setRescheduleMinutes(15);

        HabitWithCompletionDTO response = habitService.processVoiceResult(result);

        assertThat(response.getStatus()).isEqualTo("RESCHEDULED");
        assertThat(response.getRescheduledTime())
                .isEqualTo(LocalDateTime.of(2026, 8, 20, 5, 15));
    }

    private Habit habitOwnedByCurrentUser(Long id) {
        Habit habit = new Habit();
        habit.setId(id);
        habit.setName("Drink water");
        habit.setRepeatDays(new String[] { "THU" });
        habit.setReminderType("notification");
        habit.setUser(currentUser);
        return habit;
    }
}
