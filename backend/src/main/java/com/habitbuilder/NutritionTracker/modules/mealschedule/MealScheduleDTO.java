package com.habitbuilder.NutritionTracker.modules.mealschedule;

import lombok.Getter;
import lombok.Setter;

/** Request/response body for the meal-schedule endpoints. */
@Getter
@Setter
public class MealScheduleDTO {
    private int hour;
    private int minute;
    private boolean enabled;
    private String timezone;
}
