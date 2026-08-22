package com.habitbuilder.NutritionTracker.modules.food;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class NutritionCalculatorTest {

    private final NutritionCalculator calculator = new NutritionCalculator();

    @Test
    void sumsEverySupportedNutrient() {
        FoodItemResponse breakfast = FoodItemResponse.builder()
                .calories(120.5)
                .protein(10.0)
                .carbs(15.0)
                .fat(4.0)
                .fiber(2.5)
                .sugar(3.0)
                .sodium(80.0)
                .build();
        FoodItemResponse lunch = FoodItemResponse.builder()
                .calories(79.5)
                .protein(5.0)
                .carbs(20.0)
                .fat(6.0)
                .fiber(1.5)
                .sugar(7.0)
                .sodium(120.0)
                .build();

        NutritionTotals totals = calculator.calculateTotals(List.of(breakfast, lunch));

        assertThat(totals).isEqualTo(new NutritionTotals(200.0, 15.0, 35.0, 10.0, 4.0, 10.0, 200.0));
    }

    @Test
    void treatsMissingNutrientValuesAsZero() {
        FoodItemResponse partiallyEnriched = FoodItemResponse.builder()
                .calories(150.0)
                .carbs(12.0)
                .build();

        NutritionTotals totals = calculator.calculateTotals(List.of(partiallyEnriched));

        assertThat(totals).isEqualTo(new NutritionTotals(150.0, 0.0, 12.0, 0.0, 0.0, 0.0, 0.0));
    }

    @Test
    void returnsZeroTotalsForNoItems() {
        NutritionTotals totals = calculator.calculateTotals(List.of());

        assertThat(totals).isEqualTo(new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0));
    }
}
