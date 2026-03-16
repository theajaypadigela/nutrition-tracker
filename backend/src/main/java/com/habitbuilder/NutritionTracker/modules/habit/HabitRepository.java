package com.habitbuilder.NutritionTracker.modules.habit;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalTime;
import java.util.List;

public interface HabitRepository extends MongoRepository<Habit, String> {

    List<Habit> findByUserIdAndRepeatDaysContaining(String userId, String dayOfWeek);

    @Query("{ 'reminderTime': { $gte: ?0, $lt: ?1 }, 'repeatDays': ?2 }")
    List<Habit> findByReminderTimeBetweenAndDay(LocalTime startTime, LocalTime endTime, String dayOfWeek);
}
