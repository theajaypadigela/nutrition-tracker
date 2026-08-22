package com.habitbuilder.NutritionTracker;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class ApplicationContextIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16.4-bookworm");

    @Autowired
    private MockMvc mockMvc;

    @Test
    void applicationContextLoadsAgainstMigratedPostgreSql() {
        // Reaching this test proves that Flyway, Hibernate validation, and the
        // complete Spring bean graph all started against real PostgreSQL.
    }

    @Test
    void permitsTheExactPublicWebhook() throws Exception {
        mockMvc.perform(post("/food/voice-log")
                        .header("X-Vapi-Secret", "test-webhook-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"message":{"type":"end-of-call-report"}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("logged"));
    }

    @Test
    void doesNotWidenTheWebhookMatcherToSiblingRoutes() throws Exception {
        mockMvc.perform(post("/food/voice-log/parse-transcript")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/food/voice-log/not-a-route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/food/voice/token"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/habit/today"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void keepsAuthMatcherPublicWhileControllerChecksCurrentUser() throws Exception {
        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isUnauthorized());
    }
}
