package com.habitbuilder.NutritionTracker.modules.habit;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.service.UserTimeZone;
import com.habitbuilder.NutritionTracker.security.AuthenticatedUserProvider;

@Service
public class HabitService {

    private static final Logger log = LoggerFactory.getLogger(HabitService.class);

    private HabitRepository habitRepository;
    private HabitEntityRepository habitEntityRepository;
    private final AuthenticatedUserProvider authenticatedUserProvider;
    private final UserTimeZone userTimeZone;

    HabitService(HabitRepository habitRepository, HabitEntityRepository habitEntityRepository,
            AuthenticatedUserProvider authenticatedUserProvider, UserTimeZone userTimeZone) {
        this.habitRepository = habitRepository;
        this.habitEntityRepository = habitEntityRepository;
        this.authenticatedUserProvider = authenticatedUserProvider;
        this.userTimeZone = userTimeZone;
    }

    public Habit addHabit(HabitDTO habitDto) {
        User currentUser = getCurrentUser();

        Habit newHabit = new Habit();
        newHabit.setName(habitDto.getName());
        newHabit.setRepeatDays(habitDto.getRepeatDays());
        newHabit.setReminderTime(parseReminderTime(habitDto.getReminderTime()));
        newHabit.setReminderType(habitDto.getReminderType());
        newHabit.setUser(currentUser);

        return habitRepository.save(newHabit);
    }

    private LocalTime parseReminderTime(String rawReminderTime) {
        if (rawReminderTime == null || rawReminderTime.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reminderTime is required");
        }

        String value = rawReminderTime.trim();
        DateTimeFormatter[] acceptedFormats = new DateTimeFormatter[] {
                DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH),
                DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH),
                DateTimeFormatter.ofPattern("HH:mm"),
                DateTimeFormatter.ISO_LOCAL_TIME
        };

        for (DateTimeFormatter formatter : acceptedFormats) {
            try {
                return LocalTime.parse(value, formatter);
            } catch (DateTimeParseException ignored) {
                // Try the next accepted format.
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid reminderTime format. Use hh:mm AM/PM or HH:mm");
    }

    private User getCurrentUser() {
        return authenticatedUserProvider.getAuthenticatedUser();
    }

    public List<HabitWithCompletionDTO> getPresentDayHabits() {
        User currentUser = getCurrentUser();
        return getHabitsByDate(currentUser, userTimeZone.today(currentUser));
    }

    public List<HabitWithCompletionDTO> getHabitsByDate(LocalDate date) {
        User currentUser = getCurrentUser();
        return getHabitsByDate(currentUser, date);
    }

    public List<Habit> getAllHabits() {
        User currentUser = getCurrentUser();
        return habitRepository.findByUser_IdOrderByIdAsc(currentUser.getId());
    }

    private List<HabitWithCompletionDTO> getHabitsByDate(User currentUser, LocalDate date) {
        String dayOfWeek = date.getDayOfWeek().toString().substring(0, 3).toUpperCase();

        log.debug("Fetching habits: userId={}, date={}, dayOfWeek={}",
                currentUser.getId(), date, dayOfWeek);

        List<Habit> habits = habitRepository.findByUserAndRepeatDaysContaining(currentUser.getId(), dayOfWeek);

        return habits.stream()
                .map(habit -> {
                    HabitWithCompletionDTO dto = new HabitWithCompletionDTO();
                    dto.setId(habit.getId());
                    dto.setName(habit.getName());
                    dto.setRepeatDays(habit.getRepeatDays());
                    dto.setReminderTime(habit.getReminderTime());
                    dto.setReminderType(habit.getReminderType());

                    // Check habit status on the specified date
                    habitEntityRepository
                            .findByHabitIdAndUserIdAndEntryDate(
                                    habit.getId().toString(),
                                    currentUser.getId().toString(),
                                    date)
                            .ifPresentOrElse(entity -> {
                                dto.setCompleted(entity.getStatus() == HabitStatus.COMPLETED);
                                dto.setStatus(entity.getStatus().name());
                                dto.setCompletedAt(entity.getCompletionTime());
                                dto.setRescheduledTime(entity.getRescheduledTime());
                            }, () -> {
                                dto.setCompleted(false);
                                dto.setStatus("PENDING");
                            });

                    return dto;
                })
                .toList();
    }

    public void toggleHabit(HabitCompletionDTO habitCompletion) {
        User currentUser = getCurrentUser();
        LocalDate today = userTimeZone.today(currentUser);

        Long habitId = habitCompletion.getId();
        if (habitId == null) {
            throw new IllegalArgumentException("Habit ID is required");
        }

        // Get the habit by ID and verify it belongs to the user
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new IllegalArgumentException("Habit not found"));

        if (!habit.getUser().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Habit does not belong to user");
        }

        // Create or update habit entity for today
        HabitEntity habitEntity = habitEntityRepository
                .findByHabitIdAndUserIdAndEntryDate(
                        habit.getId().toString(),
                        currentUser.getId().toString(),
                        today)
                .orElseGet(() -> {
                    HabitEntity newEntity = new HabitEntity();
                    newEntity.setHabitId(habit.getId().toString());
                    newEntity.setUserId(currentUser.getId().toString());
                    newEntity.setEntryDate(today);
                    return newEntity;
                });

        // check current status and toggle
        if (habitEntity.getStatus() == HabitStatus.COMPLETED) {
            habitEntity.setStatus(HabitStatus.PENDING);
            habitEntity.setCompletionTime(null);
        } else {
            habitEntity.setStatus(HabitStatus.COMPLETED);
            habitEntity.setCompletionTime(userTimeZone.localTime(currentUser).toString());
        }
        habitEntityRepository.save(habitEntity);
    }

    public void deleteHabit(Long id) {
        User currentUser = getCurrentUser();

        // Get the habit by ID and verify it belongs to the user
        Habit habit = habitRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Habit not found"));

        if (!habit.getUser().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Habit does not belong to user");
        }

        habitRepository.delete(habit);
    }

    public HabitWithCompletionDTO processVoiceResult(HabitVoiceResultDTO result) {
        User currentUser = getCurrentUser();
        LocalDate today = userTimeZone.today(currentUser);

        log.info("Received habit voice result: userId={}, habitId={}, status={}, rescheduleMinutes={}",
                currentUser.getId(), result.getHabitId(), result.getHabitStatus(), result.getRescheduleMinutes());

        Long habitId = result.getHabitId();
        if (habitId == null) {
            throw new IllegalArgumentException("Habit ID is required");
        }

        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new IllegalArgumentException("Habit not found"));

        if (!habit.getUser().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Habit does not belong to user");
        }

        HabitEntity habitEntity = habitEntityRepository
                .findByHabitIdAndUserIdAndEntryDate(
                        habit.getId().toString(),
                        currentUser.getId().toString(),
                        today)
                .orElseGet(() -> {
                    HabitEntity newEntity = new HabitEntity();
                    newEntity.setHabitId(habit.getId().toString());
                    newEntity.setUserId(currentUser.getId().toString());
                    newEntity.setEntryDate(today);
                    return newEntity;
                });

        String status = result.getHabitStatus();
        if ("completed".equals(status)) {
            habitEntity.setStatus(HabitStatus.COMPLETED);
            habitEntity.setCompletionTime(result.getCompletedAt() != null
                    ? result.getCompletedAt()
                    : userTimeZone.localTime(currentUser).toString());
            habitEntity.setRescheduledTime(null);
        } else if ("rescheduled".equals(status)) {
            habitEntity.setStatus(HabitStatus.RESCHEDULED);
            if (result.getRescheduleMinutes() != null) {
                habitEntity.setRescheduledTime(
                        userTimeZone.localDateTime(currentUser).plusMinutes(result.getRescheduleMinutes()));
            }
        } else {
            habitEntity.setStatus(HabitStatus.MISSED);
        }

        habitEntityRepository.save(habitEntity);

        log.info("Saved habit voice result: userId={}, habitId={}, storedStatus={}, rescheduledTime={}",
                currentUser.getId(), habit.getId(), habitEntity.getStatus(), habitEntity.getRescheduledTime());

        // Build response DTO
        HabitWithCompletionDTO dto = new HabitWithCompletionDTO();
        dto.setId(habit.getId());
        dto.setName(habit.getName());
        dto.setRepeatDays(habit.getRepeatDays());
        dto.setReminderTime(habit.getReminderTime());
        dto.setReminderType(habit.getReminderType());
        dto.setCompleted(habitEntity.getStatus() == HabitStatus.COMPLETED);
        dto.setStatus(habitEntity.getStatus().name());
        dto.setCompletedAt(habitEntity.getCompletionTime());
        dto.setRescheduledTime(habitEntity.getRescheduledTime());

        return dto;
    }
}
