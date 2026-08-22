package com.habitbuilder.NutritionTracker.modules.dashboard.service;

import com.habitbuilder.NutritionTracker.modules.food.service.FoodLogService;
import com.habitbuilder.NutritionTracker.modules.food.dto.MealsResponse;
import com.habitbuilder.NutritionTracker.modules.habit.service.HabitService;
import com.habitbuilder.NutritionTracker.modules.habit.dto.HabitWithCompletionDTO;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import com.habitbuilder.NutritionTracker.modules.dashboard.dto.DashboardResponse;

@Service
public class DashboardService {

    private final FoodLogService foodLogService;
    private final HabitService habitService;

    public DashboardService(FoodLogService foodLogService, HabitService habitService) {
        this.foodLogService = foodLogService;
        this.habitService = habitService;
    }

    public DashboardResponse getDashboardSummary(LocalDate date) {
        MealsResponse foodSummary = foodLogService.getDayLogAsMeals(date);
        List<HabitWithCompletionDTO> habits = habitService.getHabitsByDate(date);

        return DashboardResponse.builder()
                .date(date)
                .foodSummary(foodSummary)
                .habits(habits)
                .build();
    }
}
