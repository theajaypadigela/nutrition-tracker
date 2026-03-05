package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import org.hibernate.annotations.UpdateTimestamp;

import com.habitbuilder.NutritionTracker.modules.food.FoodEntry;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "nutrition_details")
@Getter
@Setter
@NoArgsConstructor
public class NutritionDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "food_entry_id", nullable = false, unique = true)
    private FoodEntry foodEntry;

    @Column(name = "calories")
    private BigDecimal calories;

    @Column(name = "protein_g")
    private BigDecimal proteinG;

    @Column(name = "carbs_g")
    private BigDecimal carbsG;

    @Column(name = "fats_g")
    private BigDecimal fatsG;

    @Column(name = "fiber_g")
    private BigDecimal fiberG;

    @Column(name = "sugar_g")
    private BigDecimal sugarG;

    @Column(name = "sodium_mg")
    private BigDecimal sodiumMg;

    @Column(name = "enrichment_status", nullable = false)
    private String enrichmentStatus = "pending";

    @Column(name = "enrichment_error", columnDefinition = "TEXT")
    private String enrichmentError;

    @Column(name = "api_response", columnDefinition = "TEXT")
    private String apiResponse;

    @Column(name = "enriched_at")
    private OffsetDateTime enrichedAt;

    @Column(name = "retry_count", nullable = false)
    private int retryCount = 0;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
