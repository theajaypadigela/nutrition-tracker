package com.habitbuilder.NutritionTracker.modules.foodLog.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.habitbuilder.NutritionTracker.modules.foodLog.entity.FoodLog;

@Repository
public interface FoodLogRepository extends JpaRepository<FoodLog, Long> {
    List<FoodLog> findByUserIdAndDate(Long userId, LocalDate date);
}
