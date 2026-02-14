package com.habitbuilder.habitbuilder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class HabitDto {
    private String id;
    private String name;
    private boolean isCompleted;
    private String reason;
    private String time;
    private String repeatedDays;
}
