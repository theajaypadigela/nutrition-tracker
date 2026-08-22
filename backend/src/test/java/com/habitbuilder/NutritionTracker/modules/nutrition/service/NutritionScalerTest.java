package com.habitbuilder.NutritionTracker.modules.nutrition.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.util.Map;

import org.junit.jupiter.api.Test;
import com.habitbuilder.NutritionTracker.modules.nutrition.dto.NutritionResponse;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutrientValue;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionCache;

class NutritionScalerTest {

    private final NutritionScaler scaler = new NutritionScaler();

    @Test
    void scalesMassUnitsNormally() {
        NutritionResponse response = scaler.scale(cacheWith100gNutrition(), 200.0, "g");

        assertEquals(0, BigDecimal.valueOf(260).compareTo(response.getCalories()));
        assertEquals(0, BigDecimal.valueOf(5.4).compareTo(response.getProteinG()));
    }

    @Test
    void treatsCustomServingUnitsAsServingCounts() {
        NutritionResponse response = scaler.scale(cacheWith100gNutrition(), 1.0, "bowl");

        assertEquals(0, BigDecimal.valueOf(130).compareTo(response.getCalories()));
        assertEquals(0, BigDecimal.valueOf(2.7).compareTo(response.getProteinG()));
    }

    @Test
    void preservesQuantityForPluralCustomServingUnits() {
        NutritionResponse response = scaler.scale(cacheWith100gNutrition(), 2.0, "bowls");

        assertEquals(0, BigDecimal.valueOf(260).compareTo(response.getCalories()));
        assertEquals(0, BigDecimal.valueOf(5.4).compareTo(response.getProteinG()));
    }

    private NutritionCache cacheWith100gNutrition() {
        NutritionCache cacheEntry = new NutritionCache();
        cacheEntry.setFoodName("rice");
        cacheEntry.setNormalizedFoodName("rice");
        cacheEntry.setBaseQuantity(BigDecimal.valueOf(100));
        cacheEntry.setBaseUnit("100g");
        cacheEntry.setNutrients(Map.of(
                "calories", nutrient("Calories", "kcal", "130"),
                "protein", nutrient("Protein", "g", "2.7"),
                "carbs", nutrient("Carbohydrates", "g", "28"),
                "fat", nutrient("Total Fat", "g", "0.3")));
        return cacheEntry;
    }

    private NutrientValue nutrient(String name, String unit, String amount) {
        return NutrientValue.builder()
                .name(name)
                .unit(unit)
                .amount(new BigDecimal(amount))
                .build();
    }
}
