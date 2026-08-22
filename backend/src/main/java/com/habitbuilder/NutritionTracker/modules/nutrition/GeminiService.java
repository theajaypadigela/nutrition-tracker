package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.common.ApiKeys;
import com.habitbuilder.NutritionTracker.config.properties.GeminiProperties;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiRetryPolicy;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiWebClients;

import reactor.core.publisher.Mono;

@Service
public class GeminiService implements AiTextClient {

    private static final Logger logger = LoggerFactory.getLogger(GeminiService.class);
    private static final String PROVIDER_NAME = "gemini";
    private static final String PROVIDER_LABEL = "Gemini";

    /** Phrases Gemini uses for quota exhaustion and overload; see AiRetryPolicy. */
    private static final List<String> RETRYABLE_BODY_KEYWORDS = List.of(
            "high demand",
            "unavailable",
            "resource exhausted",
            "\"code\":503",
            "\"code\": 503",
            "\"code\":429",
            "\"code\": 429");

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String geminiApiKey;
    private final String geminiModel;
    private final long timeout;
    private final AiRetryPolicy retryPolicy;

    public GeminiService(
            WebClient.Builder webClientBuilder,
            ObjectMapper objectMapper,
            GeminiProperties properties) {
        this.geminiApiKey = ApiKeys.sanitize(properties.key());
        this.geminiModel = properties.model() == null ? "" : properties.model().trim();
        this.timeout = properties.timeout();
        this.retryPolicy = new AiRetryPolicy(
                PROVIDER_LABEL,
                logger,
                properties.retry(),
                RETRYABLE_BODY_KEYWORDS,
                GeminiApiException::new);
        this.webClient = AiWebClients.timeoutBounded(webClientBuilder, this.timeout);
        this.objectMapper = objectMapper;
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    private String getGeminiUrl() {
        return "https://generativelanguage.googleapis.com/v1beta/models/" + geminiModel
                + ":generateContent";
    }

    private Map<String, Object> buildGeminiRequestBody(String prompt) {
        return Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of("temperature", 0.1));
    }

    /**
     * Extracts the text content from a Gemini API response.
     * Gemini response structure: candidates[0].content.parts[0].text
     */
    private String extractTextFromGeminiResponse(String rawResponse) {
        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            JsonNode candidates = root.path("candidates");
            if (candidates.isEmpty() || !candidates.isArray()) {
                throw new GeminiApiException("Invalid Gemini response: no candidates found", rawResponse);
            }
            JsonNode content = candidates.get(0).path("content");
            if (content.isMissingNode()) {
                throw new GeminiApiException("Invalid Gemini response: no content found", rawResponse);
            }
            JsonNode parts = content.path("parts");
            if (parts.isEmpty() || !parts.isArray()) {
                throw new GeminiApiException("Invalid Gemini response: no parts found", rawResponse);
            }
            return parts.get(0).path("text").asText();
        } catch (GeminiApiException e) {
            throw e;
        } catch (Exception e) {
            throw new GeminiApiException("Failed to extract text from Gemini response: " + e.getMessage(),
                    rawResponse, e);
        }
    }

    /**
     * Calls Gemini API with the given prompt and returns the full raw API response.
     */
    private String callGeminiApi(String prompt) {
        validateGeminiConfiguration();
        Map<String, Object> requestBody = buildGeminiRequestBody(prompt);
        return retryPolicy.execute(() -> callGeminiApiOnce(requestBody));
    }

    private String callGeminiApiOnce(Map<String, Object> requestBody) {
        return webClient.post()
                .uri(getGeminiUrl())
                .header("x-goog-api-key", geminiApiKey)
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
                                    logger.error("Gemini API error response (status={}): {}", statusCode, body);
                                    return Mono.error(new GeminiApiException("API Error", body, statusCode, retryable));
                                }))
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(timeout))
                .block(Duration.ofMillis(timeout + 5000));
    }

    public NutritionResponse getNutritionInfo(String foodName, double quantity, String unit) {
        String prompt = buildPrompt(foodName, quantity, unit);
        String rawResponse = null;

        try {
            logger.info("Calling Gemini API for: {} {} {}", foodName, quantity, unit);

            rawResponse = callGeminiApi(prompt);

            logger.info("Gemini API response received: {}", rawResponse);
            return parseNutritionResponse(rawResponse);
        } catch (GeminiApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error calling Gemini API for food: {} {} {} - Error: {}", foodName, quantity, unit,
                    e.getMessage(), e);
            throw new GeminiApiException("Failed to get nutrition info: " + e.getMessage(),
                    rawResponse != null ? rawResponse : "No response received", e);
        }
    }

    /**
     * Calls Gemini API and returns the raw response string without any parsing.
     */
    public String getRawNutritionResponse(String foodName, double quantity, String unit) {
        String prompt = buildPrompt(foodName, quantity, unit);

        try {
            logger.info("[DEBUG] Calling Gemini API for: {} {} {}", foodName, quantity, unit);

            String rawResponse = callGeminiApi(prompt);

            logger.info("[DEBUG] Raw Gemini response: {}", rawResponse);
            return rawResponse;
        } catch (Exception e) {
            logger.error("[DEBUG] Gemini API call failed: {}", e.getMessage(), e);
            throw new GeminiApiException("Failed to call Gemini API: " + e.getMessage(),
                    "No response received", e);
        }
    }

    /**
     * Generic method to call Gemini with any prompt and return the extracted text content.
     */
    @Override
    public String callRawPrompt(String prompt) {
        try {
            logger.info("Calling Gemini API with generic prompt (length={}) using model {}", prompt.length(),
                    geminiModel);

            String rawResponse = callGeminiApi(prompt);
            return extractTextFromGeminiResponse(rawResponse);
        } catch (GeminiApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error calling Gemini API: {}", e.getMessage(), e);
            throw new GeminiApiException("Failed to call Gemini API: " + e.getMessage(), "No response received", e);
        }
    }

    private String buildPrompt(String foodName, double quantity, String unit) {
        return String.format(
                """
                        You are a nutrition expert assistant. Analyze the following food item and provide accurate nutritional information.

                        Food: %s
                        Quantity: %.2f %s

                        Provide the nutritional values for this exact quantity. Be as accurate as possible based on standard nutritional databases.

                        IMPORTANT: Respond ONLY with a valid JSON object in the following exact format, with no additional text, explanations, or markdown:
                        {
                            "calories": <number>,
                            "proteinG": <number>,
                            "carbsG": <number>,
                            "fatsG": <number>,
                            "fiberG": <number>,
                            "sugarG": <number>,
                            "sodiumMg": <number>
                        }

                        All values should be numbers (not strings). Use 0 if a value is negligible or unknown.
                        """,
                foodName, quantity, unit);
    }

    public NutritionResponse parseNutritionResponse(String response) {
        try {
            String text = extractTextFromGeminiResponse(response);

            logger.info("Raw text from Gemini: {}", text);

            // Extract JSON from the response (in case there's any surrounding text)
            String jsonStr = extractJson(text);
            logger.info("Extracted JSON: {}", jsonStr);

            JsonNode nutritionData = objectMapper.readTree(jsonStr);

            return NutritionResponse.builder()
                    .calories(getBigDecimal(nutritionData, "calories"))
                    .proteinG(getBigDecimal(nutritionData, "proteinG"))
                    .carbsG(getBigDecimal(nutritionData, "carbsG"))
                    .fatsG(getBigDecimal(nutritionData, "fatsG"))
                    .fiberG(getBigDecimal(nutritionData, "fiberG"))
                    .sugarG(getBigDecimal(nutritionData, "sugarG"))
                    .sodiumMg(getBigDecimal(nutritionData, "sodiumMg"))
                    .build();

        } catch (GeminiApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error parsing Gemini response: {}", response, e);
            throw new GeminiApiException("Failed to parse nutrition response: " + e.getMessage(), response, e);
        }
    }

    private String extractJson(String text) {
        // Remove markdown code blocks if present
        String cleaned = text.trim();

        // Remove ```json or ``` markers
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }

        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }

        cleaned = cleaned.trim();

        // Try to find JSON object - use a pattern that matches balanced braces
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');

        if (start != -1 && end != -1 && end > start) {
            return cleaned.substring(start, end + 1);
        }

        // If no explicit JSON found, assume the whole text is JSON
        return cleaned;
    }

    private BigDecimal getBigDecimal(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return BigDecimal.ZERO;
        }
        if (value.isNumber()) {
            return BigDecimal.valueOf(value.asDouble());
        }
        try {
            return new BigDecimal(value.asText());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private void validateGeminiConfiguration() {
        if (geminiApiKey.isBlank()) {
            throw new GeminiApiException("Gemini API key is not configured", "No request sent");
        }
        if (geminiModel.isBlank()) {
            throw new GeminiApiException("Gemini model is not configured", "No request sent");
        }
    }
}
