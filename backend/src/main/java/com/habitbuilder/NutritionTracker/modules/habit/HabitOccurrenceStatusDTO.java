package com.habitbuilder.NutritionTracker.modules.habit;

import lombok.Getter;
import lombok.Setter;

/**
 * Reports a terminal occurrence status for a habit call (MISSED or DECLINED), so a habit
 * is never left eternally PENDING. Either habitId or reminderTime must be present; a
 * reminderTime applies the status to every habit at that time (consolidated call slot).
 */
@Getter
@Setter
public class HabitOccurrenceStatusDTO {
    private String habitId;
    private String reminderTime;
    private String status; // "MISSED" | "DECLINED"
    private String timezone;
}
