package com.habitbuilder.NutritionTracker.modules.dashboard.dto;

import com.habitbuilder.NutritionTracker.modules.food.dto.MealsResponse;
import com.habitbuilder.NutritionTracker.modules.habit.dto.HabitWithCompletionDTO;

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
