package com.habitbuilder.NutritionTracker.modules.nutrition.provider;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.config.properties.SpoonacularProperties;
import com.habitbuilder.NutritionTracker.modules.nutrition.JsonNumbers;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutrientKeys;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutrientValue;
import com.habitbuilder.NutritionTracker.modules.nutrition.Nutrients;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionCache;

@Component
public class SpoonacularNutritionProvider implements NutritionProvider {

    public static final String SOURCE = "SPOONACULAR";

    private static final Logger logger = LoggerFactory.getLogger(SpoonacularNutritionProvider.class);
    private static final BigDecimal BASE_QUANTITY = BigDecimal.valueOf(100);
    private static final String BASE_LABEL = "100g";

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final long timeoutMillis;

    public SpoonacularNutritionProvider(
            WebClient.Builder webClientBuilder,
            ObjectMapper objectMapper,
            SpoonacularProperties properties) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
        this.apiKey = properties.key();
        this.timeoutMillis = properties.timeout();
    }

    @Override
    public String source() {
        return SOURCE;
    }

    @Override
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public Optional<ProviderResult> fetch(String foodName, String normalizedFoodName) {
        if (!isConfigured()) {
            logger.warn("SPOONACULAR_API_KEY is not configured; skipping Spoonacular lookup for '{}'", foodName);
            return Optional.empty();
        }

        try {
            String rawResponse = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .scheme("https")
                            .host("api.spoonacular.com")
                            .path("/recipes/guessNutrition")
                            .queryParam("title", foodName)
                            .queryParam("apiKey", apiKey)
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMillis(timeoutMillis))
                    .block(Duration.ofMillis(timeoutMillis + 5000));

            if (rawResponse == null || rawResponse.isBlank()) {
                logger.warn("Spoonacular returned an empty response for '{}'", foodName);
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(rawResponse);
            if (!hasNutrition(root)) {
                logger.info("Spoonacular returned no usable nutrition for '{}'", foodName);
                return Optional.empty();
            }

            return Optional.of(new ProviderResult(toCacheEntry(foodName, normalizedFoodName, root), rawResponse));
        } catch (Exception e) {
            logger.warn("Spoonacular lookup failed for '{}', falling back. Error: {}", foodName, e.getMessage());
            return Optional.empty();
        }
    }

    private NutritionCache toCacheEntry(String foodName, String normalizedFoodName, JsonNode nutritionNode) {
        Map<String, NutrientValue> nutrients = extractNutrients(nutritionNode);

        NutritionCache cacheEntry = new NutritionCache();
        cacheEntry.setNormalizedFoodName(normalizedFoodName);
        cacheEntry.setFoodName(foodName.trim());
        cacheEntry.setBaseQuantity(BASE_QUANTITY);
        cacheEntry.setBaseUnit(BASE_LABEL);
        cacheEntry.setNutrients(Nutrients.copy(nutrients));
        Nutrients.syncCacheMacros(cacheEntry, nutrients);
        cacheEntry.setSource(SOURCE);
        cacheEntry.setCachedAt(Instant.now());
        return cacheEntry;
    }

    private Map<String, NutrientValue> extractNutrients(JsonNode nutritionNode) {
        Map<String, NutrientValue> extractedNutrients = new LinkedHashMap<>();
        addNutrient(extractedNutrients, "calories", "Calories", nutritionNode.path("calories"));
        addNutrient(extractedNutrients, "fat", "Total Fat", nutritionNode.path("fat"));
        addNutrient(extractedNutrients, "protein", "Protein", nutritionNode.path("protein"));
        addNutrient(extractedNutrients, "carbs", "Carbohydrates", nutritionNode.path("carbs"));
        return extractedNutrients;
    }

    private void addNutrient(
            Map<String, NutrientValue> nutrients,
            String key,
            String fallbackName,
            JsonNode nutrientNode) {
        if (nutrientNode == null || nutrientNode.isMissingNode() || nutrientNode.isNull()) {
            return;
        }

        String name = NutrientKeys.firstNonBlank(nutrientNode.path("name").asText(""), fallbackName);
        String unit = NutrientKeys.normalizeNutrientUnit(
                NutrientKeys.firstNonBlank(nutrientNode.path("unit").asText(""), NutrientKeys.inferUnitFromKey(key)));
        BigDecimal amount = JsonNumbers.decimalAt(nutrientNode, "value");

        Nutrients.upsert(nutrients, key, name, unit, amount, "");
    }

    private boolean hasNutrition(JsonNode nutritionNode) {
        return JsonNumbers.decimalAt(nutritionNode.path("calories"), "value").compareTo(BigDecimal.ZERO) > 0
                || JsonNumbers.decimalAt(nutritionNode.path("fat"), "value").compareTo(BigDecimal.ZERO) > 0
                || JsonNumbers.decimalAt(nutritionNode.path("protein"), "value").compareTo(BigDecimal.ZERO) > 0
                || JsonNumbers.decimalAt(nutritionNode.path("carbs"), "value").compareTo(BigDecimal.ZERO) > 0;
    }
}
