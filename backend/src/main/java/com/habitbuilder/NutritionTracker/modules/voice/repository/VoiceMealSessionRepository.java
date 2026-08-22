package com.habitbuilder.NutritionTracker.modules.voice.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.habitbuilder.NutritionTracker.modules.voice.entity.VoiceMealSession;

public interface VoiceMealSessionRepository extends MongoRepository<VoiceMealSession, String> {
}
