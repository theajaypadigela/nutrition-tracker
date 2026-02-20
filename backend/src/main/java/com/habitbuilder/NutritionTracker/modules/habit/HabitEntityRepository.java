package com.habitbuilder.NutritionTracker.modules.habit;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Optional;

public interface HabitEntityRepository extends JpaRepository<HabitEntity, Long> {
    
    Optional<HabitEntity> findByHabitIdAndUserIdAndEntryDate(String habitId, String userId, LocalDate entryDate);
}
