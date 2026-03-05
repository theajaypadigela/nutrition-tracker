package com.habitbuilder.NutritionTracker.modules.food;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FoodLogRepository extends JpaRepository<FoodLog, UUID> {

    @Query("SELECT fl FROM FoodLog fl LEFT JOIN FETCH fl.entries e LEFT JOIN FETCH e.nutritionDetails WHERE fl.userId = :userId AND fl.logDate = :logDate")
    Optional<FoodLog> findByUserIdAndLogDate(@Param("userId") Long userId, @Param("logDate") LocalDate logDate);

    @Query("SELECT DISTINCT fl FROM FoodLog fl LEFT JOIN FETCH fl.entries e LEFT JOIN FETCH e.nutritionDetails WHERE fl.userId = :userId AND fl.logDate BETWEEN :from AND :to ORDER BY fl.logDate ASC")
    List<FoodLog> findByUserIdAndLogDateBetweenOrderByLogDateAsc(@Param("userId") Long userId,
            @Param("from") LocalDate from, @Param("to") LocalDate to);
}