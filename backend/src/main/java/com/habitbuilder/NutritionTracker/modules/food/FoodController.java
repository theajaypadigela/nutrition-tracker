package com.habitbuilder.NutritionTracker.modules.food;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.habitbuilder.NutritionTracker.modules.food.dto.AddFoodEntryRequest;
import com.habitbuilder.NutritionTracker.modules.food.dto.DayLogResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.FoodEntryResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.InsightResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.NutrientPreferenceResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.NutrientSummary;
import com.habitbuilder.NutritionTracker.modules.food.dto.SetAvoidRequest;
import com.habitbuilder.NutritionTracker.modules.food.dto.SetTargetRequest;
import com.habitbuilder.NutritionTracker.modules.food.dto.UpdateFoodEntryRequest;
import com.habitbuilder.NutritionTracker.modules.food.dto.WeeklyNutritionReport;

import jakarta.validation.Valid;

import java.util.List;
import java.time.LocalDate;

@RestController
@RequestMapping("/food")
public class FoodController {

    private final FoodLogService foodLogService;
    private final NutritionReportService nutritionReportService;
    private final NutrientPreferenceService nutrientPreferenceService;
    private final NutritionInsightsService nutritionInsightsService;

    FoodController(
            FoodLogService foodLogService,
            NutritionReportService nutritionReportService,
            NutrientPreferenceService nutrientPreferenceService,
            NutritionInsightsService nutritionInsightsService) {
        this.foodLogService = foodLogService;
        this.nutritionReportService = nutritionReportService;
        this.nutrientPreferenceService = nutrientPreferenceService;
        this.nutritionInsightsService = nutritionInsightsService;
    }

    // ── Food log CRUD ─────────────────────────────────────────────────────────

    @PostMapping("/{date}/meals/{mealType}/entries")
    public ResponseEntity<List<FoodEntryResponse>> addEntries(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable String mealType,
            @RequestBody List<@Valid AddFoodEntryRequest> request) {
        return ResponseEntity.ok(foodLogService.addFoodEntries(date, mealType, request));
    }

    @GetMapping("/{date}")
    public ResponseEntity<MealsResponse> getDayLog(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(foodLogService.getDayLogAsMeals(date));
    }

    @GetMapping
    public ResponseEntity<List<DayLogResponse>> getDayLogs(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(foodLogService.getDayLogs(from, to));
    }

    @PutMapping("/{date}/meals/entries/{id}")
    public ResponseEntity<MealsResponse> updateEntry(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable String id,
            @RequestBody @Valid UpdateFoodEntryRequest request) {
        return ResponseEntity.ok(foodLogService.updateEntry(date, id, request));
    }

    @DeleteMapping("/{date}/meals/entries/{id}")
    public ResponseEntity<MealsResponse> deleteEntry(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable String id) {
        return ResponseEntity.ok(foodLogService.deleteEntry(date, id));
    }

    @DeleteMapping("/meals/entries/{id}")
    public ResponseEntity<MealsResponse> deleteEntryById(@PathVariable String id) {
        return ResponseEntity.ok(foodLogService.deleteEntryById(id));
    }

    // ── Nutrition reports ─────────────────────────────────────────────────────

    @GetMapping("/nutrition/weekly")
    public ResponseEntity<WeeklyNutritionReport> getWeeklyNutritionReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(nutritionReportService.getWeeklyNutritionReport(startDate, endDate));
    }

    @GetMapping("/nutrition/all")
    public ResponseEntity<List<NutrientSummary>> getAllNutrients(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(nutritionReportService.getAllNutrientsSummary(startDate, endDate));
    }

    // ── Nutrient Preferences ──────────────────────────────────────────────────

    @PostMapping("/nutrient/{nutrientId}/pin")
    public ResponseEntity<NutrientPreferenceResponse> togglePin(
            @PathVariable String nutrientId) {
        return ResponseEntity.ok(nutrientPreferenceService.togglePin(nutrientId));
    }

    @PutMapping("/nutrient/{nutrientId}/target")
    public ResponseEntity<NutrientPreferenceResponse> setCustomTarget(
            @PathVariable String nutrientId,
            @RequestBody SetTargetRequest request) {
        return ResponseEntity.ok(nutrientPreferenceService.setCustomTarget(nutrientId, request.getTarget()));
    }

    @PutMapping("/nutrient/{nutrientId}/avoid")
    public ResponseEntity<NutrientPreferenceResponse> setAvoidedFoods(
            @PathVariable String nutrientId,
            @RequestBody SetAvoidRequest request) {
        return ResponseEntity.ok(nutrientPreferenceService.setAvoidedFoods(nutrientId, request.getFoods()));
    }

    @GetMapping("/nutrient/preferences")
    public ResponseEntity<List<NutrientPreferenceResponse>> getPreferences() {
        return ResponseEntity.ok(nutrientPreferenceService.getPreferences());
    }

    // ── AI Insights ───────────────────────────────────────────────────────────

    @GetMapping("/nutrition/insights")
    public ResponseEntity<List<InsightResponse>> getAiInsights(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(nutritionInsightsService.getAiInsights(startDate, endDate));
    }
}
