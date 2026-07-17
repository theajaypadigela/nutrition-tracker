package com.habitbuilder.NutritionTracker.modules.food.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopFoodSource {
    private String name;
    private double amount;
    private String unit;
    private double contribution; // percentage
}
