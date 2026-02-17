package com.habitbuilder.NutritionTracker.modules.habits.service;

import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.time.LocalDate;
import java.util.ArrayList;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.habitbuilder.NutritionTracker.modules.habits.repository.HabitLogRepository;
import com.habitbuilder.NutritionTracker.modules.habits.repository.HabitRepository;
import com.habitbuilder.NutritionTracker.modules.habits.entity.Habit;
import com.habitbuilder.NutritionTracker.modules.habits.entity.HabitLog;
import com.habitbuilder.NutritionTracker.modules.habits.dto.HabitDto;

@Service
public class HabitsService {

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private HabitLogRepository habitLogRepository;

    public List<HabitDto> getHabitsByDate(Long userId, LocalDate date) {
        List<Habit> allhabits = habitRepository.findByUserId(userId);
        String day = date
                .getDayOfWeek()
                .getDisplayName(TextStyle.SHORT, Locale.ENGLISH);

        List<Habit> todayHabits = allhabits.stream()
                .filter(habit -> habit.getDaysOfWeek().contains(day))
                .toList();

        List<HabitDto> res = new ArrayList<>();

        for (Habit habit : todayHabits) {
            HabitLog log = habitLogRepository.findByHabitIdAndDate(habit.getId(), date);
            HabitDto dto = new HabitDto();
            dto.setId(habit.getId());
            dto.setName(habit.getName());
            dto.setCompleted(log != null && log.isCompleted());
            if (log != null) {
                dto.setReason(log.getReason());
            }
            res.add(dto);
        }

        return res;
    }
}
