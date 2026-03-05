package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
}
