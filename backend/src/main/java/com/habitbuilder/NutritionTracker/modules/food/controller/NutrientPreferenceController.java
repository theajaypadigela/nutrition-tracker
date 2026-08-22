package com.habitbuilder.NutritionTracker.modules.food.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.habitbuilder.NutritionTracker.modules.food.dto.NutrientPreferenceResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.SetAvoidRequest;
import com.habitbuilder.NutritionTracker.modules.food.dto.SetTargetRequest;

import java.util.List;
import com.habitbuilder.NutritionTracker.modules.food.service.NutrientPreferenceService;

/** Per-user nutrient preferences: pinning, custom targets and avoided foods. */
@RestController
@RequestMapping("/food/nutrient")
public class NutrientPreferenceController {

    private final NutrientPreferenceService nutrientPreferenceService;

    public NutrientPreferenceController(NutrientPreferenceService nutrientPreferenceService) {
        this.nutrientPreferenceService = nutrientPreferenceService;
    }

    @PostMapping("/{nutrientId}/pin")
    public ResponseEntity<NutrientPreferenceResponse> togglePin(
            @PathVariable String nutrientId) {
        return ResponseEntity.ok(nutrientPreferenceService.togglePin(nutrientId));
    }

    @PutMapping("/{nutrientId}/target")
    public ResponseEntity<NutrientPreferenceResponse> setCustomTarget(
            @PathVariable String nutrientId,
            @RequestBody SetTargetRequest request) {
        return ResponseEntity.ok(nutrientPreferenceService.setCustomTarget(nutrientId, request.getTarget()));
    }

    @PutMapping("/{nutrientId}/avoid")
    public ResponseEntity<NutrientPreferenceResponse> setAvoidedFoods(
            @PathVariable String nutrientId,
            @RequestBody SetAvoidRequest request) {
        return ResponseEntity.ok(nutrientPreferenceService.setAvoidedFoods(nutrientId, request.getFoods()));
    }

    @GetMapping("/preferences")
    public ResponseEntity<List<NutrientPreferenceResponse>> getPreferences() {
        return ResponseEntity.ok(nutrientPreferenceService.getPreferences());
    }
}
