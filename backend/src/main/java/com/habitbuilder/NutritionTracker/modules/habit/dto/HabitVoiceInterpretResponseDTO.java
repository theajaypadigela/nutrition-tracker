package com.habitbuilder.NutritionTracker.modules.habit.dto;

import com.habitbuilder.NutritionTracker.modules.nutrition.dto.VoiceInterpretResult;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HabitVoiceInterpretResponseDTO implements VoiceInterpretResult {
    private String habitStatus; // completed | rescheduled | not_completed
    private Integer rescheduleMinutes;
    private String rationale;
}
