package com.habitbuilder.NutritionTracker.modules.auth.dto;

import lombok.Data;

@Data
public class AuthRequest {
    private String email;
    private String password;
    private String name;
    private String age;
    private String gender;
}