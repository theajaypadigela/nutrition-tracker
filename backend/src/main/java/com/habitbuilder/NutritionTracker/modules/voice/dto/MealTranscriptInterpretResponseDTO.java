package com.habitbuilder.NutritionTracker.modules.voice.dto;

import com.habitbuilder.NutritionTracker.modules.nutrition.dto.VoiceInterpretResult;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MealTranscriptInterpretResponseDTO implements VoiceInterpretResult {
    private boolean shouldLogMeals;
    private Integer rescheduleMinutes;
    private String rationale;
}
