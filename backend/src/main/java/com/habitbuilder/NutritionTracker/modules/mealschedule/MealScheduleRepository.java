package com.habitbuilder.NutritionTracker.modules.mealschedule;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface MealScheduleRepository extends MongoRepository<MealSchedule, String> {
    Optional<MealSchedule> findByUserId(String userId);
}
