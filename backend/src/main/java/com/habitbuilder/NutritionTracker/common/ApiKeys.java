package com.habitbuilder.NutritionTracker.common;

/**
 * Normalises API keys and tokens as they arrive from the environment. Keys are routinely
 * pasted with a {@code Bearer } prefix or wrapped in the quotes a shell or {@code .env}
 * file left behind; every credential read from configuration goes through here so a
 * cosmetic difference in how the value was pasted never becomes an auth failure.
 */
public final class ApiKeys {

    private ApiKeys() {
    }

    /** Returns {@code rawKey} trimmed, without a {@code Bearer } prefix or surrounding quotes. */
    public static String sanitize(String rawKey) {
        if (rawKey == null) {
            return "";
        }

        String key = rawKey.trim();
        if (key.startsWith("Bearer ")) {
            key = key.substring("Bearer ".length()).trim();
        }
        if ((key.startsWith("\"") && key.endsWith("\"")) || (key.startsWith("'") && key.endsWith("'"))) {
            key = key.substring(1, key.length() - 1).trim();
        }
        return key;
    }
}
