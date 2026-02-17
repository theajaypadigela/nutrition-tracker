package com.habitbuilder.NutritionTracker.modules.dashboard.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.habitbuilder.NutritionTracker.modules.dashboard.dto.DashboardResponse;
import com.habitbuilder.NutritionTracker.modules.dashboard.service.DashboardService;

import java.time.LocalDate;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {
    private DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public DashboardResponse getDashboardData(@RequestParam Long userId,
            @RequestParam(required = false) String date) {
        return dashboardService.getDashboardData(userId, LocalDate.parse(date));
    }

}