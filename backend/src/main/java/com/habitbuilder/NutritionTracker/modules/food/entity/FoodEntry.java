package com.habitbuilder.NutritionTracker.modules.food.entity;

import java.time.Instant;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "food_entries")
@Getter
@Setter
@NoArgsConstructor
public class FoodEntry {

    @Id
    private String id;

    private String foodLogId;

    private String mealType;

    private String name;

    private double quantity;

    private String unit;

    // Standard weight/volume equivalent for non-standard units (e.g. "bowl", "plate").
    // When set, nutrition enrichment uses these values instead of quantity/unit.
    private Double standardQuantity;

    private String standardUnit;

    private String entryHash;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
