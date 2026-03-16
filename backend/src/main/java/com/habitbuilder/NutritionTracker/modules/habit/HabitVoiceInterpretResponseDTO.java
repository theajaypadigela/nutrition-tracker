package com.habitbuilder.NutritionTracker.modules.habit;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HabitVoiceInterpretResponseDTO {
    private String habitStatus; // completed | rescheduled | not_completed
    private Integer rescheduleMinutes;
    private String rationale;
}
