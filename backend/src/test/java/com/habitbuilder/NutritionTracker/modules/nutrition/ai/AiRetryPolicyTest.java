package com.habitbuilder.NutritionTracker.modules.nutrition.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.slf4j.helpers.NOPLogger;

/**
 * Characterisation tests for the retry engine every AI text client shares.
 *
 * <p>Both provider keyword sets are exercised, because that list is the one genuinely
 * provider-specific input to the policy and the whole point of the extraction was that
 * nothing else differs between Gemini and Groq.
 */
class AiRetryPolicyTest {

    /**
     * Copies of the provider lists. The originals are {@code private static final} inside
     * {@code GeminiService} and {@code GroqService}, so a test cannot reference them; if a
     * provider's phrasing changes, this copy has to change with it.
     */
    private static final List<String> GEMINI_KEYWORDS = List.of(
            "high demand",
            "unavailable",
            "resource exhausted",
            "\"code\":503",
            "\"code\": 503",
            "\"code\":429",
            "\"code\": 429");

    private static final List<String> GROQ_KEYWORDS = List.of(
            "rate limit",
            "too many requests",
            "temporarily unavailable",
            "service unavailable",
            "overloaded",
            "\"code\":\"rate_limit_exceeded\"",
            "\"code\":429",
            "\"code\": 429");

    /** The values the properties record binds by default. */
    private static final AiRetryProperties BOUND_DEFAULTS = new AiRetryProperties(3, 700, 3000);

    /**
     * Backoff pinned at the record's 100 ms floor so the retry loop's real
     * {@code Thread.sleep} stays in the low hundreds of milliseconds.
     */
    private static AiRetryProperties fastRetries(int maxAttempts) {
        return new AiRetryProperties(maxAttempts, 100, 100);
    }

    private static AiRetryPolicy geminiPolicy(AiRetryProperties properties) {
        return new AiRetryPolicy(
                "Gemini",
                NOPLogger.NOP_LOGGER,
                properties,
                GEMINI_KEYWORDS,
                GeminiApiException::new);
    }

    private static AiRetryPolicy groqPolicy(AiRetryProperties properties) {
        return new AiRetryPolicy(
                "Groq",
                NOPLogger.NOP_LOGGER,
                properties,
                GROQ_KEYWORDS,
                (message, rawResponse, cause, statusCode, retryable) -> new AiProviderException(
                        "groq", message, rawResponse, cause, statusCode, retryable));
    }

    // --- AiRetryProperties clamping -------------------------------------------------------

    @Test
    void clampsMaxAttemptsToAtLeastOne() {
        assertEquals(1, new AiRetryProperties(0, 700, 3000).maxAttempts());
        assertEquals(1, new AiRetryProperties(-5, 700, 3000).maxAttempts());
    }

    @Test
    void clampsInitialBackoffToItsHundredMillisecondFloor() {
        assertEquals(100, new AiRetryProperties(3, 0, 3000).initialBackoffMs());
        assertEquals(100, new AiRetryProperties(3, -1, 3000).initialBackoffMs());
    }

    @Test
    void raisesMaxBackoffToAtLeastTheInitialBackoff() {
        assertEquals(700, new AiRetryProperties(3, 700, 200).maxBackoffMs());

        // The initial value is floored first, so the maximum is raised to the *clamped* 100.
        AiRetryProperties bothTooSmall = new AiRetryProperties(3, 50, 10);
        assertEquals(100, bothTooSmall.initialBackoffMs());
        assertEquals(100, bothTooSmall.maxBackoffMs());
    }

    @Test
    void leavesASensibleConfigurationUntouched() {
        AiRetryProperties properties = new AiRetryProperties(5, 250, 9000);

        assertEquals(5, properties.maxAttempts());
        assertEquals(250, properties.initialBackoffMs());
        assertEquals(9000, properties.maxBackoffMs());
    }

    @Test
    void exposesTheConfiguredAttemptCount() {
        assertEquals(3, geminiPolicy(BOUND_DEFAULTS).maxAttempts());
    }

    // --- computeBackoffMs ------------------------------------------------------------------

    @Test
    void doublesTheBackoffOnEachAttempt() {
        AiRetryPolicy policy = geminiPolicy(new AiRetryProperties(3, 700, 30000));

        assertEquals(700, policy.computeBackoffMs(1));
        assertEquals(1400, policy.computeBackoffMs(2));
        assertEquals(2800, policy.computeBackoffMs(3));

        // The shift distance is floored at 0, so attempt 0 cannot produce a negative shift.
        assertEquals(700, policy.computeBackoffMs(0));
    }

    @Test
    void clampsTheBackoffAtTheConfiguredMaximum() {
        AiRetryPolicy policy = geminiPolicy(BOUND_DEFAULTS);

        assertEquals(2800, policy.computeBackoffMs(3));
        assertEquals(3000, policy.computeBackoffMs(4));
        assertEquals(3000, policy.computeBackoffMs(9));
    }

    @Test
    void fallsBackToTheMaximumWhenTheShiftOverflowsIntoTheSignBit() {
        long hugeInitialBackoff = 1L << 62;
        // maxBackoffMs is raised to the initial value by the record's clamp.
        AiRetryPolicy policy = geminiPolicy(new AiRetryProperties(3, hugeInitialBackoff, 100));

        // Attempt 2 shifts by one, landing on Long.MIN_VALUE.
        long backoff = policy.computeBackoffMs(2);

        assertTrue(backoff > 0);
        assertEquals(hugeInitialBackoff, backoff);
    }

    /**
     * Pins current behaviour, not behaviour worth keeping: shifting every bit off the top of
     * the long yields exactly 0, which is not negative, so the overflow guard does not fire
     * and the loop retries with no delay at all. Recorded as-is.
     */
    @Test
    void answersZeroBackoffWhenTheShiftDiscardsEveryBit() {
        AiRetryPolicy policy = geminiPolicy(new AiRetryProperties(3, 1L << 62, 100));

        assertEquals(0, policy.computeBackoffMs(3));
    }

    // --- isRetryableStatusCode ---------------------------------------------------------------

    @Test
    void treatsThrottlingAndGatewayStatusesAsRetryable() {
        AiRetryPolicy policy = geminiPolicy(BOUND_DEFAULTS);

        assertTrue(policy.isRetryableStatusCode(429));
        assertTrue(policy.isRetryableStatusCode(500));
        assertTrue(policy.isRetryableStatusCode(502));
        assertTrue(policy.isRetryableStatusCode(503));
        assertTrue(policy.isRetryableStatusCode(504));
    }

    @Test
    void treatsSuccessAndClientErrorsAsNotRetryable() {
        AiRetryPolicy policy = geminiPolicy(BOUND_DEFAULTS);

        assertFalse(policy.isRetryableStatusCode(200));
        assertFalse(policy.isRetryableStatusCode(400));
        assertFalse(policy.isRetryableStatusCode(401));
        assertFalse(policy.isRetryableStatusCode(404));

        // -1 is the "no HTTP response" sentinel the policy itself sets.
        assertFalse(policy.isRetryableStatusCode(-1));
    }

    // --- isRetryableErrorBody, both keyword sets ---------------------------------------------

    @Test
    void matchesGeminisOwnOverloadAndQuotaPhrasing() {
        AiRetryPolicy policy = geminiPolicy(BOUND_DEFAULTS);

        assertTrue(policy.isRetryableErrorBody(
                "{\"error\":{\"code\":503,\"message\":\"The model is overloaded.\",\"status\":\"UNAVAILABLE\"}}"));
        assertTrue(policy.isRetryableErrorBody(
                "{\"error\":{\"code\":429,\"message\":\"Quota exceeded\"}}"));
        assertTrue(policy.isRetryableErrorBody("The model is experiencing high demand."));
    }

    @Test
    void matchesGroqsOwnRateLimitPhrasing() {
        AiRetryPolicy policy = groqPolicy(BOUND_DEFAULTS);

        assertTrue(policy.isRetryableErrorBody(
                "{\"error\":{\"message\":\"Rate limit reached for model\",\"code\":\"rate_limit_exceeded\"}}"));
        assertTrue(policy.isRetryableErrorBody("Too many requests"));
        assertTrue(policy.isRetryableErrorBody("The service is temporarily unavailable"));
        assertTrue(policy.isRetryableErrorBody("upstream is overloaded"));
    }

    /**
     * The two sets are genuinely different, not two names for the same list: each of these
     * bodies is transient for one provider and unrecognised by the other.
     */
    @Test
    void keepsTheTwoProviderKeywordSetsDistinct() {
        AiRetryPolicy gemini = geminiPolicy(BOUND_DEFAULTS);
        AiRetryPolicy groq = groqPolicy(BOUND_DEFAULTS);

        String geminiOnly = "{\"error\":{\"code\":503,\"message\":\"The model is experiencing high demand.\"}}";
        assertTrue(gemini.isRetryableErrorBody(geminiOnly));
        assertFalse(groq.isRetryableErrorBody(geminiOnly));

        String groqOnly = "{\"error\":{\"message\":\"Rate limit reached\",\"code\":\"rate_limit_exceeded\"}}";
        assertTrue(groq.isRetryableErrorBody(groqOnly));
        assertFalse(gemini.isRetryableErrorBody(groqOnly));
    }

    @Test
    void sharesTheQuotaStatusCodeKeywordAcrossBothProviders() {
        String spacedQuotaCode = "{\"error\":{\"code\": 429,\"status\":\"RESOURCE_EXHAUSTED\"}}";

        assertTrue(geminiPolicy(BOUND_DEFAULTS).isRetryableErrorBody(spacedQuotaCode));
        assertTrue(groqPolicy(BOUND_DEFAULTS).isRetryableErrorBody(spacedQuotaCode));
    }

    @Test
    void matchesKeywordsRegardlessOfCase() {
        assertTrue(geminiPolicy(BOUND_DEFAULTS).isRetryableErrorBody("Resource Exhausted: quota gone"));
        assertTrue(groqPolicy(BOUND_DEFAULTS).isRetryableErrorBody("TOO MANY REQUESTS"));
    }

    @Test
    void ignoresNullBlankAndUnrecognisedBodies() {
        AiRetryPolicy gemini = geminiPolicy(BOUND_DEFAULTS);
        AiRetryPolicy groq = groqPolicy(BOUND_DEFAULTS);

        assertFalse(gemini.isRetryableErrorBody(null));
        assertFalse(gemini.isRetryableErrorBody(""));
        assertFalse(gemini.isRetryableErrorBody("   "));
        assertFalse(gemini.isRetryableErrorBody("{\"error\":{\"code\":400,\"message\":\"API key not valid\"}}"));

        assertFalse(groq.isRetryableErrorBody(null));
        assertFalse(groq.isRetryableErrorBody("   "));
        assertFalse(groq.isRetryableErrorBody("{\"error\":{\"code\":401,\"message\":\"Invalid API Key\"}}"));
    }

    // --- isRetryable(AiProviderException) -----------------------------------------------------

    @Test
    void treatsANullExceptionAsNotRetryable() {
        assertFalse(geminiPolicy(BOUND_DEFAULTS).isRetryable(null));
    }

    @Test
    void retriesOnTheExceptionsOwnRetryableFlag() {
        AiProviderException flagged = new AiProviderException("gemini", "transient", null, -1, true);

        assertTrue(geminiPolicy(BOUND_DEFAULTS).isRetryable(flagged));
    }

    @Test
    void retriesOnARetryableStatusCodeEvenWhenTheFlagIsFalse() {
        AiProviderException overloaded = new AiProviderException("gemini", "overloaded", null, 503, false);

        assertTrue(geminiPolicy(BOUND_DEFAULTS).isRetryable(overloaded));
    }

    @Test
    void retriesOnARetryableBodyEvenWhenTheFlagAndStatusSayOtherwise() {
        AiProviderException disguised = new AiProviderException(
                "gemini", "bad request", "The model is experiencing high demand.", 400, false);

        assertTrue(geminiPolicy(BOUND_DEFAULTS).isRetryable(disguised));
    }

    @Test
    void doesNotRetryAnExceptionWithNothingTransientAboutIt() {
        AiProviderException fatal = new AiProviderException(
                "gemini", "bad request", "{\"error\":{\"code\":400,\"message\":\"API key not valid\"}}", 400, false);

        assertFalse(geminiPolicy(BOUND_DEFAULTS).isRetryable(fatal));
    }

    // --- isRetryableTransportException --------------------------------------------------------

    @Test
    void findsATimeoutExceptionBuriedInTheCauseChain() {
        Throwable buried = new RuntimeException(
                "call failed",
                new IllegalStateException(
                        "reactive pipeline aborted",
                        new TimeoutException("no signal")));

        assertTrue(AiRetryPolicy.isRetryableTransportException(buried));
    }

    @Test
    void findsTimeoutWordingAtAnyDepthOfTheChain() {
        assertTrue(AiRetryPolicy.isRetryableTransportException(
                new IllegalStateException("Connection timed out after 30000 ms")));
        assertTrue(AiRetryPolicy.isRetryableTransportException(
                new RuntimeException("call failed", new IllegalStateException("read timeout on channel"))));
    }

    @Test
    void rejectsAnUnrelatedCauseChain() {
        Throwable unrelated = new IllegalArgumentException(
                "prompt was empty",
                new NullPointerException());

        assertFalse(AiRetryPolicy.isRetryableTransportException(unrelated));
    }

    @Test
    void rejectsANullThrowable() {
        assertFalse(AiRetryPolicy.isRetryableTransportException(null));
    }

    // --- execute ------------------------------------------------------------------------------

    @Test
    void callsTheSupplierOnceWhenItSucceeds() {
        AiRetryPolicy policy = geminiPolicy(fastRetries(3));
        AtomicInteger calls = new AtomicInteger();

        String result = policy.execute(() -> {
            calls.incrementAndGet();
            return "first try";
        });

        assertEquals("first try", result);
        assertEquals(1, calls.get());
    }

    /** The one that matters: a fatal provider error must not be paid for three times. */
    @Test
    void doesNotRetryANonRetryableProviderException() {
        AiRetryPolicy policy = geminiPolicy(fastRetries(3));
        AiProviderException fatal = new AiProviderException(
                "gemini", "bad request", "API key not valid", 400, false);
        AtomicInteger calls = new AtomicInteger();

        AiProviderException thrown = assertThrows(AiProviderException.class, () -> policy.execute(() -> {
            calls.incrementAndGet();
            throw fatal;
        }));

        assertSame(fatal, thrown);
        assertEquals(1, calls.get());
    }

    @Test
    void retriesARetryableProviderExceptionUpToMaxAttemptsAndRethrowsTheOriginal() {
        AiRetryPolicy policy = geminiPolicy(fastRetries(3));
        AiProviderException overloaded = new AiProviderException("gemini", "overloaded", null, 503, false);
        AtomicInteger calls = new AtomicInteger();

        AiProviderException thrown = assertThrows(AiProviderException.class, () -> policy.execute(() -> {
            calls.incrementAndGet();
            throw overloaded;
        }));

        // Rethrown unwrapped, so the caller still sees the provider's own status and body.
        assertSame(overloaded, thrown);
        assertEquals(3, calls.get());
    }

    @Test
    void returnsTheSuccessThatFollowsARetryableFailure() {
        AiRetryPolicy policy = geminiPolicy(fastRetries(3));
        AtomicInteger calls = new AtomicInteger();

        String result = policy.execute(() -> {
            if (calls.incrementAndGet() == 1) {
                throw new AiProviderException("gemini", "rate limited", null, 429, false);
            }
            return "recovered";
        });

        assertEquals("recovered", result);
        assertEquals(2, calls.get());
    }

    @Test
    void wrapsAnExhaustedTransportFailureInTheProvidersOwnException() {
        AiRetryPolicy policy = geminiPolicy(fastRetries(2));
        IllegalStateException transportFailure = new IllegalStateException("Connection timed out");
        AtomicInteger calls = new AtomicInteger();

        GeminiApiException thrown = assertThrows(GeminiApiException.class, () -> policy.execute(() -> {
            calls.incrementAndGet();
            throw transportFailure;
        }));

        assertEquals(2, calls.get());
        assertEquals("gemini", thrown.getProvider());
        assertEquals("Transient Gemini transport error after retries: Connection timed out", thrown.getMessage());
        assertEquals("No response received", thrown.getRawResponse());
        assertEquals(-1, thrown.getStatusCode());
        assertTrue(thrown.isRetryable());
        assertSame(transportFailure, thrown.getCause());
    }

    @Test
    void doesNotRetryARuntimeExceptionThatIsNotATransportFailure() {
        AiRetryPolicy policy = geminiPolicy(fastRetries(3));
        IllegalStateException fatal = new IllegalStateException("prompt template missing");
        AtomicInteger calls = new AtomicInteger();

        IllegalStateException thrown = assertThrows(IllegalStateException.class, () -> policy.execute(() -> {
            calls.incrementAndGet();
            throw fatal;
        }));

        assertSame(fatal, thrown);
        assertEquals(1, calls.get());
    }
}
