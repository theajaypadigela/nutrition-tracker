package com.habitbuilder.habitbuilder.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.habitbuilder.habitbuilder.model.FoodLog;

@Repository
public interface FoodLogRepository extends JpaRepository<FoodLog, Long> {

}
