package com.habitbuilder.NutritionTracker.modules.food;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserNutrientPreferenceRepository extends JpaRepository<UserNutrientPreference, Long> {

    List<UserNutrientPreference> findByUserId(Long userId);

    Optional<UserNutrientPreference> findByUserIdAndNutrientId(Long userId, String nutrientId);
}
