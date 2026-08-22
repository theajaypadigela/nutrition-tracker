package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

import com.habitbuilder.NutritionTracker.modules.nutrition.units.UnitConversion;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutrientValue;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionCache;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionDetails;

/**
 * Operations on nutrient maps ({@code key -> NutrientValue}): defensive
 * copying, unit-aware upserts, scaling, and resolving stored records that
 * predate the expanded-nutrients map (legacy macro columns only).
 */
public final class Nutrients {

    private Nutrients() {
    }

    public static Map<String, NutrientValue> copy(Map<String, NutrientValue> nutrients) {
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

    public static BigDecimal getAmount(Map<String, NutrientValue> nutrients, String key) {
        NutrientValue nutrientValue = nutrients == null ? null : nutrients.get(key);
        if (nutrientValue == null || nutrientValue.getAmount() == null) {
            return BigDecimal.ZERO;
        }
        return nutrientValue.getAmount();
    }

    public static Map<String, NutrientValue> scale(Map<String, NutrientValue> storedNutrients, BigDecimal scaleFactor) {
        Map<String, NutrientValue> scaledNutrients = new LinkedHashMap<>();

        storedNutrients.forEach((key, nutrient) -> {
            if (key == null || key.isBlank() || nutrient == null) {
                return;
            }

            BigDecimal amount = nutrient.getAmount() == null
                    ? BigDecimal.ZERO
                    : nutrient.getAmount().multiply(scaleFactor, UnitConversion.SCALING_CONTEXT);

            scaledNutrients.put(key, NutrientValue.builder()
                    .name(nutrient.getName())
                    .amount(amount)
                    .unit(nutrient.getUnit())
                    .nutrientNumber(nutrient.getNutrientNumber())
                    .build());
        });

        return scaledNutrients;
    }

    /**
     * Adds or replaces a nutrient, keyed canonically. When the same key arrives
     * with a different unit, the value is stored under a unit-suffixed key
     * instead of clobbering the original.
     */
    public static void upsert(
            Map<String, NutrientValue> nutrients,
            String key,
            String name,
            String unit,
            BigDecimal amount,
            String nutrientNumber) {
        if (nutrients == null || key == null || key.isBlank()) {
            return;
        }

        String normalizedUnit = NutrientKeys.normalizeNutrientUnit(unit);
        NutrientValue incoming = NutrientValue.builder()
                .name(name == null || name.isBlank() ? NutrientKeys.humanizeNutrientKey(key) : name)
                .amount(amount == null ? BigDecimal.ZERO : amount)
                .unit(normalizedUnit)
                .nutrientNumber(nutrientNumber == null ? "" : nutrientNumber.trim())
                .build();

        NutrientValue existing = nutrients.get(key);
        if (existing == null) {
            nutrients.put(key, incoming);
            return;
        }

        if (normalizedUnit.equalsIgnoreCase(NutrientKeys.normalizeNutrientUnit(existing.getUnit()))) {
            if (shouldReplace(existing, incoming)) {
                nutrients.put(key, incoming);
            }
            return;
        }

        String alternateKey = NutrientKeys.appendUnitSuffix(key, normalizedUnit);
        NutrientValue alternate = nutrients.get(alternateKey);
        if (alternate == null || shouldReplace(alternate, incoming)) {
            nutrients.put(alternateKey, incoming);
        }
    }

    private static boolean shouldReplace(NutrientValue existing, NutrientValue incoming) {
        BigDecimal existingAmount = existing.getAmount() == null ? BigDecimal.ZERO : existing.getAmount();
        BigDecimal incomingAmount = incoming.getAmount() == null ? BigDecimal.ZERO : incoming.getAmount();

        if (existingAmount.compareTo(BigDecimal.ZERO) == 0 && incomingAmount.compareTo(BigDecimal.ZERO) != 0) {
            return true;
        }

        return (existing.getNutrientNumber() == null || existing.getNutrientNumber().isBlank())
                && incoming.getNutrientNumber() != null
                && !incoming.getNutrientNumber().isBlank();
    }

    /**
     * Returns the expanded nutrient map of a cached lookup, backfilling the seven
     * legacy macro columns for records saved before the map existed.
     */
    public static Map<String, NutrientValue> resolveStored(NutritionCache cacheEntry) {
        Map<String, NutrientValue> resolved = copy(cacheEntry.getNutrients());
        mergeLegacyMacro(resolved, "calories", "Calories", "kcal", cacheEntry.getCalories(), "208");
        mergeLegacyMacro(resolved, "protein", "Protein", "g", cacheEntry.getProteinG(), "203");
        mergeLegacyMacro(resolved, "carbs", "Carbohydrates", "g", cacheEntry.getCarbsG(), "205");
        mergeLegacyMacro(resolved, "fat", "Total Fat", "g", cacheEntry.getFatsG(), "204");
        mergeLegacyMacro(resolved, "fiber", "Fiber", "g", cacheEntry.getFiberG(), "291");
        mergeLegacyMacro(resolved, "sugar", "Sugar", "g", cacheEntry.getSugarG(), "269");
        mergeLegacyMacro(resolved, "sodium", "Sodium", "mg", cacheEntry.getSodiumMg(), "307");
        return resolved;
    }

    /** Same backfill for a per-entry enrichment record. */
    public static Map<String, NutrientValue> resolveStored(NutritionDetails details) {
        Map<String, NutrientValue> resolved = copy(details.getNutrients());
        mergeLegacyMacro(resolved, "calories", "Calories", "kcal", details.getCalories(), "208");
        mergeLegacyMacro(resolved, "protein", "Protein", "g", details.getProteinG(), "203");
        mergeLegacyMacro(resolved, "carbs", "Carbohydrates", "g", details.getCarbsG(), "205");
        mergeLegacyMacro(resolved, "fat", "Total Fat", "g", details.getFatsG(), "204");
        mergeLegacyMacro(resolved, "fiber", "Fiber", "g", details.getFiberG(), "291");
        mergeLegacyMacro(resolved, "sugar", "Sugar", "g", details.getSugarG(), "269");
        mergeLegacyMacro(resolved, "sodium", "Sodium", "mg", details.getSodiumMg(), "307");
        return resolved;
    }

    private static void mergeLegacyMacro(
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

        upsert(nutrients, key, name, unit, amount, nutrientNumber);
    }

    /** Mirrors the expanded nutrient map back onto the legacy macro columns of a cache entry. */
    public static void syncCacheMacros(NutritionCache cacheEntry, Map<String, NutrientValue> nutrients) {
        cacheEntry.setCalories(getAmount(nutrients, "calories"));
        cacheEntry.setProteinG(getAmount(nutrients, "protein"));
        cacheEntry.setCarbsG(getAmount(nutrients, "carbs"));
        cacheEntry.setFatsG(getAmount(nutrients, "fat"));
        cacheEntry.setFiberG(getAmount(nutrients, "fiber"));
        cacheEntry.setSugarG(getAmount(nutrients, "sugar"));
        cacheEntry.setSodiumMg(getAmount(nutrients, "sodium"));
    }
}
