package com.habitbuilder.NutritionTracker.modules.food;

/**
 * Performs nutrition arithmetic without repository, security, or framework
 * dependencies.
 */
public class NutritionCalculator {

    public NutritionTotals calculateTotals(Iterable<FoodItemResponse> items) {
        NutritionTotals totals = new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

        for (FoodItemResponse item : items) {
            if (item.getCalories() != null)
                totals.setCalories(totals.getCalories() + item.getCalories());
            if (item.getProtein() != null)
                totals.setProtein(totals.getProtein() + item.getProtein());
            if (item.getCarbs() != null)
                totals.setCarbs(totals.getCarbs() + item.getCarbs());
            if (item.getFat() != null)
                totals.setFat(totals.getFat() + item.getFat());
            if (item.getFiber() != null)
                totals.setFiber(totals.getFiber() + item.getFiber());
            if (item.getSugar() != null)
                totals.setSugar(totals.getSugar() + item.getSugar());
            if (item.getSodium() != null)
                totals.setSodium(totals.getSodium() + item.getSodium());
        }

        return totals;
    }
}
