package com.habitbuilder.NutritionTracker.modules.habit.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

@Document(collection = "habit_entries")
@Getter
@Setter
public class HabitEntity {

    @Id
    private String id;

    private String habitId;

    private String userId;

    private LocalDate entryDate;

    private String completionTime;

    private HabitStatus status = HabitStatus.PENDING;

    private LocalDateTime rescheduledTime;

}
