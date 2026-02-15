package com.habitbuilder.NutritionTracker.modules.dashboard.controller;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
public class Dashboard {
    @GetMapping("/dashboard")
    public String getMethodName() {
        return new String("Hello User, welcome to your dashboard!");
    }
    
}
