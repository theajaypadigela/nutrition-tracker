package com.habitbuilder.NutritionTracker.modules.food.controller;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.habitbuilder.NutritionTracker.modules.food.dto.InsightResponse;

import java.time.LocalDate;
import java.util.List;
import com.habitbuilder.NutritionTracker.modules.food.service.NutritionInsightsService;

/** LLM-generated nutrition insights over a date range. */
@RestController
@RequestMapping("/food/nutrition/insights")
public class NutritionInsightsController {

    private final NutritionInsightsService nutritionInsightsService;

    public NutritionInsightsController(NutritionInsightsService nutritionInsightsService) {
        this.nutritionInsightsService = nutritionInsightsService;
    }

    @GetMapping
    public ResponseEntity<List<InsightResponse>> getAiInsights(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(nutritionInsightsService.getAiInsights(startDate, endDate));
    }
}
