package com.habitbuilder.NutritionTracker.modules.food.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NutrientSummary {
    private String id;
    private String name;
    private String unit;
    private String category;   // macro | vitamin | mineral | other
    private double value;      // average daily intake over the range
    private double goal;       // AI-derived RDI for the user
    private int pctDV;         // value/goal * 100
    private String flag;       // low | ok | high
    private double weeklyAvg;  // same as value for the range avg
    private List<Double> trend; // one entry per day in range (0 if no data)
    private List<TopFoodSource> topSources;
    private boolean pinned;
    private String avoidedFoods;
    private Double customTarget;
}
