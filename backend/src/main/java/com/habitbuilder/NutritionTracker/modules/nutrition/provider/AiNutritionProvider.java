package com.habitbuilder.NutritionTracker.modules.nutrition.provider;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiJsonSupport;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiProviderException;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiTextService;
import com.habitbuilder.NutritionTracker.modules.nutrition.JsonNumbers;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutrientKeys;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutrientValue;
import com.habitbuilder.NutritionTracker.modules.nutrition.Nutrients;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionCache;

/**
 * Terminal fallback provider: asks the configured LLM for per-base-unit
 * nutrition. Unlike the HTTP providers it throws {@link AiProviderException}
 * on unusable responses so the enrichment retry loop records the failure.
 */
@Component
public class AiNutritionProvider implements NutritionProvider {

    public static final String SOURCE = "AI";

    private final AiTextService aiTextService;
    private final ObjectMapper objectMapper;

    public AiNutritionProvider(AiTextService aiTextService, ObjectMapper objectMapper) {
        this.aiTextService = aiTextService;
        this.objectMapper = objectMapper;
    }

    @Override
    public String source() {
        return SOURCE;
    }

    @Override
    public boolean isConfigured() {
        return true;
    }

    @Override
    public Optional<ProviderResult> fetch(String foodName, String normalizedFoodName) {
        String rawResponse = aiTextService.callRawPrompt(buildPrompt(foodName));

        try {
            String jsonPayload = AiJsonSupport.extractJson(rawResponse);
            JsonNode nutritionNode = objectMapper.readTree(jsonPayload);
            return Optional.of(new ProviderResult(toCacheEntry(foodName, normalizedFoodName, nutritionNode), jsonPayload));
        } catch (Exception e) {
            throw new AiProviderException("nutrition-ai", "Failed to parse AI nutrition response: " + e.getMessage(),
                    rawResponse, e);
        }
    }

    private NutritionCache toCacheEntry(String foodName, String normalizedFoodName, JsonNode nutritionNode) {
        BigDecimal baseQuantity = JsonNumbers.decimalAt(nutritionNode, "base_quantity");
        if (baseQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("AI response returned an invalid base_quantity");
        }

        String baseUnit = nutritionNode.path("base_unit").asText("").trim();
        if (baseUnit.isBlank()) {
            throw new IllegalArgumentException("AI response returned an empty base_unit");
        }

        Map<String, NutrientValue> nutrients = extractNutrients(nutritionNode);

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

    private Map<String, NutrientValue> extractNutrients(JsonNode nutritionNode) {
        Map<String, NutrientValue> extractedNutrients = new LinkedHashMap<>();
        JsonNode nutrientsNode = nutritionNode.path("nutrients");

        if (nutrientsNode.isArray()) {
            for (JsonNode nutrientNode : nutrientsNode) {
                addStructuredNutrient(extractedNutrients, nutrientNode);
            }
        } else if (nutrientsNode.isObject()) {
            nutrientsNode.fields()
                    .forEachRemaining(entry -> addKeyedNutrient(extractedNutrients, entry.getKey(), entry.getValue()));
        }

        addLegacyNutrient(extractedNutrients, "calories", "Calories", "kcal", JsonNumbers.decimalAt(nutritionNode, "calories_kcal"));
        addLegacyNutrient(extractedNutrients, "protein", "Protein", "g", JsonNumbers.decimalAt(nutritionNode, "protein_g"));
        addLegacyNutrient(extractedNutrients, "carbs", "Carbohydrates", "g", JsonNumbers.decimalAt(nutritionNode, "carbohydrates_g"));
        addLegacyNutrient(extractedNutrients, "fat", "Total Fat", "g", JsonNumbers.decimalAt(nutritionNode, "fat_g"));
        addLegacyNutrient(extractedNutrients, "fiber", "Fiber", "g", JsonNumbers.decimalAt(nutritionNode, "fiber_g"));
        addLegacyNutrient(extractedNutrients, "sugar", "Sugar", "g", JsonNumbers.decimalAt(nutritionNode, "sugar_g"));
        addLegacyNutrient(extractedNutrients, "sodium", "Sodium", "mg", JsonNumbers.decimalAt(nutritionNode, "sodium_mg"));

        return extractedNutrients;
    }

    private void addStructuredNutrient(Map<String, NutrientValue> nutrients, JsonNode nutrientNode) {
        if (nutrientNode == null || nutrientNode.isNull()) {
            return;
        }

        String key = nutrientNode.path("key").asText("").trim();
        String name = nutrientNode.path("name").asText("").trim();
        String unit = NutrientKeys.normalizeNutrientUnit(nutrientNode.path("unit").asText(""));
        String nutrientNumber = nutrientNode.path("nutrientNumber").asText("").trim();
        BigDecimal amount = JsonNumbers.decimalAt(nutrientNode, "amount");

        if (key.isBlank()) {
            key = NutrientKeys.resolveNutrientKey(nutrientNumber, name, unit);
        } else {
            key = NutrientKeys.normalizeStructuredNutrientKey(key, name, unit);
        }

        if (key.isBlank()) {
            return;
        }

        if (name.isBlank()) {
            name = NutrientKeys.humanizeNutrientKey(key);
        }

        if (unit.isBlank()) {
            unit = NutrientKeys.inferUnitFromKey(key);
        }

        Nutrients.upsert(nutrients, key, name, unit, amount, nutrientNumber);
    }

    private void addKeyedNutrient(Map<String, NutrientValue> nutrients, String rawKey, JsonNode nutrientNode) {
        if (nutrientNode == null || nutrientNode.isNull()) {
            return;
        }

        String key = NutrientKeys.normalizeStructuredNutrientKey(rawKey, rawKey, "");
        String name = NutrientKeys.humanizeNutrientKey(key);
        String unit = NutrientKeys.inferUnitFromKey(key);
        String nutrientNumber = "";
        BigDecimal amount;

        if (nutrientNode.isObject()) {
            name = NutrientKeys.firstNonBlank(nutrientNode.path("name").asText(""), name);
            unit = NutrientKeys.normalizeNutrientUnit(
                    NutrientKeys.firstNonBlank(nutrientNode.path("unit").asText(""), unit));
            nutrientNumber = nutrientNode.path("nutrientNumber").asText("").trim();
            amount = JsonNumbers.decimalAt(nutrientNode, "amount");
        } else {
            amount = JsonNumbers.asDecimal(nutrientNode);
        }

        Nutrients.upsert(nutrients, key, name, unit, amount, nutrientNumber);
    }

    private void addLegacyNutrient(
            Map<String, NutrientValue> nutrients,
            String key,
            String name,
            String unit,
            BigDecimal amount) {
        if (amount == null) {
            return;
        }

        Nutrients.upsert(nutrients, key, name, unit, amount, "");
    }

    private String buildPrompt(String foodName) {
        return String.format(
                """
                        You are a nutrition data assistant.
                        Return only a valid JSON object for the food item below.
                        Choose the most appropriate base unit for the food:
                        - use 100g for solids
                        - use 100ml for liquids
                        - use 1 piece for countable items

                        Food item: %s

                        Respond with this exact JSON shape and no extra text:
                        {
                          "base_unit": "100g",
                          "base_quantity": 100,
                          "nutrients": [
                            { "key": "calories", "name": "Calories", "amount": 0, "unit": "kcal" },
                            { "key": "protein", "name": "Protein", "amount": 0, "unit": "g" },
                            { "key": "carbs", "name": "Carbohydrates", "amount": 0, "unit": "g" },
                            { "key": "fat", "name": "Total Fat", "amount": 0, "unit": "g" },
                            { "key": "fiber", "name": "Fiber", "amount": 0, "unit": "g" },
                            { "key": "sugar", "name": "Sugar", "amount": 0, "unit": "g" },
                            { "key": "sodium", "name": "Sodium", "amount": 0, "unit": "mg" },
                            { "key": "vitaminA", "name": "Vitamin A", "amount": 0, "unit": "mcg" },
                            { "key": "vitaminC", "name": "Vitamin C", "amount": 0, "unit": "mg" },
                            { "key": "vitaminD", "name": "Vitamin D", "amount": 0, "unit": "mcg" },
                            { "key": "vitaminE", "name": "Vitamin E", "amount": 0, "unit": "mg" },
                            { "key": "vitaminK", "name": "Vitamin K", "amount": 0, "unit": "mcg" },
                            { "key": "calcium", "name": "Calcium", "amount": 0, "unit": "mg" },
                            { "key": "iron", "name": "Iron", "amount": 0, "unit": "mg" },
                            { "key": "potassium", "name": "Potassium", "amount": 0, "unit": "mg" },
                            { "key": "magnesium", "name": "Magnesium", "amount": 0, "unit": "mg" },
                            { "key": "zinc", "name": "Zinc", "amount": 0, "unit": "mg" }
                          ]
                        }

                        Include as many additional confidently known nutrients as possible in the nutrients array.
                        Keep keys in lower camelCase and use 0 when a nutrient is unknown.
                        """,
                foodName);
    }
}
