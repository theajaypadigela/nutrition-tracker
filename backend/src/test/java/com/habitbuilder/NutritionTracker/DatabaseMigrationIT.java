package com.habitbuilder.NutritionTracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class DatabaseMigrationIT {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16.4-bookworm");

    private static JdbcTemplate jdbc;

    @BeforeAll
    static void migrateLegacyFixture() {
        DataSource dataSource = new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(dataSource);

        Flyway.configure()
                .dataSource(dataSource)
                .target("1")
                .load()
                .migrate();

        jdbc.update("""
                INSERT INTO users
                    (age, created_at, email, enabled, gender, name, password, role)
                VALUES
                    ('30', CURRENT_TIMESTAMP, 'legacy@example.com', true,
                     'unspecified', 'Legacy user', 'not-a-real-hash', 'USER')
                """);
        jdbc.update("""
                INSERT INTO habit_entity
                    (completion_time, entry_date, habit_id, rescheduled_time, status, user_id)
                VALUES ('08:00', DATE '2026-08-19', '7', NULL, 'COMPLETED', '1')
                """);
        jdbc.update("""
                INSERT INTO habit_entity
                    (completion_time, entry_date, habit_id, rescheduled_time, status, user_id)
                VALUES ('09:00', DATE '2026-08-19', '7', NULL, 'MISSED', '1')
                """);
        jdbc.update("""
                INSERT INTO nutrition_cache (entry_hash, created_at, payload)
                VALUES ('all-zero', CURRENT_TIMESTAMP, CAST(? AS jsonb))
                """, """
                {"calories":0,"proteinG":0.0,"carbsG":0,"fatsG":0,
                 "fiberG":0,"sugarG":0,"sodiumMg":0}
                """);
        jdbc.update("""
                INSERT INTO nutrition_cache (entry_hash, created_at, payload)
                VALUES ('real-result', CURRENT_TIMESTAMP, CAST(? AS jsonb))
                """, """
                {"calories":100,"proteinG":0,"carbsG":0,"fatsG":0,
                 "fiberG":0,"sugarG":0,"sodiumMg":0}
                """);

        Flyway.configure()
                .dataSource(dataSource)
                .load()
                .migrate();
    }

    @Test
    void backfillsLegacyUsersAndAddsVoiceSessionIdentityColumn() {
        assertThat(jdbc.queryForObject(
                "SELECT timezone FROM users WHERE email = 'legacy@example.com'",
                String.class)).isEqualTo("UTC");

        Map<String, Object> column = jdbc.queryForMap("""
                SELECT is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'voice_meal_sessions'
                  AND column_name = 'provider_call_id'
                """);
        assertThat(column.get("is_nullable")).isEqualTo("YES");
    }

    @Test
    void keepsNewestDuplicateHabitStateThenEnforcesUniqueness() {
        Map<String, Object> retained = jdbc.queryForMap("""
                SELECT completion_time, status
                FROM habit_entity
                WHERE habit_id = '7'
                  AND user_id = '1'
                  AND entry_date = DATE '2026-08-19'
                """);
        assertThat(retained)
                .containsEntry("completion_time", "09:00")
                .containsEntry("status", "MISSED");

        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO habit_entity
                    (completion_time, entry_date, habit_id, rescheduled_time, status, user_id)
                VALUES ('10:00', DATE '2026-08-19', '7', NULL, 'COMPLETED', '1')
                """))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void removesOnlyCompleteAllZeroNutritionPayloads() {
        assertThat(jdbc.queryForList(
                "SELECT entry_hash FROM nutrition_cache ORDER BY entry_hash",
                String.class)).containsExactly("real-result");
    }
}
