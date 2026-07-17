package com.habitbuilder.NutritionTracker.modules.habit;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
class HabitDTO {
    private String name;
    private String[] repeatDays;
    private String reminderTime;
    private String reminderType;
}
