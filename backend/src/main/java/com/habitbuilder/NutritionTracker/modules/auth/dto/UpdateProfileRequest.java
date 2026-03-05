package com.habitbuilder.NutritionTracker.modules.auth.dto;

import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String name;
    private String age;
    private String gender;
}
