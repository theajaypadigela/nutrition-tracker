package com.habitbuilder.NutritionTracker.modules.food;

import java.util.List;

/** Static catalog of the nutrients the app tracks, with default RDI goals. */
public final class NutrientCatalog {

    public record NutrientMeta(String key, String displayName, String unit, String category, double defaultGoal) {
    }

    private static final List<NutrientMeta> ALL = List.of(
            new NutrientMeta("calories", "Calories", "kcal", "macro", 2000),
            new NutrientMeta("protein", "Protein", "g", "macro", 50),
            new NutrientMeta("carbs", "Carbohydrates", "g", "macro", 300),
            new NutrientMeta("fat", "Total Fat", "g", "macro", 65),
            new NutrientMeta("fiber", "Fiber", "g", "macro", 28),
            new NutrientMeta("sugar", "Sugar", "g", "macro", 50),
            new NutrientMeta("sodium", "Sodium", "mg", "mineral", 2300),
            new NutrientMeta("vitaminA", "Vitamin A", "mcg", "vitamin", 900),
            new NutrientMeta("vitaminC", "Vitamin C", "mg", "vitamin", 90),
            new NutrientMeta("vitaminD", "Vitamin D", "mcg", "vitamin", 20),
            new NutrientMeta("vitaminE", "Vitamin E", "mg", "vitamin", 15),
            new NutrientMeta("vitaminK", "Vitamin K", "mcg", "vitamin", 120),
            new NutrientMeta("calcium", "Calcium", "mg", "mineral", 1000),
            new NutrientMeta("iron", "Iron", "mg", "mineral", 18),
            new NutrientMeta("potassium", "Potassium", "mg", "mineral", 4700),
            new NutrientMeta("magnesium", "Magnesium", "mg", "mineral", 400),
            new NutrientMeta("zinc", "Zinc", "mg", "mineral", 11));

    private NutrientCatalog() {
    }

    public static List<NutrientMeta> all() {
        return ALL;
    }
}
