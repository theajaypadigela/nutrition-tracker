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
    private final String copilotBridgeUrl;
    private final String copilotBridgeToken;
    private final String copilotModel;

    public GeminiService(
            WebClient.Builder webClientBuilder,
            ObjectMapper objectMapper,
            @Value("${copilot.bridge.port}") String copilotPort,
            @Value("${copilot.bridge.token}") String copilotToken,
            @Value("${copilot.bridge.model}") String copilotModel) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
        this.copilotBridgeUrl = "http://127.0.0.1:" + copilotPort + "/v1/chat/completions";
        this.copilotBridgeToken = copilotToken;
        this.copilotModel = copilotModel;
    }

    public NutritionResponse getNutritionInfo(String foodName, double quantity, String unit) {
        String prompt = buildPrompt(foodName, quantity, unit);
        String rawResponse = null;

        try {
            Map<String, Object> requestBody = Map.of(
                    "model", copilotModel,
                    "messages", List.of(
                            Map.of("role", "user", "content", prompt)),
                    "temperature", 0.1);

            logger.info("Calling Copilot Bridge API for: {} {} {}", foodName, quantity, unit);

            rawResponse = webClient.post()
                    .uri(copilotBridgeUrl)
                    .header("Authorization", "Bearer " + copilotBridgeToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .defaultIfEmpty("No response body")
                                    .flatMap(body -> {
                                        logger.error("Copilot Bridge API error response: {}", body);
                                        return reactor.core.publisher.Mono
                                                .error(new GeminiApiException("API Error", body));
                                    }))
                    .bodyToMono(String.class)
                    .block();

            logger.info("Copilot Bridge API response received: {}", rawResponse);
            return parseNutritionResponse(rawResponse);
        } catch (GeminiApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error calling Copilot Bridge API for food: {} {} {} - Error: {}", foodName, quantity, unit,
                    e.getMessage(), e);
            throw new GeminiApiException("Failed to get nutrition info: " + e.getMessage(),
                    rawResponse != null ? rawResponse : "No response received", e);
        }
    }

    /**
     * Calls Copilot Bridge API and returns the raw response string without any
     * parsing.
     */
    public String getRawNutritionResponse(String foodName, double quantity, String unit) {
        String prompt = buildPrompt(foodName, quantity, unit);

        try {
            Map<String, Object> requestBody = Map.of(
                    "model", copilotModel,
                    "messages", List.of(
                            Map.of("role", "user", "content", prompt)),
                    "temperature", 0.1);

            logger.info("[DEBUG] Calling Copilot Bridge API for: {} {} {}", foodName, quantity, unit);

            String rawResponse = webClient.post()
                    .uri(copilotBridgeUrl)
                    .header("Authorization", "Bearer " + copilotBridgeToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .defaultIfEmpty("No response body")
                                    .flatMap(body -> {
                                        logger.error("[DEBUG] Copilot Bridge API error: {}", body);
                                        return reactor.core.publisher.Mono
                                                .error(new GeminiApiException("API Error", body));
                                    }))
                    .bodyToMono(String.class)
                    .block();

            logger.info("[DEBUG] Raw Copilot Bridge response: {}", rawResponse);
            return rawResponse;
        } catch (Exception e) {
            logger.error("[DEBUG] Copilot Bridge API call failed: {}", e.getMessage(), e);
            throw new GeminiApiException("Failed to call Copilot Bridge API: " + e.getMessage(),
                    "No response received", e);
        }
    }

    /**
     * Generic method to call the Copilot Bridge with any prompt and return the raw response.
     */
    public String callRawPrompt(String prompt) {
        try {
            Map<String, Object> requestBody = Map.of(
                    "model", copilotModel,
                    "messages", List.of(Map.of("role", "user", "content", prompt)),
                    "temperature", 0.1);

            logger.info("Calling Copilot Bridge with generic prompt (length={})", prompt.length());

            return webClient.post()
                    .uri(copilotBridgeUrl)
                    .header("Authorization", "Bearer " + copilotBridgeToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .defaultIfEmpty("No response body")
                                    .flatMap(body -> {
                                        logger.error("Copilot Bridge API error: {}", body);
                                        return reactor.core.publisher.Mono
                                                .error(new GeminiApiException("API Error", body));
                                    }))
                    .bodyToMono(String.class)
                    .block();
        } catch (GeminiApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error calling Copilot Bridge: {}", e.getMessage(), e);
            throw new GeminiApiException("Failed to call Copilot Bridge: " + e.getMessage(), "No response received", e);
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
                throw new GeminiApiException("Invalid Copilot Bridge response: no choices found", response);
            }

            JsonNode message = choices.get(0).path("message");
            if (message.isEmpty() || message.isMissingNode()) {
                throw new GeminiApiException("Invalid Copilot Bridge response: no message found", response);
            }

            String text = message.path("content").asText();

            logger.info("Raw text from Copilot Bridge: {}", text);

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
            logger.error("Error parsing Copilot Bridge response: {}", response, e);
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
}
