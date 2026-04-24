package com.habitbuilder.NutritionTracker.modules.nutrition;

public class GeminiApiException extends AiProviderException {

    public GeminiApiException(String message, String rawResponse) {
        this(message, rawResponse, null, -1, false);
    }

    public GeminiApiException(String message, String rawResponse, Throwable cause) {
        this(message, rawResponse, cause, -1, false);
    }

    public GeminiApiException(String message, String rawResponse, int statusCode, boolean retryable) {
        this(message, rawResponse, null, statusCode, retryable);
    }

    public GeminiApiException(String message, String rawResponse, Throwable cause, int statusCode, boolean retryable) {
        super("gemini", message, rawResponse, cause, statusCode, retryable);
    }
}
