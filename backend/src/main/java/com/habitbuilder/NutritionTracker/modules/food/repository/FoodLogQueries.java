package com.habitbuilder.NutritionTracker.modules.food.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionDetails;
import com.habitbuilder.NutritionTracker.modules.nutrition.repository.NutritionDetailsRepository;
import com.habitbuilder.NutritionTracker.modules.food.entity.FoodEntry;
import com.habitbuilder.NutritionTracker.modules.food.entity.FoodLog;

/**
 * Read-side helpers shared by the food-log and reporting services: batch
 * loading of logs, their entries, and the matching enrichment records.
 */
@Component
public class FoodLogQueries {

    private final FoodLogRepository foodLogRepository;
    private final FoodEntryRepository foodEntryRepository;
    private final NutritionDetailsRepository nutritionDetailsRepository;

    public FoodLogQueries(
            FoodLogRepository foodLogRepository,
            FoodEntryRepository foodEntryRepository,
            NutritionDetailsRepository nutritionDetailsRepository) {
        this.foodLogRepository = foodLogRepository;
        this.foodEntryRepository = foodEntryRepository;
        this.nutritionDetailsRepository = nutritionDetailsRepository;
    }

    /** Logs for the user in [from, to], ascending by date; days without a log are absent. */
    public List<FoodLog> findLogsInDateRange(String userId, LocalDate from, LocalDate to) {
        return foodLogRepository
                .findByUserIdAndLogDateGreaterThanEqualAndLogDateLessThanEqualOrderByLogDateAsc(userId, from, to);
    }

    public Map<String, List<FoodEntry>> entriesByLogId(List<FoodLog> logs) {
        List<String> logIds = logs.stream().map(FoodLog::getId).collect(Collectors.toList());
        if (logIds.isEmpty()) {
            return Map.of();
        }
        return foodEntryRepository.findByFoodLogIdIn(logIds).stream()
                .collect(Collectors.groupingBy(FoodEntry::getFoodLogId));
    }

    public Map<String, NutritionDetails> nutritionByEntryId(List<FoodEntry> entries) {
        if (entries == null || entries.isEmpty()) {
            return Map.of();
        }

        List<String> entryIds = entries.stream()
                .map(FoodEntry::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (entryIds.isEmpty()) {
            return Map.of();
        }

        return nutritionDetailsRepository.findByFoodEntryIdIn(entryIds).stream()
                .collect(Collectors.toMap(NutritionDetails::getFoodEntryId, nd -> nd, (left, right) -> left));
    }
}
