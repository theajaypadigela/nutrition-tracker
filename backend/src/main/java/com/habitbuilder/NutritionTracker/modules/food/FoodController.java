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

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;
import java.util.Map;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@RestController
@RequestMapping("/food")
public class FoodController {

    private FoodService foodService;

    FoodController(FoodService foodService) {
        this.foodService = foodService;
    }

    @PostMapping("/{date}/meals/{mealType}/entries")
    public ResponseEntity<List<FoodEntryResponse>> addEntries(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable String mealType,
            @RequestBody @Valid List<@Valid AddFoodEntryRequest> request) {
        List<FoodEntryResponse> result = foodService.addFoodEntries(date, mealType, request);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{date}")
    public ResponseEntity<MealsResponse> getDayLog(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        MealsResponse result = foodService.getDayLogAsMeals(date);
        return ResponseEntity.ok(result);
    }

    @GetMapping
    public ResponseEntity<List<DayLogResponse>> getDayLogs(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        List<DayLogResponse> result = foodService.getDayLogs(from, to);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{date}/meals/entries/{id}")
    public ResponseEntity<MealsResponse> updateEntry(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable UUID id,
            @RequestBody @Valid UpdateFoodEntryRequest request) {
        MealsResponse result = foodService.updateEntry(date, id, request);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{date}/meals/entries/{id}")
    public ResponseEntity<MealsResponse> deleteEntry(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable UUID id) {
        MealsResponse result = foodService.deleteEntry(date, id);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/nutrition/weekly")
    public ResponseEntity<WeeklyNutritionReport> getWeeklyNutritionReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        WeeklyNutritionReport report = foodService.getWeeklyNutritionReport(startDate, endDate);
        return ResponseEntity.ok(report);
    }

    @GetMapping("/nutrition/all")
    public ResponseEntity<List<NutrientSummary>> getAllNutrients(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<NutrientSummary> summaries = foodService.getAllNutrientsSummary(startDate, endDate);
        return ResponseEntity.ok(summaries);
    }

    // ── Nutrient Preferences ──────────────────────────────────────────────────

    @PostMapping("/nutrient/{nutrientId}/pin")
    public ResponseEntity<NutrientPreferenceResponse> togglePin(
            @PathVariable String nutrientId) {
        NutrientPreferenceResponse result = foodService.togglePin(nutrientId);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/nutrient/{nutrientId}/target")
    public ResponseEntity<NutrientPreferenceResponse> setCustomTarget(
            @PathVariable String nutrientId,
            @RequestBody SetTargetRequest request) {
        NutrientPreferenceResponse result = foodService.setCustomTarget(nutrientId, request.getTarget());
        return ResponseEntity.ok(result);
    }

    @PutMapping("/nutrient/{nutrientId}/avoid")
    public ResponseEntity<NutrientPreferenceResponse> setAvoidedFoods(
            @PathVariable String nutrientId,
            @RequestBody SetAvoidRequest request) {
        NutrientPreferenceResponse result = foodService.setAvoidedFoods(nutrientId, request.getFoods());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/nutrient/preferences")
    public ResponseEntity<List<NutrientPreferenceResponse>> getPreferences() {
        List<NutrientPreferenceResponse> prefs = foodService.getPreferences();
        return ResponseEntity.ok(prefs);
    }

    // ── AI Insights ───────────────────────────────────────────────────────────

    @GetMapping("/nutrition/insights")
    public ResponseEntity<List<InsightResponse>> getAiInsights(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<InsightResponse> insights = foodService.getAiInsights(startDate, endDate);
        return ResponseEntity.ok(insights);
    }
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class FoodEntryResponse {

    private UUID id;
    private String name;
    private double quantity;
    private String unit;
    private String mealType;
    private String nutritionResponse;
    private String enrichmentStatus;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}

@Data
class AddFoodEntryRequest {

    @NotBlank(message = "Food name is required")
    private String name;

    @Positive(message = "Quantity must be positive")
    private double quantity;

    @NotBlank(message = "Unit is required")
    private String unit;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class MealEntriesResponse {

    private String mealType;
    private List<FoodEntryResponse> entries;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class DayLogResponse {

    private UUID foodLogId;
    private LocalDate date;
    private List<MealEntriesResponse> meals;
}



@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class WeeklyNutritionReport {
    private Double avgDailyCalories;
    private NutritionTotals weeklyTotals;
    private NutritionTotals weeklyAverage;
    private List<DailyNutritionSummary> dailySummaries;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class DailyNutritionSummary {
    private LocalDate date;
    private NutritionTotals totals;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class TopFoodSource {
    private String name;
    private double amount;
    private String unit;
    private double contribution; // percentage
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class NutrientSummary {
    private String id;
    private String name;
    private String unit;
    private String category;   // macro | vitamin | mineral | other
    private double value;      // average daily intake over the range
    private double goal;       // AI-derived RDI for the user
    private int pctDV;         // value/goal * 100
    private String flag;       // low | ok | high
    private double weeklyAvg;  // same as value for the range avg
    private List<Double> trend; // one entry per day in range (0 if no data)
    private List<TopFoodSource> topSources;
    private boolean pinned;
    private String avoidedFoods;
    private Double customTarget;
}

@Data
class UpdateFoodEntryRequest {

    private String name;

    private Double quantity;

    private String unit;
}

@Data
class SetTargetRequest {
    private Double target;
}

@Data
class SetAvoidRequest {
    private List<String> foods;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class NutrientPreferenceResponse {
    private String nutrientId;
    private boolean pinned;
    private Double customTarget;
    private List<String> avoidedFoods;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class InsightResponse {
    private String variant;   // positive | negative | neutral
    private String message;
}
