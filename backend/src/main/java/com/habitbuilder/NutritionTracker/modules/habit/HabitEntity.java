package com.habitbuilder.NutritionTracker.modules.habit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import java.time.LocalDate;

import lombok.Getter;
import lombok.Setter;

@Entity
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

    @PrePersist
    protected void onCreate() {
        if (this.entryDate == null) {
            this.entryDate = LocalDate.now();
        }
    }

}

enum HabitStatus {
    COMPLETED,
    MISSED,
    PENDING
}