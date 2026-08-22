package com.habitbuilder.NutritionTracker.modules.food.controller;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.habitbuilder.NutritionTracker.modules.food.dto.AddFoodEntryRequest;
import com.habitbuilder.NutritionTracker.modules.food.dto.DayLogResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.FoodEntryResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.UpdateFoodEntryRequest;

import jakarta.validation.Valid;

import java.time.LocalDate;
import java.util.List;
import com.habitbuilder.NutritionTracker.modules.food.dto.MealsResponse;
import com.habitbuilder.NutritionTracker.modules.food.service.FoodLogService;

/** Food-log entry CRUD. Dates are local {@code YYYY-MM-DD}. */
@RestController
@RequestMapping("/food")
public class FoodEntryController {

    private final FoodLogService foodLogService;

    public FoodEntryController(FoodLogService foodLogService) {
        this.foodLogService = foodLogService;
    }

    @PostMapping("/{date}/meals/{mealType}/entries")
    public ResponseEntity<List<FoodEntryResponse>> addEntries(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable String mealType,
            @RequestBody List<@Valid AddFoodEntryRequest> request) {
        return ResponseEntity.ok(foodLogService.addFoodEntries(date, mealType, request));
    }

    @GetMapping("/{date}")
    public ResponseEntity<MealsResponse> getDayLog(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(foodLogService.getDayLogAsMeals(date));
    }

    @GetMapping
    public ResponseEntity<List<DayLogResponse>> getDayLogs(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(foodLogService.getDayLogs(from, to));
    }

    @PutMapping("/{date}/meals/entries/{id}")
    public ResponseEntity<MealsResponse> updateEntry(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable String id,
            @RequestBody @Valid UpdateFoodEntryRequest request) {
        return ResponseEntity.ok(foodLogService.updateEntry(date, id, request));
    }

    @DeleteMapping("/{date}/meals/entries/{id}")
    public ResponseEntity<MealsResponse> deleteEntry(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable String id) {
        return ResponseEntity.ok(foodLogService.deleteEntry(date, id));
    }

    @DeleteMapping("/meals/entries/{id}")
    public ResponseEntity<MealsResponse> deleteEntryById(@PathVariable String id) {
        return ResponseEntity.ok(foodLogService.deleteEntryById(id));
    }
}
