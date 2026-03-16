package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;
import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "nutrition_details")
@Getter
@Setter
@NoArgsConstructor
public class NutritionDetails {

    @Id
    private String id;

    @Indexed(unique = true)
    private String foodEntryId;

    private BigDecimal calories;

    private BigDecimal proteinG;

    private BigDecimal carbsG;

    private BigDecimal fatsG;

    private BigDecimal fiberG;

    private BigDecimal sugarG;

    private BigDecimal sodiumMg;

    private String enrichmentStatus = "pending";

    private String enrichmentError;

    private String apiResponse;

    private Instant enrichedAt;

    private int retryCount = 0;

    @LastModifiedDate
    private Instant updatedAt;
}
