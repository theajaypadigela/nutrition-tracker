package com.habitbuilder.NutritionTracker.modules.habit;

import java.util.List;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HabitVoiceInterpretRequestDTO {
    private List<String> transcriptLines;
    private String habitName;
    private String habitTime;
}
