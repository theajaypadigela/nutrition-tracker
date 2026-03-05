package com.habitbuilder.NutritionTracker.modules.nutrition;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface NutritionDetailsRepository extends JpaRepository<NutritionDetails, UUID> {
    Optional<NutritionDetails> findByFoodEntryId(UUID foodEntryId);
}
