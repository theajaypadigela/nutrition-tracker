package com.habitbuilder.NutritionTracker.modules.dashboard.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.habitbuilder.NutritionTracker.modules.habits.dto.HabitDto;
import com.habitbuilder.NutritionTracker.modules.foodLog.dto.FoodLogDto;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DashboardResponse {
    private List<HabitDto> habits;
    private List<FoodLogDto> foodLogs;
    private int totalCalories;
    private double totalProtein;
    private double totalCarbs;
    private double totalFat;
    private int habitsCompleted;
    private int habitsTotal;
}
