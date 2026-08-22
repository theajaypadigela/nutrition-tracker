package com.habitbuilder.NutritionTracker.modules.voice.idempotency;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;

/**
 * Derives the dedup key for a transcript. Scoped by user and log date so the same words
 * spoken on two different days are two different meals, and hashed so an arbitrarily long
 * transcript becomes a fixed-size key.
 */
public final class TranscriptFingerprint {

    private TranscriptFingerprint() {
    }

    public static String of(String userId, LocalDate logDate, String normalizedTranscript) {
        return userId + ":" + logDate + ":" + sha256(normalizedTranscript);
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }
}
