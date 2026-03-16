package com.habitbuilder.NutritionTracker.modules.voice.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MealTranscriptInterpretResponseDTO {
    private boolean shouldLogMeals;
    private Integer rescheduleMinutes;
    private String rationale;
}
