package com.habitbuilder.NutritionTracker.modules.food.dto;

import java.util.List;

import lombok.Data;

@Data
public class SetAvoidRequest {
    private List<String> foods;
}
