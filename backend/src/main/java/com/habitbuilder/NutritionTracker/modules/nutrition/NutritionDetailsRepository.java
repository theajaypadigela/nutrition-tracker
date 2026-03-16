package com.habitbuilder.NutritionTracker.modules.nutrition;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NutritionDetailsRepository extends MongoRepository<NutritionDetails, String> {
    Optional<NutritionDetails> findByFoodEntryId(String foodEntryId);

    List<NutritionDetails> findByFoodEntryIdIn(List<String> foodEntryIds);
}
