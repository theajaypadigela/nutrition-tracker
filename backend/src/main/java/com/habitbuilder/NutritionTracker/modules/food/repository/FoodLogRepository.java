package com.habitbuilder.NutritionTracker.modules.food.repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.habitbuilder.NutritionTracker.modules.food.entity.FoodLog;

public interface FoodLogRepository extends MongoRepository<FoodLog, String> {

    Optional<FoodLog> findByUserIdAndLogDate(String userId, LocalDate logDate);

    // Spring Data Mongo's "Between" is exclusive on both bounds; reports need inclusive [from, to].
    List<FoodLog> findByUserIdAndLogDateGreaterThanEqualAndLogDateLessThanEqualOrderByLogDateAsc(
            String userId, LocalDate from, LocalDate to);
}
