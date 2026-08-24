package com.habitbuilder.NutritionTracker.modules.notification.dto;

import jakarta.validation.constraints.NotBlank;

/** The opaque PushKit token uploaded by one authenticated iOS installation. */
public record IosVoipTokenRequest(
        @NotBlank(message = "token is required") String token) {

    /** Prevent Spring MVC debug logging from rendering the opaque device token. */
    @Override
    public String toString() {
        return "IosVoipTokenRequest[token=***]";
    }
}
