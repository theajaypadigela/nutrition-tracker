package com.habitbuilder.NutritionTracker.modules.voice.dto;

import java.time.LocalDate;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MealTranscriptParseRequestDTO {
    private String transcript;
    private LocalDate logDate;
}
