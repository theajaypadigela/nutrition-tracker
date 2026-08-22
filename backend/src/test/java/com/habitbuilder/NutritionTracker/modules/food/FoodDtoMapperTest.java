package com.habitbuilder.NutritionTracker.modules.food;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionDetails;

class FoodDtoMapperTest {

    private final FoodDtoMapper mapper = new FoodDtoMapper();

    @Test
    void mapsAnEnrichedEntryToTheExistingDailyItemShape() {
        FoodEntry entry = entry();
        NutritionDetails details = new NutritionDetails();
        details.setCalories(new BigDecimal("123.4"));
        details.setProteinG(new BigDecimal("11.2"));
        details.setCarbsG(new BigDecimal("22.3"));
        details.setFatsG(new BigDecimal("4.5"));
        details.setFiberG(new BigDecimal("6.7"));
        details.setSugarG(new BigDecimal("8.9"));
        details.setSodiumMg(new BigDecimal("101.1"));
        details.setEnrichmentStatus("completed");
        entry.setNutritionDetails(details);

        FoodItemResponse response = mapper.toFoodItemResponse(entry);

        assertThat(response).isEqualTo(FoodItemResponse.builder()
                .id("a09ec927-09a8-445b-a318-b7ffec0ef2b5")
                .name("Dal")
                .quantity("1.25")
                .servingSize("bowl")
                .enrichmentStatus("completed")
                .calories(123.4)
                .protein(11.2)
                .carbs(22.3)
                .fat(4.5)
                .fiber(6.7)
                .sugar(8.9)
                .sodium(101.1)
                .build());
    }

    @Test
    void leavesNutritionFieldsNullForAnUnenrichedEntry() {
        FoodItemResponse response = mapper.toFoodItemResponse(entry());

        assertThat(response).isEqualTo(FoodItemResponse.builder()
                .id("a09ec927-09a8-445b-a318-b7ffec0ef2b5")
                .name("Dal")
                .quantity("1.25")
                .servingSize("bowl")
                .enrichmentStatus("pending")
                .build());
    }

    private FoodEntry entry() {
        FoodEntry entry = new FoodEntry();
        entry.setId(UUID.fromString("a09ec927-09a8-445b-a318-b7ffec0ef2b5"));
        entry.setName("Dal");
        entry.setQuantity(1.25);
        entry.setUnit("bowl");
        return entry;
    }
}
