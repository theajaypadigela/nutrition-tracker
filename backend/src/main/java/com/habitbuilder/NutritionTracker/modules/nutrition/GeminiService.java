package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;
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

@Service
public class GeminiService {

    private static final Logger logger = LoggerFactory.getLogger(GeminiService.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String chatCompletionsUrl;
    private final String providerToken;
    private final String providerModel;

    public GeminiService(
            WebClient.Builder webClientBuilder,
            ObjectMapper objectMapper,
            @Value("${ai.provider.base-url:https://api.openai.com/v1}") String providerBaseUrl,
            @Value("${ai.provider.token}") String providerToken,
            @Value("${ai.provider.model:gpt-4o-mini}") String providerModel) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
        this.chatCompletionsUrl = chatCompletionsUrl(providerBaseUrl);
        this.providerToken = providerToken;
        this.providerModel = providerModel;
    }

    public NutritionResponse getNutritionInfo(String foodName, double quantity, String unit) {
        String prompt = buildPrompt(foodName, quantity, unit);
        String rawResponse = null;

        try {
            Map<String, Object> requestBody = Map.of(
                    "model", providerModel,
                    "messages", List.of(
                            Map.of("role", "user", "content", prompt)),
                    "temperature", 0.1);

            logger.info("Calling AI provider for nutrition enrichment");

            rawResponse = webClient.post()
                    .uri(chatCompletionsUrl)
                    .header("Authorization", "Bearer " + providerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .defaultIfEmpty("No response body")
                                    .flatMap(body -> {
                                        logger.error("AI provider rejected nutrition request: status={}",
                                                clientResponse.statusCode().value());
                                        return reactor.core.publisher.Mono
                                                .error(new GeminiApiException("API Error", body));
                                    }))
                    .bodyToMono(String.class)
                    .block();

            logger.info("AI provider nutrition response received");
            return parseNutritionResponse(rawResponse);
        } catch (GeminiApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("AI provider nutrition request failed: errorType={}", e.getClass().getSimpleName());
            throw new GeminiApiException("Failed to get nutrition info",
                    rawResponse != null ? rawResponse : "No response received", e);
        }
    }

    /**
     * Calls the AI provider and returns the raw response string without any
     * parsing.
     */
    public String getRawNutritionResponse(String foodName, double quantity, String unit) {
        String prompt = buildPrompt(foodName, quantity, unit);

        try {
            Map<String, Object> requestBody = Map.of(
                    "model", providerModel,
                    "messages", List.of(
                            Map.of("role", "user", "content", prompt)),
                    "temperature", 0.1);

            logger.info("Calling AI provider for raw nutrition enrichment");

            String rawResponse = webClient.post()
                    .uri(chatCompletionsUrl)
                    .header("Authorization", "Bearer " + providerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .defaultIfEmpty("No response body")
                                    .flatMap(body -> {
                                        logger.error("AI provider rejected nutrition request: status={}",
                                                clientResponse.statusCode().value());
                                        return reactor.core.publisher.Mono
                                                .error(new GeminiApiException("API Error", body));
                                    }))
                    .bodyToMono(String.class)
                    .block();

            logger.info("AI provider nutrition response received");
            return rawResponse;
        } catch (Exception e) {
            logger.error("AI provider nutrition request failed: errorType={}", e.getClass().getSimpleName());
            throw new GeminiApiException("Failed to call AI provider",
                    "No response received", e);
        }
    }

    /**
     * Generic method to call the AI provider with any prompt and return the raw response.
     */
    public String callRawPrompt(String prompt) {
        try {
            Map<String, Object> requestBody = Map.of(
                    "model", providerModel,
                    "messages", List.of(Map.of("role", "user", "content", prompt)),
                    "temperature", 0.1);

            logger.info("Calling AI provider with generic prompt (length={})", prompt.length());

            return webClient.post()
                    .uri(chatCompletionsUrl)
                    .header("Authorization", "Bearer " + providerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .defaultIfEmpty("No response body")
                                    .flatMap(body -> {
                                        logger.error("AI provider rejected generic request: status={}",
                                                clientResponse.statusCode().value());
                                        return reactor.core.publisher.Mono
                                                .error(new GeminiApiException("API Error", body));
                                    }))
                    .bodyToMono(String.class)
                    .block();
        } catch (GeminiApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("AI provider request failed: errorType={}", e.getClass().getSimpleName());
            throw new GeminiApiException("Failed to call AI provider", "No response received", e);
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
            JsonNode root = objectMapper.readTree(response);

            // Navigate to the text content in OpenAI's response structure
            JsonNode choices = root.path("choices");
            if (choices.isEmpty() || !choices.isArray()) {
                throw new NutritionParseException("Invalid AI provider response: no choices found", response);
            }

            JsonNode message = choices.get(0).path("message");
            if (message.isEmpty() || message.isMissingNode()) {
                throw new NutritionParseException("Invalid AI provider response: no message found", response);
            }

            String text = message.path("content").asText();

            // Extract JSON from the response (in case there's any surrounding text)
            String jsonStr = extractJson(text);

            JsonNode nutritionData = objectMapper.readTree(jsonStr);

            NutritionResponse nutritionResponse = NutritionResponse.builder()
                    .calories(getBigDecimal(nutritionData, "calories"))
                    .proteinG(getBigDecimal(nutritionData, "proteinG"))
                    .carbsG(getBigDecimal(nutritionData, "carbsG"))
                    .fatsG(getBigDecimal(nutritionData, "fatsG"))
                    .fiberG(getBigDecimal(nutritionData, "fiberG"))
                    .sugarG(getBigDecimal(nutritionData, "sugarG"))
                    .sodiumMg(getBigDecimal(nutritionData, "sodiumMg"))
                    .build();

            if (!nutritionResponse.hasAnyNumericValue()) {
                throw new NutritionParseException(
                        "AI nutrition payload contained no numeric nutrient values",
                        response);
            }
            return nutritionResponse;

        } catch (NutritionParseException e) {
            throw e;
        } catch (Exception e) {
            logger.error("AI provider nutrition response could not be parsed: errorType={}",
                    e.getClass().getSimpleName());
            throw new NutritionParseException("Failed to parse nutrition response", response, e);
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
            return null;
        }
        if (value.isNumber()) {
            return BigDecimal.valueOf(value.asDouble());
        }
        try {
            return new BigDecimal(value.asText());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String chatCompletionsUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("AI provider base URL must be configured");
        }
        String normalized = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;
        return normalized.endsWith("/chat/completions")
                ? normalized
                : normalized + "/chat/completions";
    }
}
