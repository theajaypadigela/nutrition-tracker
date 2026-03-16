package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.time.Instant;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "nutrition_cache")
@Getter
@Setter
@NoArgsConstructor
public class NutritionCache {

    @Id
    private String entryHash;

    private String payload;

    @CreatedDate
    private Instant createdAt;
}
