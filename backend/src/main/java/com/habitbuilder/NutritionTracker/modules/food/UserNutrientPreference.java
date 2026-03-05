package com.habitbuilder.NutritionTracker.modules.food;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_nutrient_preferences",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "nutrient_id"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserNutrientPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "nutrient_id", nullable = false)
    private String nutrientId;   // e.g. "protein", "vitamin_c"

    @Column(nullable = false)
    @Builder.Default
    private boolean pinned = false;

    @Column(name = "custom_target")
    private Double customTarget;       // user-defined daily target (null = use default RDI)

    @Column(name = "avoided_foods", length = 1024)
    private String avoidedFoods;       // comma-separated e.g. "soda,cake,candy"
}
