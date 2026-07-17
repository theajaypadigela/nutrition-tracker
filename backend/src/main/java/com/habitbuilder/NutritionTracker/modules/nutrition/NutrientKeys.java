package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.util.Locale;

/**
 * Maps raw nutrient identifiers coming from external sources (USDA nutrient
 * numbers, free-form names, AI keys) onto the app's canonical camelCase
 * nutrient keys, and normalizes names/units. Pure functions only.
 */
public final class NutrientKeys {

    private NutrientKeys() {
    }

    public static String resolveNutrientKey(String nutrientNumber, String nutrientName, String unit) {
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

    public static String normalizeNutrientName(String nutrientName) {
        if (nutrientName == null) {
            return "";
        }

        return nutrientName.trim()
                .toLowerCase(Locale.ROOT)
                .replace("_", " ")
                .replaceAll("\\s+", " ");
    }

    public static String normalizeNutrientUnit(String unit) {
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

    public static String inferUnitFromKey(String key) {
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

    public static String normalizeStructuredNutrientKey(String rawKey, String fallbackName, String unit) {
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

    private static String toFallbackNutrientKey(String nutrientName, String nutrientNumber) {
        String keyFromName = toCamelCaseKey(nutrientName);
        if (!keyFromName.isBlank()) {
            return keyFromName;
        }
        if (nutrientNumber != null && !nutrientNumber.isBlank()) {
            return "nutrient" + nutrientNumber.replaceAll("[^a-zA-Z0-9]", "");
        }
        return "";
    }

    public static String toCamelCaseKey(String rawText) {
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

    public static String humanizeNutrientKey(String key) {
        if (key == null || key.isBlank()) {
            return "Nutrient";
        }

        String text = key.replaceAll("([a-z])([A-Z])", "$1 $2");
        return Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }

    public static String appendUnitSuffix(String key, String unit) {
        String unitKey = toCamelCaseKey(unit);
        if (unitKey.isBlank()) {
            return key + "Value";
        }
        return key + Character.toUpperCase(unitKey.charAt(0)) + unitKey.substring(1);
    }

    public static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    public static String normalizeFoodName(String foodName) {
        return foodName == null ? ""
                : foodName.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
