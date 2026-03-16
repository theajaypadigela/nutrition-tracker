package com.habitbuilder.NutritionTracker.modules.food;

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

    private String entryHash;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
