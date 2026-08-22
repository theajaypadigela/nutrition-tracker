package com.habitbuilder.NutritionTracker.modules.food.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.food.dto.NutrientPreferenceResponse;
import com.habitbuilder.NutritionTracker.modules.food.entity.UserNutrientPreference;
import com.habitbuilder.NutritionTracker.modules.food.repository.UserNutrientPreferenceRepository;

/** Per-user nutrient preferences: pinned nutrients, custom targets, avoided foods. */
@Service
public class NutrientPreferenceService {

    private final UserNutrientPreferenceRepository preferenceRepository;
    private final CurrentUserProvider currentUserProvider;

    public NutrientPreferenceService(
            UserNutrientPreferenceRepository preferenceRepository,
            CurrentUserProvider currentUserProvider) {
        this.preferenceRepository = preferenceRepository;
        this.currentUserProvider = currentUserProvider;
    }

    public NutrientPreferenceResponse togglePin(String nutrientId) {
        UserNutrientPreference pref = getOrCreate(nutrientId);
        pref.setPinned(!pref.isPinned());
        preferenceRepository.save(pref);
        return toPreferenceResponse(pref);
    }

    public NutrientPreferenceResponse setCustomTarget(String nutrientId, Double target) {
        UserNutrientPreference pref = getOrCreate(nutrientId);
        pref.setCustomTarget(target);
        preferenceRepository.save(pref);
        return toPreferenceResponse(pref);
    }

    public NutrientPreferenceResponse setAvoidedFoods(String nutrientId, List<String> foods) {
        UserNutrientPreference pref = getOrCreate(nutrientId);
        pref.setAvoidedFoods(foods != null ? String.join(",", foods) : null);
        preferenceRepository.save(pref);
        return toPreferenceResponse(pref);
    }

    public List<NutrientPreferenceResponse> getPreferences() {
        String userId = currentUserProvider.currentUserId();
        return preferenceRepository.findByUserId(userId).stream()
                .map(this::toPreferenceResponse)
                .collect(Collectors.toList());
    }

    private UserNutrientPreference getOrCreate(String nutrientId) {
        String userId = currentUserProvider.currentUserId();
        return preferenceRepository
                .findByUserIdAndNutrientId(userId, nutrientId)
                .orElseGet(() -> UserNutrientPreference.builder()
                        .userId(userId)
                        .nutrientId(nutrientId)
                        .build());
    }

    private NutrientPreferenceResponse toPreferenceResponse(UserNutrientPreference pref) {
        List<String> avoided = pref.getAvoidedFoods() != null && !pref.getAvoidedFoods().isEmpty()
                ? List.of(pref.getAvoidedFoods().split(","))
                : List.of();
        return NutrientPreferenceResponse.builder()
                .nutrientId(pref.getNutrientId())
                .pinned(pref.isPinned())
                .customTarget(pref.getCustomTarget())
                .avoidedFoods(avoided)
                .build();
    }
}
