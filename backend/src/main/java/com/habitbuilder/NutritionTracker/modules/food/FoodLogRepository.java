package com.habitbuilder.NutritionTracker.modules.food;

import java.time.LocalDate;
import java.util.Optional;
import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface FoodLogRepository extends MongoRepository<FoodLog, String> {

    Optional<FoodLog> findByUserIdAndLogDate(String userId, LocalDate logDate);

    List<FoodLog> findByUserIdAndLogDateBetweenOrderByLogDateAsc(String userId, LocalDate from, LocalDate to);
}
