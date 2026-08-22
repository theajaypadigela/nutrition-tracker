package com.habitbuilder.NutritionTracker.modules.food.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.habitbuilder.NutritionTracker.modules.food.entity.FoodEntry;

public interface FoodEntryRepository extends MongoRepository<FoodEntry, String> {

    List<FoodEntry> findByFoodLogId(String foodLogId);

    List<FoodEntry> findByFoodLogIdIn(List<String> foodLogIds);
}
