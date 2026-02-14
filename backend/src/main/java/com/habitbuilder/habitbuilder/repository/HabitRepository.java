package com.habitbuilder.habitbuilder.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.habitbuilder.habitbuilder.model.Habit;

@Repository
public interface HabitRepository extends JpaRepository<Habit, Long> {

}
