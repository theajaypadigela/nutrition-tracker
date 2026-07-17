package com.habitbuilder.NutritionTracker.modules.food;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NutritionTotals {
    private Double calories;
    private Double protein;
    private Double carbs;
    private Double fat;
    private Double fiber;
    private Double sugar;
    private Double sodium;

    public static NutritionTotals zero() {
        return new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
    }

    /** Accumulates the other totals into this one, treating nulls as zero. */
    public void add(NutritionTotals other) {
        if (other == null) {
            return;
        }
        calories = nz(calories) + nz(other.calories);
        protein = nz(protein) + nz(other.protein);
        carbs = nz(carbs) + nz(other.carbs);
        fat = nz(fat) + nz(other.fat);
        fiber = nz(fiber) + nz(other.fiber);
        sugar = nz(sugar) + nz(other.sugar);
        sodium = nz(sodium) + nz(other.sodium);
    }

    public NutritionTotals dividedBy(double divisor) {
        return new NutritionTotals(
                nz(calories) / divisor,
                nz(protein) / divisor,
                nz(carbs) / divisor,
                nz(fat) / divisor,
                nz(fiber) / divisor,
                nz(sugar) / divisor,
                nz(sodium) / divisor);
    }

    private static double nz(Double value) {
        return value == null ? 0.0 : value;
    }
}
