package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

@Service
public class GroqService implements AiTextClient {

    private static final Logger logger = LoggerFactory.getLogger(GroqService.class);
    private static final String PROVIDER_NAME = "groq";

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String groqApiKey;
    private final String groqApiUrl;
    private final String groqModel;
    private final long timeout;
    private final int maxRetryAttempts;
    private final long retryInitialBackoffMs;
    private final long retryMaxBackoffMs;

    public GroqService(
            WebClient.Builder webClientBuilder,
            ObjectMapper objectMapper,
            @Value("${groq.api.key:}") String groqApiKey,
            @Value("${groq.api.url:https://api.groq.com/openai/v1/chat/completions}") String groqApiUrl,
            @Value("${groq.api.model:llama-3.1-8b-instant}") String groqModel,
            @Value("${groq.api.timeout:55000}") long timeout,
            @Value("${groq.api.retry.max-attempts:3}") int maxRetryAttempts,
            @Value("${groq.api.retry.initial-backoff-ms:700}") long retryInitialBackoffMs,
            @Value("${groq.api.retry.max-backoff-ms:3000}") long retryMaxBackoffMs) {
        this.objectMapper = objectMapper;
        this.groqApiKey = sanitizeApiKey(groqApiKey);
        this.groqApiUrl = groqApiUrl == null ? "" : groqApiUrl.trim();
        this.groqModel = groqModel == null ? "" : groqModel.trim();
        this.timeout = timeout;
        this.maxRetryAttempts = Math.max(1, maxRetryAttempts);
        this.retryInitialBackoffMs = Math.max(100, retryInitialBackoffMs);
        this.retryMaxBackoffMs = Math.max(this.retryInitialBackoffMs, retryMaxBackoffMs);

        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10000)
                .option(ChannelOption.SO_KEEPALIVE, true)
                .responseTimeout(Duration.ofMillis(timeout))
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(timeout, TimeUnit.MILLISECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(30000, TimeUnit.MILLISECONDS)));

        this.webClient = webClientBuilder
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public String callRawPrompt(String prompt) {
        try {
            logger.info("Calling Groq API with prompt (length={}) using model {}", prompt.length(), groqModel);
            String rawResponse = callGroqApi(prompt);
            return extractTextFromGroqResponse(rawResponse);
        } catch (AiProviderException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error calling Groq API: {}", e.getMessage(), e);
            throw new AiProviderException(
                    PROVIDER_NAME,
                    "Failed to call Groq API: " + e.getMessage(),
                    "No response received",
                    e);
        }
    }

    private String callGroqApi(String prompt) {
        validateGroqConfiguration();
        Map<String, Object> requestBody = buildGroqRequestBody(prompt);

        for (int attempt = 1; attempt <= maxRetryAttempts; attempt++) {
            try {
                return callGroqApiOnce(requestBody);
            } catch (AiProviderException e) {
                if (!isRetryableGroqError(e) || attempt >= maxRetryAttempts) {
                    throw e;
                }

                long backoffMs = computeBackoffMs(attempt);
                logger.warn(
                        "Groq API transient failure on attempt {}/{} (statusCode={}). Retrying in {} ms",
                        attempt, maxRetryAttempts, e.getStatusCode(), backoffMs);
                sleepBeforeRetry(backoffMs);
            } catch (Exception e) {
                if (!isRetryableTransportException(e)) {
                    throw e;
                }
                if (attempt >= maxRetryAttempts) {
                    throw new AiProviderException(
                            PROVIDER_NAME,
                            "Transient Groq transport error after retries: " + e.getMessage(),
                            "No response received",
                            e,
                            -1,
                            true);
                }

                long backoffMs = computeBackoffMs(attempt);
                logger.warn(
                        "Groq transport failure on attempt {}/{} ({}). Retrying in {} ms",
                        attempt, maxRetryAttempts, e.getClass().getSimpleName(), backoffMs);
                sleepBeforeRetry(backoffMs);
            }
        }

        throw new AiProviderException(PROVIDER_NAME, "Failed to call Groq API after retries", "No response received");
    }

    private Map<String, Object> buildGroqRequestBody(String prompt) {
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("model", groqModel);
        requestBody.put("messages", List.of(Map.of("role", "user", "content", prompt)));
        requestBody.put("temperature", 0.1);
        return requestBody;
    }

    private String callGroqApiOnce(Map<String, Object> requestBody) {
        return webClient.post()
                .uri(groqApiUrl)
                .header("Authorization", "Bearer " + groqApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        clientResponse -> clientResponse.bodyToMono(String.class)
                                .defaultIfEmpty("No response body")
                                .flatMap(body -> {
                                    int statusCode = clientResponse.statusCode().value();
                                    boolean retryable = isRetryableStatusCode(statusCode)
                                            || isRetryableErrorBody(body);
                                    logger.error("Groq API error response (status={}): {}", statusCode, body);
                                    return Mono.error(new AiProviderException(
                                            PROVIDER_NAME,
                                            "API Error",
                                            body,
                                            statusCode,
                                            retryable));
                                }))
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeout))
                .block(Duration.ofMillis(timeout + 5000));
    }

    private String extractTextFromGroqResponse(String rawResponse) {
        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new AiProviderException(PROVIDER_NAME, "Invalid Groq response: no choices found", rawResponse);
            }

            JsonNode contentNode = choices.get(0).path("message").path("content");
            if (contentNode.isTextual()) {
                return contentNode.asText();
            }

            if (contentNode.isArray()) {
                StringBuilder builder = new StringBuilder();
                for (JsonNode part : contentNode) {
                    String text = part.path("text").asText("");
                    if (!text.isBlank()) {
                        if (builder.length() > 0) {
                            builder.append('\n');
                        }
                        builder.append(text);
                    }
                }
                if (builder.length() > 0) {
                    return builder.toString();
                }
            }

            throw new AiProviderException(PROVIDER_NAME, "Invalid Groq response: no message content found", rawResponse);
        } catch (AiProviderException e) {
            throw e;
        } catch (Exception e) {
            throw new AiProviderException(
                    PROVIDER_NAME,
                    "Failed to extract text from Groq response: " + e.getMessage(),
                    rawResponse,
                    e);
        }
    }

    private boolean isRetryableStatusCode(int statusCode) {
        return statusCode == 429
                || statusCode == 500
                || statusCode == 502
                || statusCode == 503
                || statusCode == 504;
    }

    private boolean isRetryableErrorBody(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }

        String normalized = body.toLowerCase(Locale.ROOT);
        return normalized.contains("rate limit")
                || normalized.contains("too many requests")
                || normalized.contains("temporarily unavailable")
                || normalized.contains("service unavailable")
                || normalized.contains("overloaded")
                || normalized.contains("\"code\":\"rate_limit_exceeded\"")
                || normalized.contains("\"code\":429")
                || normalized.contains("\"code\": 429");
    }

    private boolean isRetryableGroqError(AiProviderException exception) {
        if (exception == null) {
            return false;
        }

        return exception.isRetryable()
                || isRetryableStatusCode(exception.getStatusCode())
                || isRetryableErrorBody(exception.getRawResponse());
    }

    private boolean isRetryableTransportException(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof java.util.concurrent.TimeoutException
                    || current instanceof WebClientRequestException) {
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

    private long computeBackoffMs(int attempt) {
        long exponentialBackoff = retryInitialBackoffMs << Math.max(0, attempt - 1);
        if (exponentialBackoff < 0) {
            exponentialBackoff = retryMaxBackoffMs;
        }
        return Math.min(exponentialBackoff, retryMaxBackoffMs);
    }

    private void sleepBeforeRetry(long backoffMs) {
        try {
            Thread.sleep(backoffMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AiProviderException(PROVIDER_NAME, "Groq retry interrupted", "Retry interrupted", e, -1, true);
        }
    }

    private void validateGroqConfiguration() {
        if (groqApiKey.isBlank()) {
            throw new AiProviderException(PROVIDER_NAME, "Groq API key is not configured", "No request sent");
        }
        if (groqApiUrl.isBlank()) {
            throw new AiProviderException(PROVIDER_NAME, "Groq API URL is not configured", "No request sent");
        }
        if (groqModel.isBlank()) {
            throw new AiProviderException(PROVIDER_NAME, "Groq model is not configured", "No request sent");
        }
    }

    private String sanitizeApiKey(String rawKey) {
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
