package com.habitbuilder.NutritionTracker.modules.food;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface UserNutrientPreferenceRepository extends MongoRepository<UserNutrientPreference, String> {

    List<UserNutrientPreference> findByUserId(String userId);

    Optional<UserNutrientPreference> findByUserIdAndNutrientId(String userId, String nutrientId);
}
