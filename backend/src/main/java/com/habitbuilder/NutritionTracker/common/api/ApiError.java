package com.habitbuilder.NutritionTracker.common.api;

public record ApiError(int status, String code, String message) {
}
