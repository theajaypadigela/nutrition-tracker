package com.habitbuilder.NutritionTracker.modules.food.dto;

import java.util.List;

import com.habitbuilder.NutritionTracker.modules.food.dto.NutritionTotals;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeeklyNutritionReport {
    private Double avgDailyCalories;
    private NutritionTotals weeklyTotals;
    private NutritionTotals weeklyAverage;
    private List<DailyNutritionSummary> dailySummaries;
}
