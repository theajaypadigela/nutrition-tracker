package com.habitbuilder.NutritionTracker.modules.voice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class VoiceMealLogRequest {

    private String date;
    private Map<String, List<MealEntryDto>> meals;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MealEntryDto {
        private String foodName;
        private Double quantity;
        private String unit;
        private String notes;
    }
}
