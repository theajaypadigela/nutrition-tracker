package com.habitbuilder.NutritionTracker.modules.habit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface HabitRepository extends JpaRepository<Habit, Long> {

    @Query(value = """
                SELECT *
                FROM habits
                WHERE user_id = :userId
                  AND EXISTS (
                        SELECT 1
                        FROM unnest(repeat_days) d
                        WHERE LOWER(d) = LOWER(:dayOfWeek)
                  )
            """, nativeQuery = true)
    List<Habit> findByUserAndRepeatDaysContaining(@Param("userId") Long userId, @Param("dayOfWeek") String dayOfWeek);
}
