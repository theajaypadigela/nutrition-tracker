package com.habitbuilder.NutritionTracker.modules.voice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VoiceMealSessionRepository extends JpaRepository<VoiceMealSession, Long> {
    Optional<VoiceMealSession> findByProviderCallId(String providerCallId);
}
