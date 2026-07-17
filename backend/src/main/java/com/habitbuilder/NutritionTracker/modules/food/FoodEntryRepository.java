package com.habitbuilder.NutritionTracker.modules.food;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface FoodEntryRepository extends MongoRepository<FoodEntry, String> {

    List<FoodEntry> findByFoodLogId(String foodLogId);

    List<FoodEntry> findByFoodLogIdIn(List<String> foodLogIds);
}
