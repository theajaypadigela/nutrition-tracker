package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotNull;

/**
 * Token signing configuration ({@code jwt.*}). Both values are required — a missing signing
 * secret or expiry has always been a startup failure, and silently defaulting either would
 * mean issuing tokens nobody intended.
 */
@ConfigurationProperties("jwt")
@Validated
public record JwtProperties(
        @NotNull String secret,
        @NotNull Long accessExpiration) {
}
