package com.habitbuilder.NutritionTracker.modules.food.dto;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FoodEntryResponse {

    private String id;
    private String name;
    private double quantity;
    private String unit;
    private String mealType;
    private String nutritionResponse;
    private Instant createdAt;
    private Instant updatedAt;
}
