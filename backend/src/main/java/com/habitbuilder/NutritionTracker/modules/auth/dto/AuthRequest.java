package com.habitbuilder.NutritionTracker.modules.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AuthRequest {

    public interface Login {
    }

    public interface Registration extends Login {
    }

    @NotBlank(groups = Login.class)
    @Email(groups = Login.class)
    @Size(max = 254, groups = Login.class)
    private String email;

    @NotBlank(groups = Login.class)
    @Size(max = 128, groups = Login.class)
    @Size(min = 8, groups = Registration.class)
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", groups = Registration.class)
    private String password;

    @NotBlank(groups = Registration.class)
    @Size(max = 100, groups = Registration.class)
    private String name;

    @NotBlank(groups = Registration.class)
    @Size(max = 20, groups = Registration.class)
    private String age;

    @NotBlank(groups = Registration.class)
    @Size(max = 50, groups = Registration.class)
    private String gender;

    @Size(max = 100, groups = Registration.class)
    private String timezone;
}
