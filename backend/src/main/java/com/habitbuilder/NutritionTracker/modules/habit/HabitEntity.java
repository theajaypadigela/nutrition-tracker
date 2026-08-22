package com.habitbuilder.NutritionTracker.modules.habit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "habit_entity", uniqueConstraints = @UniqueConstraint(
        name = "uk_habit_entity_habit_user_date",
        columnNames = { "habit_id", "user_id", "entry_date" }))
@Getter
@Setter
public class HabitEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "habit_id")
    private String habitId;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "entry_date", updatable = false)
    private LocalDate entryDate;

    @Column(name = "completion_time")
    private String completionTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private HabitStatus status = HabitStatus.PENDING;

    @Column(name = "rescheduled_time")
    private LocalDateTime rescheduledTime;

}

enum HabitStatus {
    COMPLETED,
    MISSED,
    PENDING,
    RESCHEDULED
}
