package com.habitbuilder.NutritionTracker.modules.dashboard;

import com.habitbuilder.NutritionTracker.modules.food.FoodService;
import com.habitbuilder.NutritionTracker.modules.food.MealsResponse;
import com.habitbuilder.NutritionTracker.modules.habit.HabitService;
import com.habitbuilder.NutritionTracker.modules.habit.HabitWithCompletionDTO;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class DashboardService {

    private final FoodService foodService;
    private final HabitService habitService;

    public DashboardService(FoodService foodService, HabitService habitService) {
        this.foodService = foodService;
        this.habitService = habitService;
    }

    public DashboardResponse getDashboardSummary(LocalDate date) {
        MealsResponse foodSummary = foodService.getDayLogAsMeals(date);
        List<HabitWithCompletionDTO> habits = habitService.getHabitsByDate(date);

        return DashboardResponse.builder()
                .date(date)
                .foodSummary(foodSummary)
                .habits(habits)
                .build();
    }
}
