package com.habitbuilder.NutritionTracker.modules.habit.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import com.habitbuilder.NutritionTracker.modules.habit.entity.HabitEntity;
import com.habitbuilder.NutritionTracker.modules.habit.entity.HabitStatus;

public interface HabitEntityRepository extends MongoRepository<HabitEntity, String> {

    Optional<HabitEntity> findFirstByHabitIdAndUserIdAndEntryDateOrderByIdDesc(
            String habitId,
            String userId,
            LocalDate entryDate);

    boolean existsByHabitIdAndUserIdAndEntryDate(String habitId, String userId, LocalDate entryDate);

    List<HabitEntity> findByStatusAndRescheduledTimeBetween(
            HabitStatus status, LocalDateTime start, LocalDateTime end);
}
