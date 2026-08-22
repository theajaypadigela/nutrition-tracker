package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.common.ApiKeys;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiRetryPolicy;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiRetryProperties;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiWebClients;

import reactor.core.publisher.Mono;

@Service
public class GroqService implements AiTextClient {

    private static final Logger logger = LoggerFactory.getLogger(GroqService.class);
    private static final String PROVIDER_NAME = "groq";
    private static final String PROVIDER_LABEL = "Groq";

    /** Phrases Groq uses for rate limiting and overload; see AiRetryPolicy. */
    private static final List<String> RETRYABLE_BODY_KEYWORDS = List.of(
            "rate limit",
            "too many requests",
            "temporarily unavailable",
            "service unavailable",
            "overloaded",
            "\"code\":\"rate_limit_exceeded\"",
            "\"code\":429",
            "\"code\": 429");

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String groqApiKey;
    private final String groqApiUrl;
    private final String groqModel;
    private final long timeout;
    private final AiRetryPolicy retryPolicy;

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
        this.groqApiKey = ApiKeys.sanitize(groqApiKey);
        this.groqApiUrl = groqApiUrl == null ? "" : groqApiUrl.trim();
        this.groqModel = groqModel == null ? "" : groqModel.trim();
        this.timeout = timeout;
        this.retryPolicy = new AiRetryPolicy(
                PROVIDER_LABEL,
                logger,
                new AiRetryProperties(maxRetryAttempts, retryInitialBackoffMs, retryMaxBackoffMs),
                RETRYABLE_BODY_KEYWORDS,
                (message, rawResponse, cause, statusCode, retryable) -> new AiProviderException(
                        PROVIDER_NAME, message, rawResponse, cause, statusCode, retryable));
        this.webClient = AiWebClients.timeoutBounded(webClientBuilder, timeout);
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
        return retryPolicy.execute(() -> callGroqApiOnce(requestBody));
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
                                    boolean retryable = retryPolicy.isRetryableStatusCode(statusCode)
                                            || retryPolicy.isRetryableErrorBody(body);
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
}
