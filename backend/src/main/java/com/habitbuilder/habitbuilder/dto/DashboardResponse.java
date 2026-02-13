package com.habitbuilder.habitbuilder.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

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
