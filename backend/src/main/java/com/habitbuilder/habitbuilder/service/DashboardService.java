package com.habitbuilder.habitbuilder.service;

import java.util.List;
import java.time.LocalDate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.habitbuilder.habitbuilder.dto.DashboardResponse;
import com.habitbuilder.habitbuilder.dto.FoodLogDto;
import com.habitbuilder.habitbuilder.dto.HabitDto;

@Service
public class DashboardService {

    @Autowired
    private FoodLoggingService foodLoggingService;

    @Autowired
    private HabitsService habitsService;

    public DashboardResponse getDashboardData(Long userId, LocalDate date) {
        List<FoodLogDto> foodLogs = foodLoggingService.getFoodLogByDate(userId, date);
        List<HabitDto> habits = habitsService.getHabitsByDate(userId, date);

        DashboardResponse dashboardResponse = new DashboardResponse();
        dashboardResponse.setFoodLogs(foodLogs);
        dashboardResponse.setHabits(habits);

        int totalCalories = 0;
        double totalProtein = 0;
        double totalCarbs = 0;
        double totalFat = 0;
        int habitsCompleted = 0;

        for (FoodLogDto fDto : foodLogs) {
            totalCalories += fDto.getCalories();
            totalProtein += fDto.getProtein();
            totalCarbs += fDto.getCarbs();
            totalFat += fDto.getFat();
        }

        for (HabitDto habit : habits) {
            if (habit.isCompleted()) {
                habitsCompleted++;
            }
        }

        dashboardResponse.setTotalCalories(totalCalories);
        dashboardResponse.setTotalProtein(totalProtein);
        dashboardResponse.setTotalCarbs(totalCarbs);
        dashboardResponse.setTotalFat(totalFat);
        dashboardResponse.setHabitsCompleted(habitsCompleted);
        dashboardResponse.setHabitsTotal(habits.size());
        return dashboardResponse;
    }
}
