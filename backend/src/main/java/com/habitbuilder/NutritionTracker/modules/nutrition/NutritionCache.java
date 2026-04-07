package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
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
    private String id;

    @Indexed(unique = true)
    private String normalizedFoodName;

    private String foodName;

    private String baseUnit;

    private BigDecimal baseQuantity;

    private BigDecimal calories;

    private BigDecimal proteinG;

    private BigDecimal carbsG;

    private BigDecimal fatsG;

    private BigDecimal fiberG;

    private BigDecimal sugarG;

    private BigDecimal sodiumMg;

    private Map<String, NutrientValue> nutrients = new LinkedHashMap<>();

    private String source;

    private Instant cachedAt;
}
