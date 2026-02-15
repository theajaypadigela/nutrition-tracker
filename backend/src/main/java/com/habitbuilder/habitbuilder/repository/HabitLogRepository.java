package com.habitbuilder.habitbuilder.repository;

import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.habitbuilder.habitbuilder.model.HabitLog;

@Repository
public interface HabitLogRepository extends JpaRepository<HabitLog, Long> {
    HabitLog findByHabitIdAndDate(Long habitId, LocalDate date);
}