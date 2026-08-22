package com.habitbuilder.NutritionTracker.modules.voice;

/**
 * A transcript could not be turned into food entries. Wraps the underlying failure rather
 * than replacing it, because the controller walks the cause chain to tell a transient AI
 * outage (answer 503, the client retries) apart from a genuine internal error.
 */
public class VoiceTranscriptProcessingException extends RuntimeException {

    public VoiceTranscriptProcessingException(String message, Throwable cause) {
        super(message, cause);
    }
}
