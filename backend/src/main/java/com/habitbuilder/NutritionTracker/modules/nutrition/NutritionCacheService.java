package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Lookup and persistence policy for the shared per-food nutrition cache:
 * which cached entries are trustworthy, and which sources may overwrite which.
 */
@Service
public class NutritionCacheService {

    private static final Logger logger = LoggerFactory.getLogger(NutritionCacheService.class);

    /** Higher wins when two sources race to cache the same food. */
    private static final Map<String, Integer> SOURCE_PRIORITY = Map.of(
            "SPOONACULAR", 3,
            "AI", 2,
            "USDA", 1);

    private final NutritionCacheRepository nutritionCacheRepository;
    private final ObjectMapper objectMapper;

    public NutritionCacheService(NutritionCacheRepository nutritionCacheRepository, ObjectMapper objectMapper) {
        this.nutritionCacheRepository = nutritionCacheRepository;
        this.objectMapper = objectMapper;
    }

    public Optional<NutritionCache> findCached(String foodName, String normalizedFoodName) {
        Optional<NutritionCache> cached = nutritionCacheRepository.findFirstByNormalizedFoodName(normalizedFoodName);
        if (cached.isEmpty() && foodName != null && !foodName.isBlank()) {
            cached = nutritionCacheRepository.findFirstByFoodNameIgnoreCase(foodName.trim());
        }
        return cached;
    }

    /**
     * A cached entry is only reused when it has the expanded nutrient map and,
     * if a preferred source is configured, came from that source — otherwise it
     * is refreshed so the better source can replace it.
     */
    public boolean shouldUseCachedEntry(NutritionCache cacheEntry, String preferredSource) {
        if (cacheEntry.getNutrients() == null || cacheEntry.getNutrients().isEmpty()) {
            return false;
        }

        if (preferredSource == null || preferredSource.isBlank()) {
            return true;
        }

        return preferredSource.equalsIgnoreCase(NutrientKeys.firstNonBlank(cacheEntry.getSource()));
    }

    /** Saves a new entry, merging into the existing one when another writer got there first. */
    public NutritionCache save(NutritionCache cacheEntry) {
        try {
            return nutritionCacheRepository.save(cacheEntry);
        } catch (DuplicateKeyException e) {
            logger.info("Nutrition cache entry already exists for '{}', reusing cached value",
                    cacheEntry.getNormalizedFoodName());
            NutritionCache existingCacheEntry = nutritionCacheRepository.findFirstByNormalizedFoodName(
                    cacheEntry.getNormalizedFoodName()).orElseThrow(() -> e);

            if (shouldUpgradeCache(existingCacheEntry, cacheEntry)) {
                mergeCacheEntry(existingCacheEntry, cacheEntry);
                return nutritionCacheRepository.save(existingCacheEntry);
            }

            return existingCacheEntry;
        }
    }

    public String serialize(NutritionCache cacheEntry) {
        try {
            return objectMapper.writeValueAsString(cacheEntry);
        } catch (JsonProcessingException e) {
            logger.warn("Failed to serialize cache entry for '{}': {}", cacheEntry.getFoodName(), e.getMessage());
            return "Unable to serialize cached nutrition entry";
        }
    }

    private boolean shouldUpgradeCache(NutritionCache existingCacheEntry, NutritionCache incomingCacheEntry) {
        int existingPriority = getSourcePriority(existingCacheEntry.getSource());
        int incomingPriority = getSourcePriority(incomingCacheEntry.getSource());

        if (incomingPriority != existingPriority) {
            return incomingPriority > existingPriority;
        }

        int existingCount = existingCacheEntry.getNutrients() == null ? 0 : existingCacheEntry.getNutrients().size();
        int incomingCount = incomingCacheEntry.getNutrients() == null ? 0 : incomingCacheEntry.getNutrients().size();

        return incomingCount > existingCount;
    }

    private void mergeCacheEntry(NutritionCache target, NutritionCache source) {
        target.setFoodName(source.getFoodName());
        target.setBaseUnit(source.getBaseUnit());
        target.setBaseQuantity(source.getBaseQuantity());
        Map<String, NutrientValue> mergedNutrients = Nutrients.copy(source.getNutrients());
        Nutrients.copy(target.getNutrients()).forEach(mergedNutrients::putIfAbsent);
        target.setNutrients(mergedNutrients);
        Nutrients.syncCacheMacros(target, mergedNutrients);
        target.setSource(source.getSource());
        target.setCachedAt(source.getCachedAt());
    }

    private int getSourcePriority(String source) {
        String normalizedSource = source == null ? "" : source.trim().toUpperCase(java.util.Locale.ROOT);
        return SOURCE_PRIORITY.getOrDefault(normalizedSource, 0);
    }
}
