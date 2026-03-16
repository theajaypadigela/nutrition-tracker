package com.habitbuilder.NutritionTracker.modules.auth.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);
}
