package com.habitbuilder.NutritionTracker.modules.habit;

import com.habitbuilder.NutritionTracker.modules.nutrition.VoiceInterpretResult;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HabitVoiceInterpretResponseDTO implements VoiceInterpretResult {
    private String habitStatus; // completed | rescheduled | not_completed
    private Integer rescheduleMinutes;
    private String rationale;
}
