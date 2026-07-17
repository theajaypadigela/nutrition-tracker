package com.habitbuilder.NutritionTracker.modules.dashboard;

import com.habitbuilder.NutritionTracker.modules.food.FoodLogService;
import com.habitbuilder.NutritionTracker.modules.food.MealsResponse;
import com.habitbuilder.NutritionTracker.modules.habit.HabitService;
import com.habitbuilder.NutritionTracker.modules.habit.HabitWithCompletionDTO;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

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
