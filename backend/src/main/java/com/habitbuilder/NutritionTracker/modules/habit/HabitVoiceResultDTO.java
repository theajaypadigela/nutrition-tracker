package com.habitbuilder.NutritionTracker.modules.habit;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HabitVoiceResultDTO {
    private Long habitId;
    private String habitName;
    private String habitStatus; // "completed", "not_completed", "rescheduled"
    private Integer rescheduleMinutes;
    private String completedAt;
}
