package com.habitbuilder.NutritionTracker.modules.food.dto;

import java.time.LocalDate;

import com.habitbuilder.NutritionTracker.modules.food.NutritionTotals;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DailyNutritionSummary {
    private LocalDate date;
    private NutritionTotals totals;
}
