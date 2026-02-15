package com.habitbuilder.NutritionTracker.modules.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginResponse {
    private Long id;
    private String name;
    private String email;
    private String age;
    private String gender;
    private String token;
}
