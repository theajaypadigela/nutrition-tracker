package com.habitbuilder.NutritionTracker.modules.notification.repository;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.habitbuilder.NutritionTracker.modules.notification.entity.VoipCallDispatch;

public interface VoipCallDispatchRepository extends MongoRepository<VoipCallDispatch, String> {

    Optional<VoipCallDispatch> findByDispatchKey(String dispatchKey);
}
