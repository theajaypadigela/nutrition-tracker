package com.habitbuilder.NutritionTracker.modules.auth.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @Size(max = 100)
    private String name;
    @Size(max = 20)
    private String age;
    @Size(max = 50)
    private String gender;
    @Size(max = 100)
    private String timezone;
}
