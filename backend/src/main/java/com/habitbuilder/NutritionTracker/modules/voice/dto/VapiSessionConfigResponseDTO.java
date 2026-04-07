package com.habitbuilder.NutritionTracker.modules.voice.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class VapiSessionConfigResponseDTO {
    private String token;
    private String assistantId;
    private String purpose;
}
