package com.habitbuilder.NutritionTracker.modules.nutrition;

public class GeminiApiException extends RuntimeException {
    private final String rawResponse;

    public GeminiApiException(String message, String rawResponse) {
        super(message);
        this.rawResponse = rawResponse;
    }

    public GeminiApiException(String message, String rawResponse, Throwable cause) {
        super(message, cause);
        this.rawResponse = rawResponse;
    }

    public String getRawResponse() {
        return rawResponse;
    }

    public String getFullDetails() {
        return "Message: " + getMessage() + " | Raw Response: " + rawResponse;
    }
}
