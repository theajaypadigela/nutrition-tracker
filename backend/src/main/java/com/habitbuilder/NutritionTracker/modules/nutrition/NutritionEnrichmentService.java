package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.food.FoodEntry;
import com.habitbuilder.NutritionTracker.modules.food.FoodEntryRepository;

@Service
public class NutritionEnrichmentService {

    private static final Logger logger = LoggerFactory.getLogger(NutritionEnrichmentService.class);
    private static final int MAX_RETRY_COUNT = 3;

    private final GeminiService geminiService;
    private final NutritionDetailsRepository nutritionDetailsRepository;
    private final NutritionCacheRepository nutritionCacheRepository;
    private final FoodEntryRepository foodEntryRepository;
    private final ObjectMapper objectMapper;

    public NutritionEnrichmentService(
            GeminiService geminiService,
            NutritionDetailsRepository nutritionDetailsRepository,
            NutritionCacheRepository nutritionCacheRepository,
            FoodEntryRepository foodEntryRepository,
            ObjectMapper objectMapper) {
        this.geminiService = geminiService;
        this.nutritionDetailsRepository = nutritionDetailsRepository;
        this.nutritionCacheRepository = nutritionCacheRepository;
        this.foodEntryRepository = foodEntryRepository;
        this.objectMapper = objectMapper;
    }

    @Async
    public void enrichFoodEntry(FoodEntry foodEntry) {
        logger.info("Starting nutrition enrichment for food entry: {} ({} {})",
                foodEntry.getName(), foodEntry.getQuantity(), foodEntry.getUnit());

        // Generate hash for caching
        String entryHash = generateEntryHash(foodEntry.getName(), foodEntry.getQuantity(), foodEntry.getUnit());

        // Create or get the NutritionDetails record
        NutritionDetails nutritionDetails = getOrCreateNutritionDetails(foodEntry);
        nutritionDetails.setEnrichmentStatus("in_progress");
        nutritionDetailsRepository.save(nutritionDetails);

        // Update the food entry with the hash
        foodEntry.setEntryHash(entryHash);
        foodEntryRepository.save(foodEntry);

        try {
            // Check cache first
            Optional<NutritionCache> cachedNutrition = nutritionCacheRepository.findByEntryHash(entryHash);

            NutritionResponse nutritionResponse;
            if (cachedNutrition.isPresent()) {
                logger.info("Found cached nutrition data for hash: {}", entryHash);
                nutritionResponse = objectMapper.readValue(cachedNutrition.get().getPayload(), NutritionResponse.class);
                nutritionDetails.setApiResponse(cachedNutrition.get().getPayload());
            } else {
                // Get raw response first and store it
                String rawApiResponse = null;
                try {
                    rawApiResponse = geminiService.getRawNutritionResponse(
                            foodEntry.getName(),
                            foodEntry.getQuantity(),
                            foodEntry.getUnit());
                    nutritionDetails.setApiResponse(rawApiResponse);
                    nutritionDetailsRepository.save(nutritionDetails);
                    logger.info("Stored raw API response for food entry: {}", foodEntry.getName());
                } catch (Exception rawEx) {
                    nutritionDetails.setApiResponse("API call failed: " + rawEx.getMessage());
                    nutritionDetailsRepository.save(nutritionDetails);
                    if (rawEx instanceof GeminiApiException) {
                        throw (GeminiApiException) rawEx;
                    }
                    throw new GeminiApiException("Failed to fetch raw API response", rawEx.getMessage(), rawEx);
                }

                logger.info("Parsing nutrition data from raw response");
                nutritionResponse = geminiService.parseNutritionResponse(rawApiResponse);

                // Cache the response
                cacheNutritionResponse(entryHash, nutritionResponse);
            }

            // Update nutrition details with the response
            updateNutritionDetails(nutritionDetails, nutritionResponse);
            nutritionDetails.setEnrichmentStatus("completed");
            nutritionDetails.setEnrichedAt(Instant.now());
            nutritionDetails.setEnrichmentError(null);
            nutritionDetailsRepository.save(nutritionDetails);

            logger.info("Successfully enriched nutrition for food entry: {}", foodEntry.getName());

        } catch (GeminiApiException e) {
            logger.error("Gemini API error for food entry {}: {} - Raw response: {}", foodEntry.getName(), e.getMessage(), e.getRawResponse());
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

    private void updateNutritionDetails(NutritionDetails details, NutritionResponse response) {
        details.setCalories(response.getCalories());
        details.setProteinG(response.getProteinG());
        details.setCarbsG(response.getCarbsG());
        details.setFatsG(response.getFatsG());
        details.setFiberG(response.getFiberG());
        details.setSugarG(response.getSugarG());
        details.setSodiumMg(response.getSodiumMg());
    }

    private void cacheNutritionResponse(String entryHash, NutritionResponse response) {
        try {
            NutritionCache cache = new NutritionCache();
            cache.setEntryHash(entryHash);
            cache.setPayload(objectMapper.writeValueAsString(response));
            nutritionCacheRepository.save(cache);
            logger.info("Cached nutrition response for hash: {}", entryHash);
        } catch (JsonProcessingException e) {
            logger.error("Error caching nutrition response", e);
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

    private String generateEntryHash(String name, double quantity, String unit) {
        String input = String.format("%s|%.2f|%s", name.toLowerCase().trim(), quantity, unit.toLowerCase().trim());
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            // Fallback to simple hash if SHA-256 is not available
            return String.valueOf(input.hashCode());
        }
    }
}
