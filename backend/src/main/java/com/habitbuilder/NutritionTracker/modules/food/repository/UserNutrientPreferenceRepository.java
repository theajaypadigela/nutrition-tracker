package com.habitbuilder.NutritionTracker.modules.food.repository;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;
import com.habitbuilder.NutritionTracker.modules.food.entity.UserNutrientPreference;

public interface UserNutrientPreferenceRepository extends MongoRepository<UserNutrientPreference, String> {

    List<UserNutrientPreference> findByUserId(String userId);

    Optional<UserNutrientPreference> findByUserIdAndNutrientId(String userId, String nutrientId);
}
