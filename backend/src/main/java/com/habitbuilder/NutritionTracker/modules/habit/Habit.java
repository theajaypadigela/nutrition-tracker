package com.habitbuilder.NutritionTracker.modules.habit;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;

import java.time.LocalTime;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "habits")
@Getter
@Setter
public class Habit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "repeat_days", nullable = false)
    private String[] repeatDays;

    @JsonFormat(pattern = "hh:mm a")
    @Column(name = "reminder_time", nullable = false)
    private LocalTime reminderTime;

    @Column(name = "reminder_type", nullable = false)
    private String reminderType;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
}

@Getter
@Setter
class HabitDTO {
    private String name;
    private String[] repeatDays;
    private String reminderTime;
    private String reminderType;
}

@Getter
@Setter
class HabitCompletionDTO {
    private Long id;
}
