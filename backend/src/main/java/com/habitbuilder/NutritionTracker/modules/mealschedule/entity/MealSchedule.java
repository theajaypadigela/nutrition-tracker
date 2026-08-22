package com.habitbuilder.NutritionTracker.modules.mealschedule.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

import lombok.Getter;
import lombok.Setter;

/**
 * Server-side meal-reminder schedule (§F). One per user. The wall-clock {hour, minute}
 * plus enabled flag is the source of truth; the device mirrors it to AsyncStorage as an
 * offline cache and reconciles from here on login / reinstall / second device.
 */
@Document(collection = "meal_schedules")
@Getter
@Setter
public class MealSchedule {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    private int hour;

    private int minute;

    private boolean enabled;

    /** IANA timezone id the schedule was last saved with (informational). */
    private String timezone;

    private Instant updatedAt = Instant.now();
}
