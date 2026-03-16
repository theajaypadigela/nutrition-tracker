package com.habitbuilder.NutritionTracker.modules.voice;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface VoiceMealSessionRepository extends MongoRepository<VoiceMealSession, String> {
}
