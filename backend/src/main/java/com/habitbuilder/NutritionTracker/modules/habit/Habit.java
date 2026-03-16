package com.habitbuilder.NutritionTracker.modules.habit;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalTime;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Getter;
import lombok.Setter;

@Document(collection = "habits")
@Getter
@Setter
public class Habit {
    @Id
    private String id;

    private String name;

    private List<String> repeatDays;

    @JsonFormat(pattern = "hh:mm a")
    private LocalTime reminderTime;

    private String reminderType;

    private String userId;
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
    private String id;
}
