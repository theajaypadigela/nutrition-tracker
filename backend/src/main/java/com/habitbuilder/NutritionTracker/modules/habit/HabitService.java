package com.habitbuilder.NutritionTracker.modules.habit;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;

@Service
public class HabitService {

    private HabitRepository habitRepository;
    private HabitEntityRepository habitEntityRepository;

    HabitService(HabitRepository habitRepository, HabitEntityRepository habitEntityRepository) {
        this.habitRepository = habitRepository;
        this.habitEntityRepository = habitEntityRepository;
    }

    public Habit addHabit(HabitDTO habitDto) {
        User currentUser = getCurrentUser();

        Habit newHabit = new Habit();
        newHabit.setName(habitDto.getName());
        newHabit.setRepeatDays(habitDto.getRepeatDays());
        newHabit.setReminderTime(habitDto.getReminderTime());
        newHabit.setReminderType(habitDto.getReminderType());
        newHabit.setUser(currentUser);

        return habitRepository.save(newHabit);
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication.getPrincipal();
        if (principal instanceof User user) {
            return user;
        }

        throw new IllegalStateException("User not authenticated");
    }

    public List<HabitWithCompletionDTO> getPresentDayHabits() {
        User currentUser = getCurrentUser();
        LocalDate today = LocalDate.now();
        String dayOfWeek = today.getDayOfWeek().toString().substring(0, 3).toUpperCase();

        System.out.println("Fetching habits for user: " + currentUser.getId() + " on day: " + dayOfWeek);

        List<Habit> habits = habitRepository.findByUserAndRepeatDaysContaining(currentUser.getId(), dayOfWeek);

        return habits.stream()
                .map(habit -> {
                    HabitWithCompletionDTO dto = new HabitWithCompletionDTO();
                    dto.setId(habit.getId());
                    dto.setName(habit.getName());
                    dto.setRepeatDays(habit.getRepeatDays());
                    dto.setReminderTime(habit.getReminderTime());
                    dto.setReminderType(habit.getReminderType());

                    // Check if habit is completed today
                    boolean completed = habitEntityRepository
                            .findByHabitIdAndUserIdAndEntryDate(
                                    habit.getId().toString(),
                                    currentUser.getId().toString(),
                                    today)
                            .map(entity -> entity.getStatus() == HabitStatus.COMPLETED)
                            .orElse(false);

                    dto.setCompleted(completed);
                    return dto;
                })
                .toList();
    }

    public void toggleHabit(HabitCompletionDTO habitCompletion) {
        User currentUser = getCurrentUser();
        LocalDate today = LocalDate.now();

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
            habitEntity.setCompletionTime(java.time.LocalTime.now().toString());
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
}
