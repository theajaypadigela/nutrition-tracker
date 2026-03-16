package com.habitbuilder.NutritionTracker.modules.nutrition;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NutritionCacheRepository extends MongoRepository<NutritionCache, String> {
    Optional<NutritionCache> findByEntryHash(String entryHash);
}
