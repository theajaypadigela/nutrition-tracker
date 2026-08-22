package com.habitbuilder.NutritionTracker;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import jakarta.persistence.EntityManagerFactory;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class PersistenceMappingIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16.4-bookworm");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    void entityMappingsValidateAgainstTheCompleteFlywayChain() {
        List<String> applicationTables = jdbcTemplate.queryForList("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                  AND table_name <> 'flyway_schema_history'
                ORDER BY table_name
                """, String.class);

        assertThat(applicationTables).containsExactly(
                "food_entries",
                "food_logs",
                "habit_entity",
                "habits",
                "nutrition_cache",
                "nutrition_details",
                "user_nutrient_preferences",
                "users",
                "voice_meal_sessions");
        assertThat(entityManagerFactory.getMetamodel().getEntities()).hasSize(9);

        List<String> successfulVersions = jdbcTemplate.queryForList("""
                SELECT version
                FROM flyway_schema_history
                WHERE success
                ORDER BY installed_rank
                """, String.class);
        assertThat(successfulVersions).containsExactly("1", "2");
    }

    @Test
    void correctnessConstraintsArePresent() {
        List<String> constraints = jdbcTemplate.queryForList("""
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                  AND constraint_name IN (
                    'uk_habit_entity_habit_user_date',
                    'uk_voice_meal_sessions_provider_call_id'
                  )
                ORDER BY constraint_name
                """, String.class);

        assertThat(constraints).containsExactly(
                "uk_habit_entity_habit_user_date",
                "uk_voice_meal_sessions_provider_call_id");
    }
}
