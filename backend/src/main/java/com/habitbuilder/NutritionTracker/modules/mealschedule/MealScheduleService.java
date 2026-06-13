package com.habitbuilder.NutritionTracker.modules.mealschedule;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
public class MealScheduleService {

    private final MealScheduleRepository mealScheduleRepository;
    private final UserRepository userRepository;

    public MealScheduleService(MealScheduleRepository mealScheduleRepository,
            UserRepository userRepository) {
        this.mealScheduleRepository = mealScheduleRepository;
        this.userRepository = userRepository;
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication != null ? authentication.getPrincipal() : null;
        if (principal instanceof User user) {
            return user;
        }
        throw new IllegalStateException("User not authenticated");
    }

    public Optional<MealSchedule> getForCurrentUser() {
        return mealScheduleRepository.findByUserId(getCurrentUser().getId());
    }

    public MealSchedule upsertForCurrentUser(MealScheduleDTO dto) {
        User currentUser = getCurrentUser();

        MealSchedule schedule = mealScheduleRepository.findByUserId(currentUser.getId())
                .orElseGet(() -> {
                    MealSchedule fresh = new MealSchedule();
                    fresh.setUserId(currentUser.getId());
                    return fresh;
                });

        schedule.setHour(clampHour(dto.getHour()));
        schedule.setMinute(clampMinute(dto.getMinute()));
        schedule.setEnabled(dto.isEnabled());
        schedule.setTimezone(dto.getTimezone());
        schedule.setUpdatedAt(Instant.now());

        // Persist the user's timezone alongside the schedule so other server-side "today"
        // computations can be made timezone-aware.
        if (dto.getTimezone() != null && !dto.getTimezone().isBlank()) {
            currentUser.setTimezone(dto.getTimezone());
            userRepository.save(currentUser);
        }

        return mealScheduleRepository.save(schedule);
    }

    private int clampHour(int hour) {
        return Math.max(0, Math.min(23, hour));
    }

    private int clampMinute(int minute) {
        return Math.max(0, Math.min(59, minute));
    }
}
