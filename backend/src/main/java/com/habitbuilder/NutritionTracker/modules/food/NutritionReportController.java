package com.habitbuilder.NutritionTracker.modules.food;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.habitbuilder.NutritionTracker.modules.food.dto.NutrientSummary;
import com.habitbuilder.NutritionTracker.modules.food.dto.WeeklyNutritionReport;

import java.time.LocalDate;
import java.util.List;

/** Aggregated nutrition over a date range. */
@RestController
@RequestMapping("/food/nutrition")
public class NutritionReportController {

    private final NutritionReportService nutritionReportService;

    public NutritionReportController(NutritionReportService nutritionReportService) {
        this.nutritionReportService = nutritionReportService;
    }

    @GetMapping("/weekly")
    public ResponseEntity<WeeklyNutritionReport> getWeeklyNutritionReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(nutritionReportService.getWeeklyNutritionReport(startDate, endDate));
    }

    @GetMapping("/all")
    public ResponseEntity<List<NutrientSummary>> getAllNutrients(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(nutritionReportService.getAllNutrientsSummary(startDate, endDate));
    }
}
