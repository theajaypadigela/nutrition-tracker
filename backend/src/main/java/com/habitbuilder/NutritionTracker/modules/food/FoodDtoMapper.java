package com.habitbuilder.NutritionTracker.modules.food;

/** Maps food persistence entities to the existing daily-log API shape. */
public class FoodDtoMapper {

    public FoodItemResponse toFoodItemResponse(FoodEntry entry) {
        FoodItemResponse.FoodItemResponseBuilder builder = FoodItemResponse.builder()
                .id(entry.getId().toString())
                .name(entry.getName())
                .quantity(String.valueOf(entry.getQuantity()))
                .servingSize(entry.getUnit())
                .enrichmentStatus("pending");

        if (entry.getNutritionDetails() != null) {
            var nutrition = entry.getNutritionDetails();
            builder.enrichmentStatus(nutrition.getEnrichmentStatus() != null
                    ? nutrition.getEnrichmentStatus()
                    : "pending");

            if (nutrition.getCalories() != null)
                builder.calories(nutrition.getCalories().doubleValue());
            if (nutrition.getProteinG() != null)
                builder.protein(nutrition.getProteinG().doubleValue());
            if (nutrition.getCarbsG() != null)
                builder.carbs(nutrition.getCarbsG().doubleValue());
            if (nutrition.getFatsG() != null)
                builder.fat(nutrition.getFatsG().doubleValue());
            if (nutrition.getFiberG() != null)
                builder.fiber(nutrition.getFiberG().doubleValue());
            if (nutrition.getSugarG() != null)
                builder.sugar(nutrition.getSugarG().doubleValue());
            if (nutrition.getSodiumMg() != null)
                builder.sodium(nutrition.getSodiumMg().doubleValue());
        }

        return builder.build();
    }
}
