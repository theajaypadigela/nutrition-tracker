package com.habitbuilder.habitbuilder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FoodLogDto {
    private String id;
    private String name;
    private int calories;
    private double protein;
    private double carbs;
    private double fat;
    private int quantity;
    private String unit;
}
