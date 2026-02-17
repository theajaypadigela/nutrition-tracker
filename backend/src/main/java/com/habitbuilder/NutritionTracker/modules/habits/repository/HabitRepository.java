package com.habitbuilder.NutritionTracker.modules.habits.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.habitbuilder.NutritionTracker.modules.habits.entity.Habit;

@Repository
public interface HabitRepository extends JpaRepository<Habit, Long> {
    List<Habit> findByUserId(Long userId);
}
