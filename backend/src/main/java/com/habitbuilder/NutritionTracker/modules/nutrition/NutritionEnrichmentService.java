package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;
import java.math.MathContext;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.food.FoodEntry;

@Service
public class NutritionEnrichmentService {

    private static final Logger logger = LoggerFactory.getLogger(NutritionEnrichmentService.class);
    private static final int MAX_RETRY_COUNT = 3;
    private static final MathContext SCALING_CONTEXT = MathContext.DECIMAL64;
    private static final BigDecimal DEFAULT_USDA_BASE_QUANTITY = BigDecimal.valueOf(100);
    private static final String DEFAULT_USDA_BASE_LABEL = "100g";
    private static final BigDecimal DEFAULT_SPOONACULAR_BASE_QUANTITY = BigDecimal.valueOf(100);
    private static final String DEFAULT_SPOONACULAR_BASE_LABEL = "100g";
    private static final int USDA_SEARCH_PAGE_SIZE = 1;
    private static final int USDA_RESPONSE_BUFFER_BYTES = 2 * 1024 * 1024;
    private static final String SPOONACULAR_SOURCE = "SPOONACULAR";
    private static final String USDA_SOURCE = "USDA";
    private static final String AI_SOURCE = "AI";
    private static final Set<String> COMPACT_UNITS = Set.of("g", "kg", "mg", "mcg", "ml", "l", "oz", "lb");
    private static final BigDecimal GRAMS_PER_KILOGRAM = BigDecimal.valueOf(1000);
    private static final BigDecimal GRAMS_PER_MILLIGRAM = new BigDecimal("0.001");
    private static final BigDecimal GRAMS_PER_OUNCE = new BigDecimal("28.349523125");
    private static final BigDecimal GRAMS_PER_POUND = new BigDecimal("453.59237");
    private static final BigDecimal MILLILITERS_PER_LITER = BigDecimal.valueOf(1000);
    private static final BigDecimal MILLILITERS_PER_CUP = BigDecimal.valueOf(240);
    private static final BigDecimal MILLILITERS_PER_TABLESPOON = BigDecimal.valueOf(15);
    private static final BigDecimal MILLILITERS_PER_TEASPOON = BigDecimal.valueOf(5);
    private static final BigDecimal MILLILITERS_PER_FLUID_OUNCE = new BigDecimal("29.5735295625");

    private final AiTextService aiTextService;
    private final NutritionDetailsRepository nutritionDetailsRepository;
    private final NutritionCacheRepository nutritionCacheRepository;
    private final ObjectMapper objectMapper;
    private final WebClient webClient;
    private final String spoonacularApiKey;
    private final long spoonacularApiTimeout;
    private final String usdaApiKey;
    private final long usdaApiTimeout;

    public NutritionEnrichmentService(
            AiTextService aiTextService,
            NutritionDetailsRepository nutritionDetailsRepository,
            NutritionCacheRepository nutritionCacheRepository,
            ObjectMapper objectMapper,
            WebClient.Builder webClientBuilder,
            @Value("${spoonacular.api.key:}") String spoonacularApiKey,
            @Value("${spoonacular.api.timeout:20000}") long spoonacularApiTimeout,
            @Value("${usda.api.key:}") String usdaApiKey,
            @Value("${usda.api.timeout:20000}") long usdaApiTimeout) {
        this.aiTextService = aiTextService;
        this.nutritionDetailsRepository = nutritionDetailsRepository;
        this.nutritionCacheRepository = nutritionCacheRepository;
        this.objectMapper = objectMapper;
        this.webClient = webClientBuilder
            .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(USDA_RESPONSE_BUFFER_BYTES))
            .build();
        this.spoonacularApiKey = spoonacularApiKey;
        this.spoonacularApiTimeout = spoonacularApiTimeout;
        this.usdaApiKey = usdaApiKey;
        this.usdaApiTimeout = usdaApiTimeout;
    }

    @Async
    public void enrichFoodEntry(FoodEntry foodEntry) {
        logger.info("Starting nutrition enrichment for food entry: {} ({} {})",
                foodEntry.getName(), foodEntry.getQuantity(), foodEntry.getUnit());

        NutritionDetails nutritionDetails = getOrCreateNutritionDetails(foodEntry);
        nutritionDetails.setEnrichmentStatus("in_progress");
        nutritionDetailsRepository.save(nutritionDetails);

        try {
            ResolvedNutritionData resolvedNutrition = getNutritionData(foodEntry.getName());
            NutritionResponse scaledResponse = scaleNutritionResponse(
                    resolvedNutrition.cacheEntry(),
                    foodEntry.getQuantity(),
                    foodEntry.getUnit());

            nutritionDetails.setApiResponse(resolvedNutrition.apiPayload());
            updateNutritionDetails(nutritionDetails, scaledResponse, resolvedNutrition);
            nutritionDetails.setEnrichmentStatus("completed");
            nutritionDetails.setEnrichedAt(Instant.now());
            nutritionDetails.setEnrichmentError(null);
            nutritionDetails.setRetryCount(0);
            nutritionDetailsRepository.save(nutritionDetails);

            logger.info("Successfully enriched nutrition for food entry: {} using {}",
                    foodEntry.getName(), resolvedNutrition.lookupSource());
        } catch (AiProviderException e) {
            logger.error("AI nutrition fallback failed for food entry {}: {} - Raw response: {}",
                    foodEntry.getName(), e.getMessage(), e.getRawResponse());
            handleEnrichmentError(nutritionDetails, e.getFullDetails());
        } catch (Exception e) {
            logger.error("Error enriching food entry: {}", foodEntry.getName(), e);
            handleEnrichmentError(nutritionDetails, "Exception: " + e.getMessage());
        }
    }

    private NutritionDetails getOrCreateNutritionDetails(FoodEntry foodEntry) {
        Optional<NutritionDetails> existing = nutritionDetailsRepository.findByFoodEntryId(foodEntry.getId());
        if (existing.isPresent()) {
            return existing.get();
        }

        NutritionDetails nutritionDetails = new NutritionDetails();
        nutritionDetails.setFoodEntryId(foodEntry.getId());
        nutritionDetails.setEnrichmentStatus("pending");
        return nutritionDetailsRepository.save(nutritionDetails);
    }

    private ResolvedNutritionData getNutritionData(String foodName) {
        String normalizedFoodName = normalizeFoodName(foodName);

        Optional<NutritionCache> cachedNutrition = nutritionCacheRepository.findByNormalizedFoodName(normalizedFoodName);
        if (cachedNutrition.isEmpty() && foodName != null && !foodName.isBlank()) {
            cachedNutrition = nutritionCacheRepository.findByFoodNameIgnoreCase(foodName.trim());
        }
        if (cachedNutrition.isPresent()) {
            NutritionCache cachedEntry = cachedNutrition.get();
            if (shouldUseCachedEntry(cachedEntry)) {
                logger.info("Nutrition cache hit for food '{}'", foodName);
                return new ResolvedNutritionData(cachedEntry, "cache-hit", serializeCacheEntry(cachedEntry));
            }

            logger.info("Nutrition cache hit for food '{}' is stale for current source preference; refreshing", foodName);
        }

        Optional<ResolvedNutritionData> spoonacularNutrition = fetchNutritionFromSpoonacular(foodName, normalizedFoodName);
        if (spoonacularNutrition.isPresent()) {
            return spoonacularNutrition.get();
        }

        return fetchNutritionFromAi(foodName, normalizedFoodName);
    }

    private Optional<ResolvedNutritionData> fetchNutritionFromSpoonacular(String foodName, String normalizedFoodName) {
        if (!isSpoonacularConfigured()) {
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
                            .queryParam("apiKey", spoonacularApiKey)
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMillis(spoonacularApiTimeout))
                    .block(Duration.ofMillis(spoonacularApiTimeout + 5000));

            if (rawResponse == null || rawResponse.isBlank()) {
                logger.warn("Spoonacular returned an empty response for '{}'", foodName);
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(rawResponse);
            if (!hasSpoonacularNutrition(root)) {
                logger.info("Spoonacular returned no usable nutrition for '{}'", foodName);
                return Optional.empty();
            }

            NutritionCache cacheEntry = mapSpoonacularFoodToCache(foodName, normalizedFoodName, root);
            NutritionCache savedCacheEntry = saveNutritionCache(cacheEntry);

            logger.info("Spoonacular hit for '{}', cached with base unit {}", foodName, savedCacheEntry.getBaseUnit());
            return Optional.of(new ResolvedNutritionData(savedCacheEntry, "spoonacular-hit", rawResponse));
        } catch (Exception e) {
            logger.warn("Spoonacular lookup failed for '{}', falling back to AI. Error: {}", foodName, e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<ResolvedNutritionData> fetchNutritionFromUsda(String foodName, String normalizedFoodName) {
        if (usdaApiKey == null || usdaApiKey.isBlank()) {
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
                            .queryParam("pageSize", USDA_SEARCH_PAGE_SIZE)
                            .queryParam("api_key", usdaApiKey)
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMillis(usdaApiTimeout))
                    .block(Duration.ofMillis(usdaApiTimeout + 5000));

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

            JsonNode firstFood = foods.get(0);
            NutritionCache cacheEntry = mapUsdaFoodToCache(foodName, normalizedFoodName, firstFood);
            NutritionCache savedCacheEntry = saveNutritionCache(cacheEntry);

            logger.info("USDA hit for '{}', cached with base unit {}", foodName, savedCacheEntry.getBaseUnit());
            return Optional.of(new ResolvedNutritionData(savedCacheEntry, "usda-hit", rawResponse));
        } catch (Exception e) {
            logger.warn("USDA lookup failed for '{}', falling back to AI. Error: {}", foodName, e.getMessage());
            return Optional.empty();
        }
    }

    private ResolvedNutritionData fetchNutritionFromAi(String foodName, String normalizedFoodName) {
        String prompt = buildAiNutritionPrompt(foodName);
        String rawResponse = aiTextService.callRawPrompt(prompt);

        try {
            String jsonPayload = extractJsonObject(rawResponse);
            JsonNode nutritionNode = objectMapper.readTree(jsonPayload);
            NutritionCache cacheEntry = mapAiFoodToCache(foodName, normalizedFoodName, nutritionNode);
            NutritionCache savedCacheEntry = saveNutritionCache(cacheEntry);

            logger.info("AI hit for '{}', cached with base unit {}", foodName, savedCacheEntry.getBaseUnit());
            return new ResolvedNutritionData(savedCacheEntry, "ai-hit", jsonPayload);
        } catch (Exception e) {
            throw new AiProviderException("nutrition-ai", "Failed to parse AI nutrition response: " + e.getMessage(),
                    rawResponse, e);
        }
    }

    private NutritionCache mapUsdaFoodToCache(String foodName, String normalizedFoodName, JsonNode foodNode) {
        BigDecimal baseQuantity = resolveUsdaBaseQuantity(foodNode);
        String baseUnit = resolveUsdaBaseUnit(foodNode, baseQuantity);
        Map<String, NutrientValue> nutrients = extractUsdaNutrients(foodNode);

        NutritionCache cacheEntry = new NutritionCache();
        cacheEntry.setNormalizedFoodName(normalizedFoodName);
        cacheEntry.setFoodName(foodName.trim());
        cacheEntry.setBaseQuantity(baseQuantity);
        cacheEntry.setBaseUnit(baseUnit);
        cacheEntry.setNutrients(copyNutrients(nutrients));
        syncCacheMacros(cacheEntry, nutrients);
        cacheEntry.setSource(USDA_SOURCE);
        cacheEntry.setCachedAt(Instant.now());
        return cacheEntry;
    }

    private NutritionCache mapSpoonacularFoodToCache(String foodName, String normalizedFoodName, JsonNode nutritionNode) {
        Map<String, NutrientValue> nutrients = extractSpoonacularNutrients(nutritionNode);

        NutritionCache cacheEntry = new NutritionCache();
        cacheEntry.setNormalizedFoodName(normalizedFoodName);
        cacheEntry.setFoodName(foodName.trim());
        cacheEntry.setBaseQuantity(DEFAULT_SPOONACULAR_BASE_QUANTITY);
        cacheEntry.setBaseUnit(DEFAULT_SPOONACULAR_BASE_LABEL);
        cacheEntry.setNutrients(copyNutrients(nutrients));
        syncCacheMacros(cacheEntry, nutrients);
        cacheEntry.setSource(SPOONACULAR_SOURCE);
        cacheEntry.setCachedAt(Instant.now());
        return cacheEntry;
    }

    private NutritionCache mapAiFoodToCache(String foodName, String normalizedFoodName, JsonNode nutritionNode) {
        BigDecimal baseQuantity = getBigDecimal(nutritionNode, "base_quantity");
        if (baseQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("AI response returned an invalid base_quantity");
        }

        String baseUnit = nutritionNode.path("base_unit").asText("").trim();
        if (baseUnit.isBlank()) {
            throw new IllegalArgumentException("AI response returned an empty base_unit");
        }

        Map<String, NutrientValue> nutrients = extractAiNutrients(nutritionNode);

        NutritionCache cacheEntry = new NutritionCache();
        cacheEntry.setNormalizedFoodName(normalizedFoodName);
        cacheEntry.setFoodName(foodName.trim());
        cacheEntry.setBaseQuantity(baseQuantity);
        cacheEntry.setBaseUnit(baseUnit);
        cacheEntry.setNutrients(copyNutrients(nutrients));
        syncCacheMacros(cacheEntry, nutrients);
        cacheEntry.setSource(AI_SOURCE);
        cacheEntry.setCachedAt(Instant.now());
        return cacheEntry;
    }

    private NutritionCache saveNutritionCache(NutritionCache cacheEntry) {
        try {
            return nutritionCacheRepository.save(cacheEntry);
        } catch (DuplicateKeyException e) {
            logger.info("Nutrition cache entry already exists for '{}', reusing cached value",
                    cacheEntry.getNormalizedFoodName());
            NutritionCache existingCacheEntry = nutritionCacheRepository.findByNormalizedFoodName(
                    cacheEntry.getNormalizedFoodName()).orElseThrow(() -> e);

            if (shouldUpgradeCache(existingCacheEntry, cacheEntry)) {
                mergeCacheEntry(existingCacheEntry, cacheEntry);
                return nutritionCacheRepository.save(existingCacheEntry);
            }

            return existingCacheEntry;
        }
    }

    private void updateNutritionDetails(
            NutritionDetails details,
            NutritionResponse response,
            ResolvedNutritionData resolvedNutrition) {
        details.setCalories(response.getCalories());
        details.setProteinG(response.getProteinG());
        details.setCarbsG(response.getCarbsG());
        details.setFatsG(response.getFatsG());
        details.setFiberG(response.getFiberG());
        details.setSugarG(response.getSugarG());
        details.setSodiumMg(response.getSodiumMg());
        details.setNutrients(copyNutrients(response.getNutrients()));
        details.setBaseUnit(resolvedNutrition.cacheEntry().getBaseUnit());
        details.setBaseQuantity(resolvedNutrition.cacheEntry().getBaseQuantity());
        details.setSource(resolvedNutrition.cacheEntry().getSource());
        details.setLookupSource(resolvedNutrition.lookupSource());
        details.setCachedAt(resolvedNutrition.cacheEntry().getCachedAt());
    }

    private NutritionResponse scaleNutritionResponse(NutritionCache cacheEntry, double currentQuantity, String currentUnit) {
        BigDecimal scaleFactor = resolveScaleFactor(cacheEntry, currentQuantity, currentUnit);
        Map<String, NutrientValue> scaledNutrients = scaleNutrients(resolveStoredNutrients(cacheEntry), scaleFactor);

        return NutritionResponse.builder()
                .calories(getNutrientAmount(scaledNutrients, "calories"))
                .proteinG(getNutrientAmount(scaledNutrients, "protein"))
                .carbsG(getNutrientAmount(scaledNutrients, "carbs"))
                .fatsG(getNutrientAmount(scaledNutrients, "fat"))
                .fiberG(getNutrientAmount(scaledNutrients, "fiber"))
                .sugarG(getNutrientAmount(scaledNutrients, "sugar"))
                .sodiumMg(getNutrientAmount(scaledNutrients, "sodium"))
                .nutrients(scaledNutrients)
                .build();
    }

    private BigDecimal resolveScaleFactor(NutritionCache cacheEntry, double currentQuantity, String currentUnit) {
        BigDecimal requestedQuantity = BigDecimal.valueOf(currentQuantity);
        BigDecimal storedBaseQuantity = cacheEntry.getBaseQuantity();

        if (storedBaseQuantity == null || storedBaseQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ONE;
        }

        ParsedUnit storedUnit = parseStoredUnit(cacheEntry.getBaseUnit(), storedBaseQuantity);
        ParsedUnit requestedUnit = parseRequestedUnit(requestedQuantity, currentUnit);

        if (storedUnit.comparableQuantity() != null
                && requestedUnit.comparableQuantity() != null
                && storedUnit.dimension() == requestedUnit.dimension()) {
            return requestedUnit.comparableQuantity().divide(storedUnit.comparableQuantity(), SCALING_CONTEXT);
        }

        if (!storedUnit.normalizedUnit().isBlank()
                && storedUnit.normalizedUnit().equals(requestedUnit.normalizedUnit())) {
            return requestedQuantity.divide(storedBaseQuantity, SCALING_CONTEXT);
        }

        logger.warn("Could not safely convert current unit '{}' to stored unit '{}' for food '{}'; falling back to quantity ratio",
                currentUnit, cacheEntry.getBaseUnit(), cacheEntry.getFoodName());
        return requestedQuantity.divide(storedBaseQuantity, SCALING_CONTEXT);
    }

    private BigDecimal scaleNutrient(BigDecimal storedNutrient, BigDecimal scaleFactor) {
        if (storedNutrient == null) {
            return BigDecimal.ZERO;
        }
        return storedNutrient.multiply(scaleFactor, SCALING_CONTEXT);
    }

    private Map<String, NutrientValue> extractUsdaNutrients(JsonNode foodNode) {
        Map<String, NutrientValue> extractedNutrients = new LinkedHashMap<>();
        JsonNode nutrientsNode = foodNode.path("foodNutrients");
        if (!nutrientsNode.isArray()) {
            return extractedNutrients;
        }

        for (JsonNode nutrientNode : nutrientsNode) {
            String nutrientNumber = firstNonBlank(
                    nutrientNode.path("nutrientNumber").asText(""),
                    nutrientNode.path("nutrient").path("number").asText(""),
                    nutrientNode.path("nutrient").path("nutrientNumber").asText(""));
            String nutrientName = firstNonBlank(
                    nutrientNode.path("nutrientName").asText(""),
                    nutrientNode.path("nutrient").path("name").asText(""));
            String unit = normalizeNutrientUnit(firstNonBlank(
                    nutrientNode.path("unitName").asText(""),
                    nutrientNode.path("nutrient").path("unitName").asText("")));
            BigDecimal amount = getBigDecimal(nutrientNode, "value");

            if (nutrientName.isBlank() && nutrientNumber.isBlank()) {
                continue;
            }

            String key = resolveNutrientKey(nutrientNumber, nutrientName, unit);
            upsertNutrient(
                    extractedNutrients,
                    key,
                    nutrientName.isBlank() ? humanizeNutrientKey(key) : nutrientName,
                    unit,
                    amount,
                    nutrientNumber);
        }

        return extractedNutrients;
    }

    private Map<String, NutrientValue> extractSpoonacularNutrients(JsonNode nutritionNode) {
        Map<String, NutrientValue> extractedNutrients = new LinkedHashMap<>();
        addSpoonacularNutrient(extractedNutrients, "calories", "Calories", nutritionNode.path("calories"));
        addSpoonacularNutrient(extractedNutrients, "fat", "Total Fat", nutritionNode.path("fat"));
        addSpoonacularNutrient(extractedNutrients, "protein", "Protein", nutritionNode.path("protein"));
        addSpoonacularNutrient(extractedNutrients, "carbs", "Carbohydrates", nutritionNode.path("carbs"));
        return extractedNutrients;
    }

    private Map<String, NutrientValue> extractAiNutrients(JsonNode nutritionNode) {
        Map<String, NutrientValue> extractedNutrients = new LinkedHashMap<>();
        JsonNode nutrientsNode = nutritionNode.path("nutrients");

        if (nutrientsNode.isArray()) {
            for (JsonNode nutrientNode : nutrientsNode) {
                addAiNutrient(extractedNutrients, nutrientNode);
            }
        } else if (nutrientsNode.isObject()) {
            nutrientsNode.fields().forEachRemaining(entry -> addAiNutrient(extractedNutrients, entry.getKey(), entry.getValue()));
        }

        addLegacyAiNutrient(extractedNutrients, "calories", "Calories", "kcal", getBigDecimal(nutritionNode, "calories_kcal"));
        addLegacyAiNutrient(extractedNutrients, "protein", "Protein", "g", getBigDecimal(nutritionNode, "protein_g"));
        addLegacyAiNutrient(extractedNutrients, "carbs", "Carbohydrates", "g", getBigDecimal(nutritionNode, "carbohydrates_g"));
        addLegacyAiNutrient(extractedNutrients, "fat", "Total Fat", "g", getBigDecimal(nutritionNode, "fat_g"));
        addLegacyAiNutrient(extractedNutrients, "fiber", "Fiber", "g", getBigDecimal(nutritionNode, "fiber_g"));
        addLegacyAiNutrient(extractedNutrients, "sugar", "Sugar", "g", getBigDecimal(nutritionNode, "sugar_g"));
        addLegacyAiNutrient(extractedNutrients, "sodium", "Sodium", "mg", getBigDecimal(nutritionNode, "sodium_mg"));

        return extractedNutrients;
    }

    private void addSpoonacularNutrient(
            Map<String, NutrientValue> nutrients,
            String key,
            String fallbackName,
            JsonNode nutrientNode) {
        if (nutrientNode == null || nutrientNode.isMissingNode() || nutrientNode.isNull()) {
            return;
        }

        String name = firstNonBlank(nutrientNode.path("name").asText(""), fallbackName);
        String unit = normalizeNutrientUnit(firstNonBlank(nutrientNode.path("unit").asText(""), inferUnitFromKey(key)));
        BigDecimal amount = getBigDecimal(nutrientNode, "value");

        upsertNutrient(nutrients, key, name, unit, amount, "");
    }

    private void addAiNutrient(Map<String, NutrientValue> nutrients, JsonNode nutrientNode) {
        if (nutrientNode == null || nutrientNode.isNull()) {
            return;
        }

        String key = nutrientNode.path("key").asText("").trim();
        String name = nutrientNode.path("name").asText("").trim();
        String unit = normalizeNutrientUnit(nutrientNode.path("unit").asText(""));
        String nutrientNumber = nutrientNode.path("nutrientNumber").asText("").trim();
        BigDecimal amount = getBigDecimal(nutrientNode, "amount");

        if (key.isBlank()) {
            key = resolveNutrientKey(nutrientNumber, name, unit);
        } else {
            key = normalizeStructuredNutrientKey(key, name, unit);
        }

        if (key.isBlank()) {
            return;
        }

        if (name.isBlank()) {
            name = humanizeNutrientKey(key);
        }

        if (unit.isBlank()) {
            unit = inferUnitFromKey(key);
        }

        upsertNutrient(nutrients, key, name, unit, amount, nutrientNumber);
    }

    private void addAiNutrient(Map<String, NutrientValue> nutrients, String rawKey, JsonNode nutrientNode) {
        if (nutrientNode == null || nutrientNode.isNull()) {
            return;
        }

        String key = normalizeStructuredNutrientKey(rawKey, rawKey, "");
        String name = humanizeNutrientKey(key);
        String unit = inferUnitFromKey(key);
        String nutrientNumber = "";
        BigDecimal amount;

        if (nutrientNode.isObject()) {
            name = firstNonBlank(nutrientNode.path("name").asText(""), name);
            unit = normalizeNutrientUnit(firstNonBlank(nutrientNode.path("unit").asText(""), unit));
            nutrientNumber = nutrientNode.path("nutrientNumber").asText("").trim();
            amount = getBigDecimal(nutrientNode, "amount");
        } else {
            amount = asBigDecimal(nutrientNode);
        }

        upsertNutrient(nutrients, key, name, unit, amount, nutrientNumber);
    }

    private void addLegacyAiNutrient(
            Map<String, NutrientValue> nutrients,
            String key,
            String name,
            String unit,
            BigDecimal amount) {
        if (amount == null) {
            return;
        }

        upsertNutrient(nutrients, key, name, unit, amount, "");
    }

    private void syncCacheMacros(NutritionCache cacheEntry, Map<String, NutrientValue> nutrients) {
        cacheEntry.setCalories(getNutrientAmount(nutrients, "calories"));
        cacheEntry.setProteinG(getNutrientAmount(nutrients, "protein"));
        cacheEntry.setCarbsG(getNutrientAmount(nutrients, "carbs"));
        cacheEntry.setFatsG(getNutrientAmount(nutrients, "fat"));
        cacheEntry.setFiberG(getNutrientAmount(nutrients, "fiber"));
        cacheEntry.setSugarG(getNutrientAmount(nutrients, "sugar"));
        cacheEntry.setSodiumMg(getNutrientAmount(nutrients, "sodium"));
    }

    private Map<String, NutrientValue> resolveStoredNutrients(NutritionCache cacheEntry) {
        Map<String, NutrientValue> resolvedNutrients = copyNutrients(cacheEntry.getNutrients());
        addLegacyStoredNutrient(resolvedNutrients, "calories", "Calories", "kcal", cacheEntry.getCalories(), "208");
        addLegacyStoredNutrient(resolvedNutrients, "protein", "Protein", "g", cacheEntry.getProteinG(), "203");
        addLegacyStoredNutrient(resolvedNutrients, "carbs", "Carbohydrates", "g", cacheEntry.getCarbsG(), "205");
        addLegacyStoredNutrient(resolvedNutrients, "fat", "Total Fat", "g", cacheEntry.getFatsG(), "204");
        addLegacyStoredNutrient(resolvedNutrients, "fiber", "Fiber", "g", cacheEntry.getFiberG(), "291");
        addLegacyStoredNutrient(resolvedNutrients, "sugar", "Sugar", "g", cacheEntry.getSugarG(), "269");
        addLegacyStoredNutrient(resolvedNutrients, "sodium", "Sodium", "mg", cacheEntry.getSodiumMg(), "307");
        return resolvedNutrients;
    }

    private void addLegacyStoredNutrient(
            Map<String, NutrientValue> nutrients,
            String key,
            String name,
            String unit,
            BigDecimal amount,
            String nutrientNumber) {
        if (amount == null) {
            return;
        }

        if (nutrients.containsKey(key) && nutrients.get(key) != null && nutrients.get(key).getAmount() != null) {
            return;
        }

        upsertNutrient(nutrients, key, name, unit, amount, nutrientNumber);
    }

    private Map<String, NutrientValue> scaleNutrients(Map<String, NutrientValue> storedNutrients, BigDecimal scaleFactor) {
        Map<String, NutrientValue> scaledNutrients = new LinkedHashMap<>();

        storedNutrients.forEach((key, nutrient) -> {
            if (key == null || key.isBlank() || nutrient == null) {
                return;
            }

            scaledNutrients.put(key, NutrientValue.builder()
                    .name(nutrient.getName())
                    .amount(scaleNutrient(nutrient.getAmount(), scaleFactor))
                    .unit(nutrient.getUnit())
                    .nutrientNumber(nutrient.getNutrientNumber())
                    .build());
        });

        return scaledNutrients;
    }

    private Map<String, NutrientValue> copyNutrients(Map<String, NutrientValue> nutrients) {
        Map<String, NutrientValue> copiedNutrients = new LinkedHashMap<>();

        if (nutrients == null || nutrients.isEmpty()) {
            return copiedNutrients;
        }

        nutrients.forEach((key, nutrient) -> {
            if (key == null || key.isBlank() || nutrient == null) {
                return;
            }

            copiedNutrients.put(key, NutrientValue.builder()
                    .name(nutrient.getName())
                    .amount(nutrient.getAmount())
                    .unit(nutrient.getUnit())
                    .nutrientNumber(nutrient.getNutrientNumber())
                    .build());
        });

        return copiedNutrients;
    }

    private BigDecimal getNutrientAmount(Map<String, NutrientValue> nutrients, String key) {
        NutrientValue nutrientValue = nutrients == null ? null : nutrients.get(key);
        if (nutrientValue == null || nutrientValue.getAmount() == null) {
            return BigDecimal.ZERO;
        }
        return nutrientValue.getAmount();
    }

    private void upsertNutrient(
            Map<String, NutrientValue> nutrients,
            String key,
            String name,
            String unit,
            BigDecimal amount,
            String nutrientNumber) {
        if (nutrients == null || key == null || key.isBlank()) {
            return;
        }

        String normalizedUnit = normalizeNutrientUnit(unit);
        NutrientValue incoming = NutrientValue.builder()
                .name(name == null || name.isBlank() ? humanizeNutrientKey(key) : name)
                .amount(amount == null ? BigDecimal.ZERO : amount)
                .unit(normalizedUnit)
                .nutrientNumber(nutrientNumber == null ? "" : nutrientNumber.trim())
                .build();

        NutrientValue existing = nutrients.get(key);
        if (existing == null) {
            nutrients.put(key, incoming);
            return;
        }

        if (normalizedUnit.equalsIgnoreCase(normalizeNutrientUnit(existing.getUnit()))) {
            if (shouldReplaceNutrient(existing, incoming)) {
                nutrients.put(key, incoming);
            }
            return;
        }

        String alternateKey = appendUnitSuffix(key, normalizedUnit);
        NutrientValue alternate = nutrients.get(alternateKey);
        if (alternate == null || shouldReplaceNutrient(alternate, incoming)) {
            nutrients.put(alternateKey, incoming);
        }
    }

    private boolean shouldReplaceNutrient(NutrientValue existing, NutrientValue incoming) {
        BigDecimal existingAmount = existing.getAmount() == null ? BigDecimal.ZERO : existing.getAmount();
        BigDecimal incomingAmount = incoming.getAmount() == null ? BigDecimal.ZERO : incoming.getAmount();

        if (existingAmount.compareTo(BigDecimal.ZERO) == 0 && incomingAmount.compareTo(BigDecimal.ZERO) != 0) {
            return true;
        }

        return (existing.getNutrientNumber() == null || existing.getNutrientNumber().isBlank())
                && incoming.getNutrientNumber() != null
                && !incoming.getNutrientNumber().isBlank();
    }

    private boolean hasExpandedNutrients(NutritionCache cacheEntry) {
        return cacheEntry.getNutrients() != null && !cacheEntry.getNutrients().isEmpty();
    }

    private boolean shouldUseCachedEntry(NutritionCache cacheEntry) {
        if (!hasExpandedNutrients(cacheEntry)) {
            return false;
        }

        if (isSpoonacularConfigured()) {
            return SPOONACULAR_SOURCE.equalsIgnoreCase(firstNonBlank(cacheEntry.getSource()));
        }

        return true;
    }

    private boolean shouldUpgradeCache(NutritionCache existingCacheEntry, NutritionCache incomingCacheEntry) {
        int existingPriority = getSourcePriority(existingCacheEntry.getSource());
        int incomingPriority = getSourcePriority(incomingCacheEntry.getSource());

        if (incomingPriority > existingPriority) {
            return true;
        }
        if (incomingPriority < existingPriority) {
            return false;
        }

        int existingCount = existingCacheEntry.getNutrients() == null ? 0 : existingCacheEntry.getNutrients().size();
        int incomingCount = incomingCacheEntry.getNutrients() == null ? 0 : incomingCacheEntry.getNutrients().size();

        return incomingCount > existingCount;
    }

    private void mergeCacheEntry(NutritionCache target, NutritionCache source) {
        target.setFoodName(source.getFoodName());
        target.setBaseUnit(source.getBaseUnit());
        target.setBaseQuantity(source.getBaseQuantity());
        Map<String, NutrientValue> mergedNutrients = copyNutrients(source.getNutrients());
        copyNutrients(target.getNutrients()).forEach(mergedNutrients::putIfAbsent);
        target.setNutrients(mergedNutrients);
        syncCacheMacros(target, mergedNutrients);
        target.setSource(source.getSource());
        target.setCachedAt(source.getCachedAt());
    }

    private boolean hasSpoonacularNutrition(JsonNode nutritionNode) {
        return getBigDecimal(nutritionNode.path("calories"), "value").compareTo(BigDecimal.ZERO) > 0
                || getBigDecimal(nutritionNode.path("fat"), "value").compareTo(BigDecimal.ZERO) > 0
                || getBigDecimal(nutritionNode.path("protein"), "value").compareTo(BigDecimal.ZERO) > 0
                || getBigDecimal(nutritionNode.path("carbs"), "value").compareTo(BigDecimal.ZERO) > 0;
    }

    private boolean isSpoonacularConfigured() {
        return spoonacularApiKey != null && !spoonacularApiKey.isBlank();
    }

    private int getSourcePriority(String source) {
        String normalizedSource = source == null ? "" : source.trim();
        if (SPOONACULAR_SOURCE.equalsIgnoreCase(normalizedSource)) {
            return 3;
        }
        if (AI_SOURCE.equalsIgnoreCase(normalizedSource)) {
            return 2;
        }
        if (USDA_SOURCE.equalsIgnoreCase(normalizedSource)) {
            return 1;
        }
        return 0;
    }

    private BigDecimal resolveUsdaBaseQuantity(JsonNode foodNode) {
        BigDecimal servingSize = getBigDecimal(foodNode, "servingSize");
        if (servingSize.compareTo(BigDecimal.ZERO) > 0) {
            return servingSize;
        }
        return DEFAULT_USDA_BASE_QUANTITY;
    }

    private String resolveUsdaBaseUnit(JsonNode foodNode, BigDecimal baseQuantity) {
        String servingSizeUnit = foodNode.path("servingSizeUnit").asText("").trim();
        if (!servingSizeUnit.isBlank()) {
            return formatBaseUnit(baseQuantity, servingSizeUnit);
        }
        return DEFAULT_USDA_BASE_LABEL;
    }

    private String formatBaseUnit(BigDecimal quantity, String unit) {
        String normalizedUnit = unit == null ? "" : unit.trim().toLowerCase(Locale.ROOT);
        String quantityText = quantity.stripTrailingZeros().toPlainString();

        if (normalizedUnit.isBlank()) {
            return quantityText;
        }
        if (COMPACT_UNITS.contains(normalizedUnit)) {
            return quantityText + normalizedUnit;
        }
        return quantityText + " " + normalizedUnit;
    }

    private ParsedUnit parseStoredUnit(String baseUnit, BigDecimal baseQuantity) {
        String unitLabel = extractUnitLabel(baseUnit);
        return parseUnit(baseQuantity, unitLabel);
    }

    private ParsedUnit parseRequestedUnit(BigDecimal quantity, String unit) {
        return parseUnit(quantity, unit);
    }

    private ParsedUnit parseUnit(BigDecimal quantity, String rawUnit) {
        String normalizedUnit = normalizeUnitLabel(rawUnit);
        UnitDescriptor descriptor = getUnitDescriptor(normalizedUnit);

        if (descriptor == null) {
            return new ParsedUnit(normalizedUnit, UnitDimension.UNKNOWN, null);
        }

        return new ParsedUnit(
                descriptor.canonicalUnit(),
                descriptor.dimension(),
                quantity.multiply(descriptor.factorToComparable(), SCALING_CONTEXT));
    }

    private String extractUnitLabel(String baseUnit) {
        if (baseUnit == null) {
            return "";
        }
        return baseUnit.replaceFirst("^[\\d.\\s]+", "").trim();
    }

    private String normalizeUnitLabel(String unit) {
        if (unit == null) {
            return "";
        }

        String normalized = unit.trim()
                .toLowerCase(Locale.ROOT)
                .replace(".", "")
                .replace("-", " ")
                .replace("_", " ")
                .replaceAll("\\s+", " ");

        return switch (normalized) {
            case "gram", "grams", "gm", "gms" -> "g";
            case "kilogram", "kilograms", "kilo", "kilos" -> "kg";
            case "milligram", "milligrams" -> "mg";
            case "microgram", "micrograms" -> "mcg";
            case "milliliter", "milliliters", "millilitre", "millilitres" -> "ml";
            case "liter", "liters", "litre", "litres" -> "l";
            case "ounce", "ounces" -> "oz";
            case "pound", "pounds" -> "lb";
            case "fluid ounce", "fluid ounces", "floz", "fl oz" -> "fl oz";
            case "cup", "cups" -> "cup";
            case "tablespoon", "tablespoons", "tbsp", "tbl", "tbs" -> "tbsp";
            case "teaspoon", "teaspoons", "tsp" -> "tsp";
            case "piece", "pieces", "pc", "pcs", "item", "items", "whole", "wholes", "unit", "units" -> "piece";
            case "serving", "servings" -> "serving";
            default -> normalized;
        };
    }

    private UnitDescriptor getUnitDescriptor(String normalizedUnit) {
        return switch (normalizedUnit) {
            case "g" -> new UnitDescriptor(UnitDimension.MASS, "g", BigDecimal.ONE);
            case "kg" -> new UnitDescriptor(UnitDimension.MASS, "g", GRAMS_PER_KILOGRAM);
            case "mg" -> new UnitDescriptor(UnitDimension.MASS, "g", GRAMS_PER_MILLIGRAM);
            case "mcg" -> new UnitDescriptor(UnitDimension.MASS, "g", new BigDecimal("0.000001"));
            case "oz" -> new UnitDescriptor(UnitDimension.MASS, "g", GRAMS_PER_OUNCE);
            case "lb" -> new UnitDescriptor(UnitDimension.MASS, "g", GRAMS_PER_POUND);
            case "ml" -> new UnitDescriptor(UnitDimension.VOLUME, "ml", BigDecimal.ONE);
            case "l" -> new UnitDescriptor(UnitDimension.VOLUME, "ml", MILLILITERS_PER_LITER);
            case "cup" -> new UnitDescriptor(UnitDimension.VOLUME, "ml", MILLILITERS_PER_CUP);
            case "tbsp" -> new UnitDescriptor(UnitDimension.VOLUME, "ml", MILLILITERS_PER_TABLESPOON);
            case "tsp" -> new UnitDescriptor(UnitDimension.VOLUME, "ml", MILLILITERS_PER_TEASPOON);
            case "fl oz" -> new UnitDescriptor(UnitDimension.VOLUME, "ml", MILLILITERS_PER_FLUID_OUNCE);
            case "piece" -> new UnitDescriptor(UnitDimension.COUNT, "piece", BigDecimal.ONE);
            case "serving" -> new UnitDescriptor(UnitDimension.COUNT, "serving", BigDecimal.ONE);
            default -> null;
        };
    }

    private BigDecimal getBigDecimal(JsonNode node, String field) {
        return asBigDecimal(node.path(field));
    }

    private BigDecimal asBigDecimal(JsonNode valueNode) {
        if (valueNode == null || valueNode.isMissingNode() || valueNode.isNull()) {
            return BigDecimal.ZERO;
        }
        if (valueNode.isNumber()) {
            return valueNode.decimalValue();
        }

        String text = valueNode.asText("").trim();
        if (text.isBlank()) {
            return BigDecimal.ZERO;
        }

        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private String buildAiNutritionPrompt(String foodName) {
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

    private String extractJsonObject(String rawText) {
        String cleaned = rawText == null ? "" : rawText.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }

        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }

        cleaned = cleaned.trim();
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start == -1 || end == -1 || end <= start) {
            throw new IllegalArgumentException("No JSON object found in AI response");
        }
        return cleaned.substring(start, end + 1);
    }

    private String serializeCacheEntry(NutritionCache cacheEntry) {
        try {
            return objectMapper.writeValueAsString(cacheEntry);
        } catch (JsonProcessingException e) {
            logger.warn("Failed to serialize cache entry for '{}': {}", cacheEntry.getFoodName(), e.getMessage());
            return "Unable to serialize cached nutrition entry";
        }
    }

    private void handleEnrichmentError(NutritionDetails details, String errorMessage) {
        details.setRetryCount(details.getRetryCount() + 1);
        details.setEnrichmentError(errorMessage);

        if (details.getRetryCount() >= MAX_RETRY_COUNT) {
            details.setEnrichmentStatus("failed");
        } else {
            details.setEnrichmentStatus("pending");
        }

        nutritionDetailsRepository.save(details);
    }

    private String resolveNutrientKey(String nutrientNumber, String nutrientName, String unit) {
        String normalizedName = normalizeNutrientName(nutrientName);
        String normalizedUnit = normalizeNutrientUnit(unit);

        if ("208".equals(nutrientNumber) || "957".equals(nutrientNumber) || normalizedName.startsWith("energy")) {
            return "calories";
        }
        if ("203".equals(nutrientNumber) || "protein".equals(normalizedName)) {
            return "protein";
        }
        if ("205".equals(nutrientNumber) || normalizedName.startsWith("carbohydrate")) {
            return "carbs";
        }
        if ("204".equals(nutrientNumber) || normalizedName.startsWith("total lipid")) {
            return "fat";
        }
        if ("645".equals(nutrientNumber) || normalizedName.contains("monounsaturated")) {
            return "monounsaturatedFat";
        }
        if ("646".equals(nutrientNumber) || normalizedName.contains("polyunsaturated")) {
            return "polyunsaturatedFat";
        }
        if ("606".equals(nutrientNumber)
                || (normalizedName.contains("saturated")
                        && !normalizedName.contains("monounsaturated")
                        && !normalizedName.contains("polyunsaturated"))) {
            return "saturatedFat";
        }
        if ("605".equals(nutrientNumber) || normalizedName.contains("total trans")) {
            return "transFat";
        }
        if ("601".equals(nutrientNumber) || "cholesterol".equals(normalizedName)) {
            return "cholesterol";
        }
        if ("291".equals(nutrientNumber) || normalizedName.startsWith("fiber")) {
            return "fiber";
        }
        if ("269".equals(nutrientNumber) || "269.3".equals(nutrientNumber) || normalizedName.startsWith("sugars, total")) {
            return "sugar";
        }
        if ("539".equals(nutrientNumber) || normalizedName.contains("sugars, added")) {
            return "addedSugar";
        }
        if ("307".equals(nutrientNumber) || normalizedName.startsWith("sodium")) {
            return "sodium";
        }
        if ("306".equals(nutrientNumber) || normalizedName.startsWith("potassium")) {
            return "potassium";
        }
        if ("301".equals(nutrientNumber) || normalizedName.startsWith("calcium")) {
            return "calcium";
        }
        if ("303".equals(nutrientNumber) || normalizedName.startsWith("iron")) {
            return "iron";
        }
        if ("304".equals(nutrientNumber) || normalizedName.startsWith("magnesium")) {
            return "magnesium";
        }
        if ("305".equals(nutrientNumber) || normalizedName.startsWith("phosphorus")) {
            return "phosphorus";
        }
        if ("309".equals(nutrientNumber) || normalizedName.startsWith("zinc")) {
            return "zinc";
        }
        if ("312".equals(nutrientNumber) || normalizedName.startsWith("copper")) {
            return "copper";
        }
        if ("315".equals(nutrientNumber) || normalizedName.startsWith("manganese")) {
            return "manganese";
        }
        if ("317".equals(nutrientNumber) || normalizedName.startsWith("selenium")) {
            return "selenium";
        }
        if ("320".equals(nutrientNumber) || "vitamin a, rae".equals(normalizedName)) {
            return "vitaminA";
        }
        if ("318".equals(nutrientNumber) || "vitamin a, iu".equals(normalizedName)) {
            return "vitaminAIu";
        }
        if ("401".equals(nutrientNumber) || normalizedName.startsWith("vitamin c")) {
            return "vitaminC";
        }
        if ("328".equals(nutrientNumber) || (normalizedName.startsWith("vitamin d") && "mcg".equals(normalizedUnit))) {
            return "vitaminD";
        }
        if ("324".equals(nutrientNumber) || (normalizedName.startsWith("vitamin d") && "iu".equals(normalizedUnit))) {
            return "vitaminDIu";
        }
        if ("323".equals(nutrientNumber) || normalizedName.startsWith("vitamin e")) {
            return "vitaminE";
        }
        if ("430".equals(nutrientNumber) || normalizedName.startsWith("vitamin k")) {
            return "vitaminK";
        }
        if ("404".equals(nutrientNumber) || "thiamin".equals(normalizedName)) {
            return "thiamin";
        }
        if ("405".equals(nutrientNumber) || "riboflavin".equals(normalizedName)) {
            return "riboflavin";
        }
        if ("406".equals(nutrientNumber) || "niacin".equals(normalizedName)) {
            return "niacin";
        }
        if ("410".equals(nutrientNumber) || "pantothenic acid".equals(normalizedName)) {
            return "pantothenicAcid";
        }
        if ("415".equals(nutrientNumber) || normalizedName.startsWith("vitamin b-6")) {
            return "vitaminB6";
        }
        if ("417".equals(nutrientNumber) || normalizedName.startsWith("folate")) {
            return "folate";
        }
        if ("418".equals(nutrientNumber) || normalizedName.startsWith("vitamin b-12")) {
            return "vitaminB12";
        }
        if ("421".equals(nutrientNumber) || normalizedName.startsWith("choline")) {
            return "choline";
        }
        if ("262".equals(nutrientNumber) || "caffeine".equals(normalizedName)) {
            return "caffeine";
        }
        if ("255".equals(nutrientNumber) || "water".equals(normalizedName)) {
            return "water";
        }

        return toFallbackNutrientKey(nutrientName, nutrientNumber);
    }

    private String normalizeNutrientName(String nutrientName) {
        if (nutrientName == null) {
            return "";
        }

        return nutrientName.trim()
                .toLowerCase(Locale.ROOT)
                .replace("_", " ")
                .replaceAll("\\s+", " ");
    }

    private String normalizeNutrientUnit(String unit) {
        if (unit == null) {
            return "";
        }

        String normalized = unit.trim()
                .toLowerCase(Locale.ROOT)
                .replace(".", "")
                .replace("µ", "u")
                .replaceAll("\\s+", " ");

        return switch (normalized) {
            case "kcal", "calorie", "calories" -> "kcal";
            case "kj" -> "kj";
            case "gram", "grams", "g" -> "g";
            case "milligram", "milligrams", "mg" -> "mg";
            case "microgram", "micrograms", "mcg", "ug" -> "mcg";
            case "iu", "international unit", "international units" -> "iu";
            case "%" -> "%";
            default -> normalized;
        };
    }

    private String inferUnitFromKey(String key) {
        return switch (key) {
            case "calories" -> "kcal";
            case "sodium", "potassium", "calcium", "iron", "magnesium", "zinc", "phosphorus",
                    "copper", "manganese", "selenium", "vitaminC", "vitaminE", "cholesterol",
                    "caffeine" -> "mg";
            case "vitaminA", "vitaminD", "vitaminK", "biotin" -> "mcg";
            case "vitaminAIu", "vitaminDIu" -> "iu";
            case "protein", "carbs", "fat", "fiber", "sugar", "addedSugar", "saturatedFat",
                    "monounsaturatedFat", "polyunsaturatedFat", "transFat", "water" -> "g";
            default -> "";
        };
    }

    private String normalizeStructuredNutrientKey(String rawKey, String fallbackName, String unit) {
        String candidate = toCamelCaseKey(rawKey);
        candidate = switch (candidate) {
            case "caloriesKcal" -> "calories";
            case "proteinG" -> "protein";
            case "carbohydrates", "carbohydratesG" -> "carbs";
            case "fatG" -> "fat";
            case "fiberG" -> "fiber";
            case "sugarG" -> "sugar";
            case "sodiumMg" -> "sodium";
            default -> candidate;
        };

        if (!candidate.isBlank()) {
            return candidate;
        }

        if (fallbackName != null && !fallbackName.isBlank()) {
            return resolveNutrientKey("", fallbackName, unit);
        }

        return "";
    }

    private String toFallbackNutrientKey(String nutrientName, String nutrientNumber) {
        String keyFromName = toCamelCaseKey(nutrientName);
        if (!keyFromName.isBlank()) {
            return keyFromName;
        }
        if (nutrientNumber != null && !nutrientNumber.isBlank()) {
            return "nutrient" + nutrientNumber.replaceAll("[^a-zA-Z0-9]", "");
        }
        return "";
    }

    private String toCamelCaseKey(String rawText) {
        if (rawText == null) {
            return "";
        }

        String cleaned = rawText.trim()
                .replace("&", " and ")
                .replace("%", " percent ")
                .replaceAll("([a-z])([A-Z])", "$1 $2")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();

        if (cleaned.isBlank()) {
            return "";
        }

        String[] parts = cleaned.split("\\s+");
        StringBuilder key = new StringBuilder(parts[0]);
        for (int i = 1; i < parts.length; i++) {
            if (parts[i].isBlank()) {
                continue;
            }
            key.append(Character.toUpperCase(parts[i].charAt(0)));
            key.append(parts[i].substring(1));
        }

        if (Character.isDigit(key.charAt(0))) {
            key.insert(0, "n");
        }

        return key.toString();
    }

    private String humanizeNutrientKey(String key) {
        if (key == null || key.isBlank()) {
            return "Nutrient";
        }

        String text = key.replaceAll("([a-z])([A-Z])", "$1 $2");
        return Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }

    private String appendUnitSuffix(String key, String unit) {
        String unitKey = toCamelCaseKey(unit);
        if (unitKey.isBlank()) {
            return key + "Value";
        }
        return key + Character.toUpperCase(unitKey.charAt(0)) + unitKey.substring(1);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private String normalizeFoodName(String foodName) {
        return foodName == null ? ""
                : foodName.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private record ResolvedNutritionData(NutritionCache cacheEntry, String lookupSource, String apiPayload) {
    }

    private record ParsedUnit(String normalizedUnit, UnitDimension dimension, BigDecimal comparableQuantity) {
    }

    private record UnitDescriptor(UnitDimension dimension, String canonicalUnit, BigDecimal factorToComparable) {
    }

    private enum UnitDimension {
        MASS,
        VOLUME,
        COUNT,
        UNKNOWN
    }
}
