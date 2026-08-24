package com.habitbuilder.NutritionTracker.modules.notification.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;

public interface IosVoipDeviceTokenRepository extends MongoRepository<IosVoipDeviceToken, String> {

    Optional<IosVoipDeviceToken> findByEnvironmentAndTokenHash(
            String environment,
            String tokenHash);

    List<IosVoipDeviceToken> findByUserIdAndEnvironmentAndEnabledTrue(
            String userId,
            String environment);

    long deleteByUserIdAndEnvironmentAndTokenHash(
            String userId,
            String environment,
            String tokenHash);
}
