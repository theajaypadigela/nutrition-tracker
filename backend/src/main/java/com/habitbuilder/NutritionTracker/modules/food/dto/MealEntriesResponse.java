package com.habitbuilder.NutritionTracker.modules.food.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MealEntriesResponse {

    private String mealType;
    private List<FoodEntryResponse> entries;
}
