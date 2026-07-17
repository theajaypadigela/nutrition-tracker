package com.habitbuilder.NutritionTracker.modules.food.dto;

import jakarta.validation.constraints.Positive;

import lombok.Data;

@Data
public class UpdateFoodEntryRequest {

    private String name;

    @Positive(message = "Quantity must be positive")
    private Double quantity;

    private String unit;
}
