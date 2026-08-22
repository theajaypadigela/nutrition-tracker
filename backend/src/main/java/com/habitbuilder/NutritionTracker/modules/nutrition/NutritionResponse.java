package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;
import java.util.stream.Stream;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

    @JsonIgnore
    public boolean hasAnyNumericValue() {
        return values().anyMatch(value -> value != null);
    }

    @JsonIgnore
    public boolean hasAnyNonZeroValue() {
        return values().filter(value -> value != null)
                .anyMatch(value -> value.compareTo(BigDecimal.ZERO) != 0);
    }

    @JsonIgnore
    public boolean isCacheable() {
        return hasAnyNumericValue() && hasAnyNonZeroValue();
    }

    private Stream<BigDecimal> values() {
        return Stream.of(calories, proteinG, carbsG, fatsG, fiberG, sugarG, sodiumMg);
    }
}
