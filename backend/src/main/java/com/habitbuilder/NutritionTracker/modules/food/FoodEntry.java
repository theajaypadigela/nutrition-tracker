package com.habitbuilder.NutritionTracker.modules.food;

import java.time.OffsetDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionDetails;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "food_entries")
@Getter
@Setter
@NoArgsConstructor
public class FoodEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnore
    @JoinColumn(name = "food_log_id", nullable = false)
    private FoodLog foodLog;

    @Column(name = "meal_type", nullable = false)
    private String mealType; // todo - consider making this an enum

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "quantity", nullable = false)
    private double quantity;

    @Column(name = "unit", nullable = false)
    private String unit;

    @Column(name = "entry_hash")
    private String entryHash;

    @OneToOne(mappedBy = "foodEntry", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private NutritionDetails nutritionDetails;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
