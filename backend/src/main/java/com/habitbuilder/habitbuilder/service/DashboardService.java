package com.habitbuilder.habitbuilder.service;

import java.util.ArrayList;
import org.springframework.stereotype.Service;
import com.habitbuilder.habitbuilder.dto.DashboardResponse;

@Service
public class DashboardService {

    public DashboardResponse getDashboardData() {
        DashboardResponse dashboardResponse = new DashboardResponse();
        dashboardResponse.setHabits(new ArrayList<>());
        dashboardResponse.setFoodLogs(new ArrayList<>());
        dashboardResponse.setTotalCalories(0);
        dashboardResponse.setTotalProtein(0);
        dashboardResponse.setTotalCarbs(0);
        dashboardResponse.setTotalFat(0);
        dashboardResponse.setHabitsCompleted(0);
        dashboardResponse.setHabitsTotal(0);
        return dashboardResponse;
    }

    public DashboardResponse getDashboardData(String date) {
        DashboardResponse dashboardResponse = new DashboardResponse();
        dashboardResponse.setHabits(new ArrayList<>());
        dashboardResponse.setFoodLogs(new ArrayList<>());
        dashboardResponse.setTotalCalories(0);
        dashboardResponse.setTotalProtein(0);
        dashboardResponse.setTotalCarbs(0);
        dashboardResponse.setTotalFat(0);
        dashboardResponse.setHabitsCompleted(0);
        dashboardResponse.setHabitsTotal(0);
        return dashboardResponse;
    }
}
