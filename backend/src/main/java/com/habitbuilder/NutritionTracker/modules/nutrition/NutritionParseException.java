package com.habitbuilder.NutritionTracker.modules.nutrition;

public class NutritionParseException extends GeminiApiException {

    public NutritionParseException(String message, String rawResponse) {
        super(message, rawResponse);
    }

    public NutritionParseException(String message, String rawResponse, Throwable cause) {
        super(message, rawResponse, cause);
    }
}
