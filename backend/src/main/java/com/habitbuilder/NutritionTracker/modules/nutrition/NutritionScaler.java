package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.habitbuilder.NutritionTracker.modules.nutrition.units.UnitConversion;
import com.habitbuilder.NutritionTracker.modules.nutrition.units.UnitConversion.ParsedUnit;

/**
 * Scales a cached per-base-unit nutrition entry (e.g. per 100g) to the
 * quantity/unit the user actually logged (e.g. 250g, or "2 bowls" treated as
 * a serving count when units aren't convertible).
 */
@Component
public class NutritionScaler {

    private static final Logger logger = LoggerFactory.getLogger(NutritionScaler.class);

    public NutritionResponse scale(NutritionCache cacheEntry, double currentQuantity, String currentUnit) {
        BigDecimal scaleFactor = resolveScaleFactor(cacheEntry, currentQuantity, currentUnit);
        Map<String, NutrientValue> scaledNutrients = Nutrients.scale(Nutrients.resolveStored(cacheEntry), scaleFactor);

        return NutritionResponse.builder()
                .calories(Nutrients.getAmount(scaledNutrients, "calories"))
                .proteinG(Nutrients.getAmount(scaledNutrients, "protein"))
                .carbsG(Nutrients.getAmount(scaledNutrients, "carbs"))
                .fatsG(Nutrients.getAmount(scaledNutrients, "fat"))
                .fiberG(Nutrients.getAmount(scaledNutrients, "fiber"))
                .sugarG(Nutrients.getAmount(scaledNutrients, "sugar"))
                .sodiumMg(Nutrients.getAmount(scaledNutrients, "sodium"))
                .nutrients(scaledNutrients)
                .build();
    }

    private BigDecimal resolveScaleFactor(NutritionCache cacheEntry, double currentQuantity, String currentUnit) {
        BigDecimal requestedQuantity = BigDecimal.valueOf(currentQuantity);
        BigDecimal storedBaseQuantity = cacheEntry.getBaseQuantity();

        if (storedBaseQuantity == null || storedBaseQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ONE;
        }

        ParsedUnit storedUnit = UnitConversion.parseStoredUnit(cacheEntry.getBaseUnit(), storedBaseQuantity);
        ParsedUnit requestedUnit = UnitConversion.parseUnit(requestedQuantity, currentUnit);

        if (storedUnit.comparableQuantity() != null
                && requestedUnit.comparableQuantity() != null
                && storedUnit.dimension() == requestedUnit.dimension()) {
            return requestedUnit.comparableQuantity().divide(storedUnit.comparableQuantity(),
                    UnitConversion.SCALING_CONTEXT);
        }

        if (!storedUnit.normalizedUnit().isBlank()
                && storedUnit.normalizedUnit().equals(requestedUnit.normalizedUnit())) {
            return requestedQuantity.divide(storedBaseQuantity, UnitConversion.SCALING_CONTEXT);
        }

        if (UnitConversion.isNaturalServingUnit(requestedUnit)) {
            logger.info(
                    "Treating current unit '{}' as a serving count for food '{}' because it cannot be converted to stored unit '{}'",
                    currentUnit, cacheEntry.getFoodName(), cacheEntry.getBaseUnit());
            return requestedQuantity;
        }

        logger.warn("Could not safely convert current unit '{}' to stored unit '{}' for food '{}'; falling back to quantity ratio",
                currentUnit, cacheEntry.getBaseUnit(), cacheEntry.getFoodName());
        return requestedQuantity.divide(storedBaseQuantity, UnitConversion.SCALING_CONTEXT);
    }
}
