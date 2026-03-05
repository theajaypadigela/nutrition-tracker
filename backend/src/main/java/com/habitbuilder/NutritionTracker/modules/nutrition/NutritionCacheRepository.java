package com.habitbuilder.NutritionTracker.modules.nutrition;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NutritionCacheRepository extends JpaRepository<NutritionCache, String> {
    Optional<NutritionCache> findByEntryHash(String entryHash);
}
