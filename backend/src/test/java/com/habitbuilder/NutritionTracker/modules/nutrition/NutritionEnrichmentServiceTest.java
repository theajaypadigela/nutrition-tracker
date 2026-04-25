package com.habitbuilder.NutritionTracker.modules.nutrition;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.ObjectMapper;

class NutritionEnrichmentServiceTest {

    private final NutritionEnrichmentService service = new NutritionEnrichmentService(
            null,
            null,
            null,
            new ObjectMapper(),
            WebClient.builder(),
            "",
            20000,
            "",
            20000);

    @Test
    void scalesMassUnitsNormally() throws Exception {
        NutritionResponse response = scale(cacheWith100gNutrition(), 200.0, "g");

        assertEquals(0, BigDecimal.valueOf(260).compareTo(response.getCalories()));
        assertEquals(0, BigDecimal.valueOf(5.4).compareTo(response.getProteinG()));
    }

    @Test
    void treatsCustomServingUnitsAsServingCounts() throws Exception {
        NutritionResponse response = scale(cacheWith100gNutrition(), 1.0, "bowl");

        assertEquals(0, BigDecimal.valueOf(130).compareTo(response.getCalories()));
        assertEquals(0, BigDecimal.valueOf(2.7).compareTo(response.getProteinG()));
    }

    @Test
    void preservesQuantityForPluralCustomServingUnits() throws Exception {
        NutritionResponse response = scale(cacheWith100gNutrition(), 2.0, "bowls");

        assertEquals(0, BigDecimal.valueOf(260).compareTo(response.getCalories()));
        assertEquals(0, BigDecimal.valueOf(5.4).compareTo(response.getProteinG()));
    }

    private NutritionResponse scale(NutritionCache cacheEntry, double quantity, String unit) throws Exception {
        Method method = NutritionEnrichmentService.class.getDeclaredMethod(
                "scaleNutritionResponse",
                NutritionCache.class,
                double.class,
                String.class);
        method.setAccessible(true);
        return (NutritionResponse) method.invoke(service, cacheEntry, quantity, unit);
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
