package com.habitbuilder.NutritionTracker.modules.nutrition.dto;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutrientValue;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NutritionResponse {
    private BigDecimal calories;
    private BigDecimal proteinG;
    private BigDecimal carbsG;
    private BigDecimal fatsG;
    private BigDecimal fiberG;
    private BigDecimal sugarG;
    private BigDecimal sodiumMg;

    @Builder.Default
    private Map<String, NutrientValue> nutrients = new LinkedHashMap<>();
}
