package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.habitbuilder.NutritionTracker.config.properties.NutritionProviderProperties;
import com.habitbuilder.NutritionTracker.modules.food.FoodEntry;
import com.habitbuilder.NutritionTracker.modules.food.FoodEntryRepository;
import com.habitbuilder.NutritionTracker.modules.nutrition.provider.AiNutritionProvider;
import com.habitbuilder.NutritionTracker.modules.nutrition.provider.NutritionProvider;

/**
 * Orchestrates asynchronous nutrition enrichment of food entries: resolves
 * nutrition data (cache first, then the configured provider chain), scales it
 * to the logged quantity, and tracks per-entry enrichment status with retries.
 *
 * Data-source specifics live in {@link NutritionProvider} implementations;
 * scaling in {@link NutritionScaler}; cache policy in {@link NutritionCacheService}.
 */
@Service
public class NutritionEnrichmentService {

    private static final Logger logger = LoggerFactory.getLogger(NutritionEnrichmentService.class);
    private static final int MAX_RETRY_COUNT = 3;

    private final NutritionDetailsRepository nutritionDetailsRepository;
    private final FoodEntryRepository foodEntryRepository;
    private final NutritionCacheService cacheService;
    private final NutritionScaler scaler;
    private final List<NutritionProvider> providerChain;

    public NutritionEnrichmentService(
            NutritionDetailsRepository nutritionDetailsRepository,
            FoodEntryRepository foodEntryRepository,
            NutritionCacheService cacheService,
            NutritionScaler scaler,
            List<NutritionProvider> providers,
            NutritionProviderProperties providerProperties) {
        this.nutritionDetailsRepository = nutritionDetailsRepository;
        this.foodEntryRepository = foodEntryRepository;
        this.cacheService = cacheService;
        this.scaler = scaler;
        this.providerChain = resolveProviderChain(providers, providerProperties.providerChain());

        logger.info("Nutrition provider chain: {}",
                providerChain.stream().map(NutritionProvider::source).toList());
    }

    @Scheduled(fixedDelay = 300_000, initialDelay = 60_000) // every 5 min, first run after 1 min
    public void retryPendingEnrichments() {
        List<NutritionDetails> pending = nutritionDetailsRepository
                .findByEnrichmentStatusAndRetryCountLessThan("pending", MAX_RETRY_COUNT);
        if (pending.isEmpty()) return;

        logger.info("Retrying nutrition enrichment for {} pending entries", pending.size());
        for (NutritionDetails nd : pending) {
            foodEntryRepository.findById(nd.getFoodEntryId()).ifPresent(this::enrichFoodEntry);
        }
    }

    @Async
    public void enrichFoodEntry(FoodEntry foodEntry) {
        logger.info("Starting nutrition enrichment for food entry: {} ({} {})",
                foodEntry.getName(), foodEntry.getQuantity(), foodEntry.getUnit());

        NutritionDetails nutritionDetails = getOrCreateNutritionDetails(foodEntry);
        nutritionDetails.setEnrichmentStatus("in_progress");
        nutritionDetailsRepository.save(nutritionDetails);

        try {
            ResolvedNutrition resolvedNutrition = resolveNutrition(foodEntry.getName());
            double effectiveQuantity = foodEntry.getStandardQuantity() != null && foodEntry.getStandardQuantity() > 0
                    ? foodEntry.getStandardQuantity()
                    : foodEntry.getQuantity();
            String effectiveUnit = foodEntry.getStandardUnit() != null && !foodEntry.getStandardUnit().isBlank()
                    ? foodEntry.getStandardUnit()
                    : foodEntry.getUnit();
            if (foodEntry.getStandardQuantity() != null) {
                logger.info("Using standard unit for nutrition scaling: {} {} (display: {} {})",
                        effectiveQuantity, effectiveUnit, foodEntry.getQuantity(), foodEntry.getUnit());
            }
            NutritionResponse scaledResponse = scaler.scale(
                    resolvedNutrition.cacheEntry(),
                    effectiveQuantity,
                    effectiveUnit);

            nutritionDetails.setApiResponse(resolvedNutrition.apiPayload());
            applyResolvedNutrition(nutritionDetails, scaledResponse, resolvedNutrition);
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

    private ResolvedNutrition resolveNutrition(String foodName) {
        String normalizedFoodName = NutrientKeys.normalizeFoodName(foodName);

        Optional<NutritionCache> cachedNutrition = cacheService.findCached(foodName, normalizedFoodName);
        if (cachedNutrition.isPresent()) {
            NutritionCache cachedEntry = cachedNutrition.get();
            if (cacheService.shouldUseCachedEntry(cachedEntry, preferredSource())) {
                logger.info("Nutrition cache hit for food '{}'", foodName);
                return new ResolvedNutrition(cachedEntry, "cache-hit", cacheService.serialize(cachedEntry));
            }

            logger.info("Nutrition cache hit for food '{}' is stale for current source preference; refreshing", foodName);
        }

        for (NutritionProvider provider : providerChain) {
            Optional<NutritionProvider.ProviderResult> result = provider.fetch(foodName, normalizedFoodName);
            if (result.isPresent()) {
                NutritionCache savedCacheEntry = cacheService.save(result.get().cacheEntry());
                String lookupSource = provider.source().toLowerCase(Locale.ROOT) + "-hit";
                logger.info("{} hit for '{}', cached with base unit {}",
                        provider.source(), foodName, savedCacheEntry.getBaseUnit());
                return new ResolvedNutrition(savedCacheEntry, lookupSource, result.get().rawPayload());
            }
        }

        throw new IllegalStateException("No nutrition provider returned data for '" + foodName + "'");
    }

    /**
     * The source cached entries must come from to be reused without a refresh:
     * the first configured non-AI provider in the chain, or none when only the
     * AI fallback is available (any cached entry is then acceptable).
     */
    private String preferredSource() {
        return providerChain.stream()
                .filter(NutritionProvider::isConfigured)
                .map(NutritionProvider::source)
                .filter(source -> !AiNutritionProvider.SOURCE.equalsIgnoreCase(source))
                .findFirst()
                .orElse(null);
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

    private void applyResolvedNutrition(
            NutritionDetails details,
            NutritionResponse response,
            ResolvedNutrition resolvedNutrition) {
        details.setCalories(response.getCalories());
        details.setProteinG(response.getProteinG());
        details.setCarbsG(response.getCarbsG());
        details.setFatsG(response.getFatsG());
        details.setFiberG(response.getFiberG());
        details.setSugarG(response.getSugarG());
        details.setSodiumMg(response.getSodiumMg());
        details.setNutrients(Nutrients.copy(response.getNutrients()));
        details.setBaseUnit(resolvedNutrition.cacheEntry().getBaseUnit());
        details.setBaseQuantity(resolvedNutrition.cacheEntry().getBaseQuantity());
        details.setSource(resolvedNutrition.cacheEntry().getSource());
        details.setLookupSource(resolvedNutrition.lookupSource());
        details.setCachedAt(resolvedNutrition.cacheEntry().getCachedAt());
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

    private static List<NutritionProvider> resolveProviderChain(List<NutritionProvider> providers, String chainConfig) {
        Map<String, NutritionProvider> providersBySource = providers.stream()
                .collect(Collectors.toMap(
                        provider -> provider.source().toLowerCase(Locale.ROOT),
                        Function.identity()));

        List<NutritionProvider> chain = new ArrayList<>();
        for (String entry : chainConfig.split(",")) {
            String source = entry.trim().toLowerCase(Locale.ROOT);
            if (source.isEmpty()) {
                continue;
            }
            NutritionProvider provider = providersBySource.get(source);
            if (provider == null) {
                throw new IllegalStateException("Unknown nutrition provider in nutrition.provider-chain: " + source);
            }
            chain.add(provider);
        }

        if (chain.isEmpty()) {
            throw new IllegalStateException("nutrition.provider-chain resolved to an empty provider list");
        }
        return chain;
    }

    private record ResolvedNutrition(NutritionCache cacheEntry, String lookupSource, String apiPayload) {
    }
}
