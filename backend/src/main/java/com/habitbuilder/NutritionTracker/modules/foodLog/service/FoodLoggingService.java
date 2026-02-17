package com.habitbuilder.NutritionTracker.modules.foodLog.service;

import java.time.LocalDate;
import java.util.List;
import java.util.ArrayList;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import com.habitbuilder.NutritionTracker.modules.foodLog.dto.FoodLogDto;
import com.habitbuilder.NutritionTracker.modules.foodLog.entity.FoodLog;
import com.habitbuilder.NutritionTracker.modules.foodLog.repository.FoodLogRepository;

@Service
public class FoodLoggingService {

    @Autowired
    private FoodLogRepository foodLogRepository;

    public List<FoodLogDto> getFoodLogByDate(Long userId, LocalDate date) {
        List<FoodLog> foodLog = foodLogRepository.findByUserIdAndDate(userId, date);
        List<FoodLogDto> foodLogDto = new ArrayList<>();
        for (FoodLog foodLog1 : foodLog) {
            FoodLogDto foodLogDto1 = new FoodLogDto();
            foodLogDto1.setId(foodLog1.getId());
            foodLogDto1.setName(foodLog1.getName());
            foodLogDto1.setCalories(foodLog1.getCalories());
            foodLogDto1.setProtein(foodLog1.getProtein());
            foodLogDto1.setCarbs(foodLog1.getCarbs());
            foodLogDto1.setFat(foodLog1.getFat());
            foodLogDto1.setQuantity(foodLog1.getQuantity());
            foodLogDto1.setUnit(foodLog1.getUnit());
            foodLogDto.add(foodLogDto1);
        }
        return foodLogDto;
    }
}
