package com.habitbuilder.NutritionTracker.modules.notification.service;

public record ApnsDeliveryResult(Outcome outcome, int statusCode, String reason) {

    public enum Outcome {
        ACCEPTED,
        INVALID_TOKEN,
        RETRYABLE_FAILURE,
        TERMINAL_FAILURE,
        DISABLED
    }

    public static ApnsDeliveryResult accepted() {
        return new ApnsDeliveryResult(Outcome.ACCEPTED, 200, "Success");
    }

    public static ApnsDeliveryResult disabled() {
        return new ApnsDeliveryResult(Outcome.DISABLED, 0, "Disabled");
    }
}
