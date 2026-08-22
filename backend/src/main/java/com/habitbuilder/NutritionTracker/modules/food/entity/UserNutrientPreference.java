package com.habitbuilder.NutritionTracker.modules.food.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.*;

@Document(collection = "user_nutrient_preferences")
@CompoundIndex(def = "{'userId': 1, 'nutrientId': 1}", unique = true)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserNutrientPreference {

    @Id
    private String id;

    private String userId;

    private String nutrientId;

    @Builder.Default
    private boolean pinned = false;

    private Double customTarget;

    private String avoidedFoods;
}
