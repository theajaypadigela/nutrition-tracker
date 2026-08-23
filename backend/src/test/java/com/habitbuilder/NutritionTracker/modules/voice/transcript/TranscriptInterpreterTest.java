package com.habitbuilder.NutritionTracker.modules.voice.transcript;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.config.properties.AiProperties;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiTextClient;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiTextService;
import com.habitbuilder.NutritionTracker.modules.voice.dto.MealTranscriptInterpretResponseDTO;

class TranscriptInterpreterTest {

    @Test
    void usesAiRescheduleDecisionAndMinutes() {
        TranscriptInterpreter service = interpreterWithAiResponse("""
                {"shouldLogMeals":false,"rescheduleMinutes":10,"rationale":"user_asked_for_delay"}
                """);

        MealTranscriptInterpretResponseDTO response = service.interpretMealTranscript(
                "User: Call me in 10 minutes or something.",
                "lunch");

        assertFalse(response.isShouldLogMeals());
        assertEquals(10, response.getRescheduleMinutes());
    }

    @Test
    void doesNotOverrideAiWhenTranscriptContainsDelayWords() {
        TranscriptInterpreter service = interpreterWithAiResponse("""
                {"shouldLogMeals":false,"rescheduleMinutes":null,"rationale":"not_enough_info"}
                """);

        MealTranscriptInterpretResponseDTO response = service.interpretMealTranscript(
                "User: Call me in 10 minutes or something.",
                "lunch");

        assertFalse(response.isShouldLogMeals());
        assertNull(response.getRescheduleMinutes());
    }

    @Test
    void keepsAiMealLoggingDecisionWithOptionalReschedule() {
        TranscriptInterpreter service = interpreterWithAiResponse("""
                {"shouldLogMeals":true,"rescheduleMinutes":15,"rationale":"logged_and_follow_up"}
                """);

        MealTranscriptInterpretResponseDTO response = service.interpretMealTranscript(
                "User: I had rice and dal. Also call me after 15 minutes.",
                "lunch");

        assertTrue(response.isShouldLogMeals());
        assertEquals(15, response.getRescheduleMinutes());
    }

    private TranscriptInterpreter interpreterWithAiResponse(String response) {
        AiTextService aiTextService = new AiTextService(List.of(new StubAiTextClient(response)), new AiProperties("stub"));
        return new TranscriptInterpreter(aiTextService, new ObjectMapper());
    }

    private record StubAiTextClient(String response) implements AiTextClient {
        @Override
        public String getProviderName() {
            return "stub";
        }

        @Override
        public String callRawPrompt(String prompt) {
            return response;
        }
    }
}
