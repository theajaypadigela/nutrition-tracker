package com.habitbuilder.NutritionTracker.modules.nutrition.ai;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.Supplier;

import org.slf4j.Logger;

import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiProviderException;

/**
 * The retry engine every AI text client shares: which failures are worth another attempt,
 * how long to wait between them, and the attempt loop itself.
 *
 * <p>A provider supplies exactly three things — the keyword set that marks its error bodies
 * as transient, a factory for its own {@link AiProviderException} subtype, and the logger the
 * warnings should be attributed to. Everything else (status codes, transport-exception
 * walking, exponential backoff) is identical across providers by design: a retry-policy fix
 * belongs in one place.
 */
public final class AiRetryPolicy {

    /**
     * Builds the provider's own exception type for the failures the policy raises itself
     * (transport exhaustion, interruption, attempts used up).
     */
    public interface ExceptionFactory {
        AiProviderException create(String message, String rawResponse, Throwable cause, int statusCode,
                boolean retryable);
    }

    private static final Set<Integer> RETRYABLE_STATUS_CODES = Set.of(429, 500, 502, 503, 504);

    private final String providerLabel;
    private final Logger logger;
    private final AiRetryProperties properties;
    private final List<String> retryableBodyKeywords;
    private final ExceptionFactory exceptionFactory;

    /**
     * @param providerLabel human-readable provider name used in log and exception messages
     *                      (e.g. {@code "Gemini"})
     * @param logger        the provider's logger, so retry warnings keep their existing
     *                      logging category
     */
    public AiRetryPolicy(String providerLabel,
            Logger logger,
            AiRetryProperties properties,
            List<String> retryableBodyKeywords,
            ExceptionFactory exceptionFactory) {
        this.providerLabel = providerLabel;
        this.logger = logger;
        this.properties = properties;
        this.retryableBodyKeywords = List.copyOf(retryableBodyKeywords);
        this.exceptionFactory = exceptionFactory;
    }

    public int maxAttempts() {
        return properties.maxAttempts();
    }

    /**
     * Runs {@code call}, retrying transient failures up to {@link #maxAttempts()} times.
     * Non-retryable failures propagate unchanged on the first attempt.
     */
    public <T> T execute(Supplier<T> call) {
        int maxAttempts = properties.maxAttempts();

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return call.get();
            } catch (AiProviderException e) {
                if (!isRetryable(e) || attempt >= maxAttempts) {
                    throw e;
                }

                long backoffMs = computeBackoffMs(attempt);
                logger.warn(
                        "{} API transient failure on attempt {}/{} (statusCode={}). Retrying in {} ms",
                        providerLabel, attempt, maxAttempts, e.getStatusCode(), backoffMs);
                sleepBeforeRetry(backoffMs);
            } catch (RuntimeException e) {
                if (!isRetryableTransportException(e)) {
                    throw e;
                }
                if (attempt >= maxAttempts) {
                    throw exceptionFactory.create(
                            "Transient " + providerLabel + " transport error after retries: " + e.getMessage(),
                            "No response received",
                            e,
                            -1,
                            true);
                }

                long backoffMs = computeBackoffMs(attempt);
                logger.warn(
                        "{} transport failure on attempt {}/{} ({}). Retrying in {} ms",
                        providerLabel, attempt, maxAttempts, e.getClass().getSimpleName(), backoffMs);
                sleepBeforeRetry(backoffMs);
            }
        }

        throw exceptionFactory.create(
                "Failed to call " + providerLabel + " API after retries",
                "No response received",
                null,
                -1,
                false);
    }

    /** True for the status codes that indicate an overloaded or briefly broken provider. */
    public boolean isRetryableStatusCode(int statusCode) {
        return RETRYABLE_STATUS_CODES.contains(statusCode);
    }

    /**
     * True when the provider's error body names a transient condition. This is the one
     * genuinely provider-specific part of the policy: each provider words rate limiting and
     * overload differently.
     */
    public boolean isRetryableErrorBody(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }

        String normalized = body.toLowerCase(Locale.ROOT);
        return retryableBodyKeywords.stream().anyMatch(normalized::contains);
    }

    public boolean isRetryable(AiProviderException exception) {
        if (exception == null) {
            return false;
        }

        return exception.isRetryable()
                || isRetryableStatusCode(exception.getStatusCode())
                || isRetryableErrorBody(exception.getRawResponse());
    }

    /**
     * Walks the cause chain for a timeout or a connection-level failure. Reactor buries the
     * real cause several levels down, so a top-level {@code instanceof} check is not enough.
     */
    public static boolean isRetryableTransportException(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof java.util.concurrent.TimeoutException
                    || current instanceof org.springframework.web.reactive.function.client.WebClientRequestException) {
                return true;
            }

            String message = current.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase(Locale.ROOT);
                if (normalized.contains("timed out") || normalized.contains("timeout")) {
                    return true;
                }
            }
            current = current.getCause();
        }
        return false;
    }

    /** Exponential backoff from the initial delay, clamped to the configured maximum. */
    public long computeBackoffMs(int attempt) {
        long exponentialBackoff = properties.initialBackoffMs() << Math.max(0, attempt - 1);
        if (exponentialBackoff < 0) {
            exponentialBackoff = properties.maxBackoffMs();
        }
        return Math.min(exponentialBackoff, properties.maxBackoffMs());
    }

    private void sleepBeforeRetry(long backoffMs) {
        try {
            Thread.sleep(backoffMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw exceptionFactory.create(providerLabel + " retry interrupted", "Retry interrupted", e, -1, true);
        }
    }
}
