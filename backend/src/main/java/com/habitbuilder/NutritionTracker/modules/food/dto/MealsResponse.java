package com.habitbuilder.NutritionTracker.modules.food.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MealsResponse {
    private Map<String, List<FoodItemResponse>> meals;
    private NutritionTotals totals;
}
