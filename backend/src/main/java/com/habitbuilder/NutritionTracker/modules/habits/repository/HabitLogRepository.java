package com.habitbuilder.NutritionTracker.modules.habits.repository;

import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.habitbuilder.NutritionTracker.modules.habits.entity.HabitLog;

@Repository
public interface HabitLogRepository extends JpaRepository<HabitLog, Long> {
    HabitLog findByHabitIdAndDate(Long habitId, LocalDate date);
}