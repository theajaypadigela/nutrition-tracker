package com.habitbuilder.NutritionTracker.modules.nutrition.units;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.Locale;
import java.util.Set;

/**
 * Pure unit parsing/normalization used to compare a requested food quantity
 * ("2 bowls", "200 g") against the base unit a nutrition source reports
 * ("100g", "1 piece"). No Spring or I/O dependencies.
 */
public final class UnitConversion {

    public static final MathContext SCALING_CONTEXT = MathContext.DECIMAL64;

    private static final BigDecimal GRAMS_PER_KILOGRAM = BigDecimal.valueOf(1000);
    private static final BigDecimal GRAMS_PER_MILLIGRAM = new BigDecimal("0.001");
    private static final BigDecimal GRAMS_PER_MICROGRAM = new BigDecimal("0.000001");
    private static final BigDecimal GRAMS_PER_OUNCE = new BigDecimal("28.349523125");
    private static final BigDecimal GRAMS_PER_POUND = new BigDecimal("453.59237");
    private static final BigDecimal MILLILITERS_PER_LITER = BigDecimal.valueOf(1000);
    private static final BigDecimal MILLILITERS_PER_CUP = BigDecimal.valueOf(240);
    private static final BigDecimal MILLILITERS_PER_TABLESPOON = BigDecimal.valueOf(15);
    private static final BigDecimal MILLILITERS_PER_TEASPOON = BigDecimal.valueOf(5);
    private static final BigDecimal MILLILITERS_PER_FLUID_OUNCE = new BigDecimal("29.5735295625");

    private static final Set<String> COMPACT_UNITS = Set.of("g", "kg", "mg", "mcg", "ml", "l", "oz", "lb");

    /**
     * Units that describe a household serving rather than a measurable mass/volume.
     * A quantity in one of these units is treated as a serving count when it cannot
     * be converted to the stored base unit.
     */
    private static final Set<String> NATURAL_SERVING_UNITS = Set.of(
            "bowl",
            "plate",
            "portion",
            "slice",
            "scoop",
            "handful",
            "glass",
            "cupful",
            "packet",
            "pack",
            "pouch",
            "can",
            "bottle",
            "box",
            "spoon",
            "ladle");

    private UnitConversion() {
    }

    public enum UnitDimension {
        MASS,
        VOLUME,
        COUNT,
        UNKNOWN
    }

    public record ParsedUnit(String normalizedUnit, UnitDimension dimension, BigDecimal comparableQuantity) {
    }

    private record UnitDescriptor(UnitDimension dimension, String canonicalUnit, BigDecimal factorToComparable) {
    }

    /** Parses a base-unit label such as "100g" or "1 piece" together with its stored quantity. */
    public static ParsedUnit parseStoredUnit(String baseUnit, BigDecimal baseQuantity) {
        return parseUnit(baseQuantity, extractUnitLabel(baseUnit));
    }

    public static ParsedUnit parseUnit(BigDecimal quantity, String rawUnit) {
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

    public static boolean isNaturalServingUnit(ParsedUnit requestedUnit) {
        if (requestedUnit == null || requestedUnit.normalizedUnit().isBlank()) {
            return false;
        }

        return requestedUnit.dimension() == UnitDimension.UNKNOWN
                || NATURAL_SERVING_UNITS.contains(requestedUnit.normalizedUnit());
    }

    /** Renders a base unit label such as "100g" or "1 serving" from quantity + unit. */
    public static String formatBaseUnit(BigDecimal quantity, String unit) {
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

    private static String extractUnitLabel(String baseUnit) {
        if (baseUnit == null) {
            return "";
        }
        return baseUnit.replaceFirst("^[\\d.\\s]+", "").trim();
    }

    public static String normalizeUnitLabel(String unit) {
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
            case "bowl", "bowls", "katori", "katoris" -> "bowl";
            case "plate", "plates", "thali", "thalis" -> "plate";
            case "portion", "portions" -> "portion";
            case "slice", "slices" -> "slice";
            case "scoop", "scoops" -> "scoop";
            case "handful", "handfuls" -> "handful";
            case "glass", "glasses" -> "glass";
            case "cupful", "cupfuls" -> "cupful";
            case "packet", "packets", "pack", "packs" -> "packet";
            case "pouch", "pouches" -> "pouch";
            case "can", "cans", "tin", "tins" -> "can";
            case "bottle", "bottles" -> "bottle";
            case "box", "boxes" -> "box";
            case "spoon", "spoons", "spoonful", "spoonfuls" -> "spoon";
            case "ladle", "ladles" -> "ladle";
            default -> normalized;
        };
    }

    private static UnitDescriptor getUnitDescriptor(String normalizedUnit) {
        return switch (normalizedUnit) {
            case "g" -> new UnitDescriptor(UnitDimension.MASS, "g", BigDecimal.ONE);
            case "kg" -> new UnitDescriptor(UnitDimension.MASS, "g", GRAMS_PER_KILOGRAM);
            case "mg" -> new UnitDescriptor(UnitDimension.MASS, "g", GRAMS_PER_MILLIGRAM);
            case "mcg" -> new UnitDescriptor(UnitDimension.MASS, "g", GRAMS_PER_MICROGRAM);
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
}
