package com.habitbuilder.NutritionTracker.modules.mealschedule.repository;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import com.habitbuilder.NutritionTracker.modules.mealschedule.entity.MealSchedule;

public interface MealScheduleRepository extends MongoRepository<MealSchedule, String> {
    Optional<MealSchedule> findByUserId(String userId);
}
