package com.habitbuilder.NutritionTracker.modules.nutrition.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionCache;

@Repository
public interface NutritionCacheRepository extends MongoRepository<NutritionCache, String> {
    Optional<NutritionCache> findFirstByNormalizedFoodName(String normalizedFoodName);

    Optional<NutritionCache> findFirstByFoodNameIgnoreCase(String foodName);
}
