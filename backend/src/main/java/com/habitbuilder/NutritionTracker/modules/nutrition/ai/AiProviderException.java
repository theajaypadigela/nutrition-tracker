package com.habitbuilder.NutritionTracker.modules.nutrition.ai;

public class AiProviderException extends RuntimeException {
    private final String provider;
    private final String rawResponse;
    private final int statusCode;
    private final boolean retryable;

    public AiProviderException(String provider, String message, String rawResponse) {
        this(provider, message, rawResponse, null, -1, false);
    }

    public AiProviderException(String provider, String message, String rawResponse, Throwable cause) {
        this(provider, message, rawResponse, cause, -1, false);
    }

    public AiProviderException(
            String provider,
            String message,
            String rawResponse,
            int statusCode,
            boolean retryable) {
        this(provider, message, rawResponse, null, statusCode, retryable);
    }

    public AiProviderException(
            String provider,
            String message,
            String rawResponse,
            Throwable cause,
            int statusCode,
            boolean retryable) {
        super(message, cause);
        this.provider = provider;
        this.rawResponse = rawResponse;
        this.statusCode = statusCode;
        this.retryable = retryable;
    }

    public String getProvider() {
        return provider;
    }

    public String getRawResponse() {
        return rawResponse;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public boolean isRetryable() {
        return retryable;
    }

    public String getFullDetails() {
        return "Provider: " + provider
                + " | Message: " + getMessage()
                + " | Status Code: " + statusCode
                + " | Retryable: " + retryable
                + " | Raw Response: " + rawResponse;
    }
}
