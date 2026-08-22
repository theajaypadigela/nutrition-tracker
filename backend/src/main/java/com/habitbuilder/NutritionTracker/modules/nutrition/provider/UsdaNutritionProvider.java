package com.habitbuilder.NutritionTracker.modules.nutrition.provider;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.nutrition.JsonNumbers;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutrientKeys;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutrientValue;
import com.habitbuilder.NutritionTracker.modules.nutrition.Nutrients;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionCache;
import com.habitbuilder.NutritionTracker.modules.nutrition.units.UnitConversion;

/**
 * USDA FoodData Central lookup. Not part of the default provider chain
 * (see {@code nutrition.provider-chain}); add "usda" to the chain to enable it.
 */
@Component
public class UsdaNutritionProvider implements NutritionProvider {

    public static final String SOURCE = "USDA";

    private static final Logger logger = LoggerFactory.getLogger(UsdaNutritionProvider.class);
    private static final BigDecimal DEFAULT_BASE_QUANTITY = BigDecimal.valueOf(100);
    private static final String DEFAULT_BASE_LABEL = "100g";
    private static final int SEARCH_PAGE_SIZE = 1;
    private static final int RESPONSE_BUFFER_BYTES = 2 * 1024 * 1024;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final long timeoutMillis;

    public UsdaNutritionProvider(
            WebClient.Builder webClientBuilder,
            ObjectMapper objectMapper,
            @Value("${usda.api.key:}") String apiKey,
            @Value("${usda.api.timeout:20000}") long timeoutMillis) {
        this.webClient = webClientBuilder
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(RESPONSE_BUFFER_BYTES))
                .build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.timeoutMillis = timeoutMillis;
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
            logger.warn("USDA_API_KEY is not configured; skipping USDA lookup for '{}'", foodName);
            return Optional.empty();
        }

        try {
            String rawResponse = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .scheme("https")
                            .host("api.nal.usda.gov")
                            .path("/fdc/v1/foods/search")
                            .queryParam("query", foodName)
                            .queryParam("pageSize", SEARCH_PAGE_SIZE)
                            .queryParam("api_key", apiKey)
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMillis(timeoutMillis))
                    .block(Duration.ofMillis(timeoutMillis + 5000));

            if (rawResponse == null || rawResponse.isBlank()) {
                logger.warn("USDA returned an empty response for '{}'", foodName);
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(rawResponse);
            JsonNode foods = root.path("foods");
            if (!foods.isArray() || foods.isEmpty()) {
                logger.info("USDA returned no foods for '{}'", foodName);
                return Optional.empty();
            }

            return Optional.of(new ProviderResult(toCacheEntry(foodName, normalizedFoodName, foods.get(0)), rawResponse));
        } catch (Exception e) {
            logger.warn("USDA lookup failed for '{}', falling back. Error: {}", foodName, e.getMessage());
            return Optional.empty();
        }
    }

    private NutritionCache toCacheEntry(String foodName, String normalizedFoodName, JsonNode foodNode) {
        BigDecimal baseQuantity = resolveBaseQuantity(foodNode);
        String baseUnit = resolveBaseUnit(foodNode, baseQuantity);
        Map<String, NutrientValue> nutrients = extractNutrients(foodNode);

        NutritionCache cacheEntry = new NutritionCache();
        cacheEntry.setNormalizedFoodName(normalizedFoodName);
        cacheEntry.setFoodName(foodName.trim());
        cacheEntry.setBaseQuantity(baseQuantity);
        cacheEntry.setBaseUnit(baseUnit);
        cacheEntry.setNutrients(Nutrients.copy(nutrients));
        Nutrients.syncCacheMacros(cacheEntry, nutrients);
        cacheEntry.setSource(SOURCE);
        cacheEntry.setCachedAt(Instant.now());
        return cacheEntry;
    }

    private Map<String, NutrientValue> extractNutrients(JsonNode foodNode) {
        Map<String, NutrientValue> extractedNutrients = new LinkedHashMap<>();
        JsonNode nutrientsNode = foodNode.path("foodNutrients");
        if (!nutrientsNode.isArray()) {
            return extractedNutrients;
        }

        for (JsonNode nutrientNode : nutrientsNode) {
            String nutrientNumber = NutrientKeys.firstNonBlank(
                    nutrientNode.path("nutrientNumber").asText(""),
                    nutrientNode.path("nutrient").path("number").asText(""),
                    nutrientNode.path("nutrient").path("nutrientNumber").asText(""));
            String nutrientName = NutrientKeys.firstNonBlank(
                    nutrientNode.path("nutrientName").asText(""),
                    nutrientNode.path("nutrient").path("name").asText(""));
            String unit = NutrientKeys.normalizeNutrientUnit(NutrientKeys.firstNonBlank(
                    nutrientNode.path("unitName").asText(""),
                    nutrientNode.path("nutrient").path("unitName").asText("")));
            BigDecimal amount = JsonNumbers.decimalAt(nutrientNode, "value");

            if (nutrientName.isBlank() && nutrientNumber.isBlank()) {
                continue;
            }

            String key = NutrientKeys.resolveNutrientKey(nutrientNumber, nutrientName, unit);
            Nutrients.upsert(
                    extractedNutrients,
                    key,
                    nutrientName.isBlank() ? NutrientKeys.humanizeNutrientKey(key) : nutrientName,
                    unit,
                    amount,
                    nutrientNumber);
        }

        return extractedNutrients;
    }

    private BigDecimal resolveBaseQuantity(JsonNode foodNode) {
        BigDecimal servingSize = JsonNumbers.decimalAt(foodNode, "servingSize");
        if (servingSize.compareTo(BigDecimal.ZERO) > 0) {
            return servingSize;
        }
        return DEFAULT_BASE_QUANTITY;
    }

    private String resolveBaseUnit(JsonNode foodNode, BigDecimal baseQuantity) {
        String servingSizeUnit = foodNode.path("servingSizeUnit").asText("").trim();
        if (!servingSizeUnit.isBlank()) {
            return UnitConversion.formatBaseUnit(baseQuantity, servingSizeUnit);
        }
        return DEFAULT_BASE_LABEL;
    }
}
