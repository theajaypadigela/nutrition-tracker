package com.habitbuilder.NutritionTracker.modules.habit.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HabitDTO {
    private String name;
    private String[] repeatDays;
    private String reminderTime;
    private String reminderType;
}
