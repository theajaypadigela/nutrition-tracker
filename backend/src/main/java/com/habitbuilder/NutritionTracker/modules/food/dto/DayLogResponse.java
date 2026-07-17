package com.habitbuilder.NutritionTracker.modules.food.dto;

import java.time.LocalDate;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DayLogResponse {

    private String foodLogId;
    private LocalDate date;
    private List<MealEntriesResponse> meals;
}
