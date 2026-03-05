package com.habitbuilder.NutritionTracker.modules.food;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FoodEntryRepository extends JpaRepository<FoodEntry, UUID> {
}
