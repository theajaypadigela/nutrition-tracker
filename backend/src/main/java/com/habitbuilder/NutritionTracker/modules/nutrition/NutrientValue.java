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
public class NutrientValue {
    private String name;
    private BigDecimal amount;
    private String unit;
    private String nutrientNumber;
}
