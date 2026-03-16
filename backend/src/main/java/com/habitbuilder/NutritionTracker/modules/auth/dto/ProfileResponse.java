package com.habitbuilder.NutritionTracker.modules.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ProfileResponse {
    private String id;
    private String name;
    private String email;
    private String age;
    private String gender;
}
