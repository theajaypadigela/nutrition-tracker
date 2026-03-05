package com.habitbuilder.NutritionTracker.modules.dashboard;

import com.habitbuilder.NutritionTracker.modules.food.MealsResponse;
import com.habitbuilder.NutritionTracker.modules.habit.HabitWithCompletionDTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardResponse {
    private LocalDate date;
    private MealsResponse foodSummary;
    private List<HabitWithCompletionDTO> habits;
}
