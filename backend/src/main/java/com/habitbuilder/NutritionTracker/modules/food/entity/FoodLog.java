package com.habitbuilder.NutritionTracker.modules.food.entity;

import java.time.LocalDate;
import java.time.Instant;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "food_logs")
@CompoundIndex(def = "{'userId': 1, 'logDate': 1}", unique = true)
@Getter
@Setter
@NoArgsConstructor
public class FoodLog {

    @Id
    private String id;

    private String userId;

    private LocalDate logDate;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
