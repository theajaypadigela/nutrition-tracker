package com.habitbuilder.NutritionTracker.modules.voice.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MealTranscriptInterpretRequestDTO {
    private String transcript;
    private String mealSlotId;
}
