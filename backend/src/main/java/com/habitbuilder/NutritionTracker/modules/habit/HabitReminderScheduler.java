package com.habitbuilder.NutritionTracker.modules.habit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Component
public class HabitReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(HabitReminderScheduler.class);

    private final HabitRepository habitRepository;
    private final HabitEntityRepository habitEntityRepository;

    public HabitReminderScheduler(HabitRepository habitRepository,
            HabitEntityRepository habitEntityRepository) {
        this.habitRepository = habitRepository;
        this.habitEntityRepository = habitEntityRepository;
    }

    @Scheduled(fixedRate = 60000) // Every minute
    public void checkHabitReminders() {
        LocalTime now = LocalTime.now();
        LocalTime windowStart = now.withSecond(0).withNano(0);
        LocalTime windowEnd = windowStart.plusMinutes(1);
        String dayOfWeek = LocalDate.now().getDayOfWeek().toString().substring(0, 3).toUpperCase();

        var habits = habitRepository.findByReminderTimeBetweenAndDay(windowStart, windowEnd, dayOfWeek);

        for (Habit habit : habits) {
            Long userId = habit.getUser().getId();
            var existingLog = habitEntityRepository.findByHabitIdAndUserIdAndEntryDate(
                    habit.getId().toString(), userId.toString(), LocalDate.now());

            if (existingLog.isEmpty()) {
                log.info("Habit reminder due: {} (type={}) for user={}",
                        habit.getName(), habit.getReminderType(), userId);
            }
        }

        // Check rescheduled habits that are now due
        LocalDateTime nowDateTime = LocalDateTime.now();
        LocalDateTime rescheduleWindowStart = nowDateTime.withSecond(0).withNano(0);
        LocalDateTime rescheduleWindowEnd = rescheduleWindowStart.plusMinutes(1);

        var rescheduledEntities = habitEntityRepository.findByStatusAndRescheduledTimeBetween(
                HabitStatus.RESCHEDULED, rescheduleWindowStart, rescheduleWindowEnd);

        for (HabitEntity entity : rescheduledEntities) {
            log.info("Rescheduled habit reminder due: habitId={} for user={}",
                    entity.getHabitId(), entity.getUserId());
        }
    }
}
