package com.habitbuilder.NutritionTracker.modules.habit;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Getter
@Setter
public class HabitWithCompletionDTO {
    private Long id;
    private String name;
    private String[] repeatDays;
    @JsonFormat(pattern = "hh:mm a")
    private LocalTime reminderTime;
    private String reminderType;
    private boolean completed;
    private String status; // PENDING, COMPLETED, MISSED, RESCHEDULED
    private String completedAt;
    private LocalDateTime rescheduledTime;
}
