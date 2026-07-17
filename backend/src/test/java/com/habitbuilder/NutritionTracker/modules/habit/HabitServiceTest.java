package com.habitbuilder.NutritionTracker.modules.habit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiTextClient;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiTextService;

class HabitServiceTest {

    @Test
    void usesAiRescheduleDecisionAndMinutes() {
        HabitService service = serviceWithAiResponse("""
                {"habitStatus":"rescheduled","rescheduleMinutes":10,"rationale":"user_asked_for_delay"}
                """);
        HabitVoiceInterpretRequestDTO request = request(List.of(
                "Assistant: Did you finish your walk?",
                "You: Call me in 10 minutes or something."));

        HabitVoiceInterpretResponseDTO response = service.interpretVoiceTranscript(request);

        assertEquals("rescheduled", response.getHabitStatus());
        assertEquals(10, response.getRescheduleMinutes());
    }

    @Test
    void doesNotOverrideAiWhenTranscriptContainsDelayWords() {
        HabitService service = serviceWithAiResponse("""
                {"habitStatus":"not_completed","rescheduleMinutes":null,"rationale":"user_declined"}
                """);
        HabitVoiceInterpretRequestDTO request = request(List.of(
                "Assistant: Did you finish your walk?",
                "You: Call me in 10 minutes or something."));

        HabitVoiceInterpretResponseDTO response = service.interpretVoiceTranscript(request);

        assertEquals("not_completed", response.getHabitStatus());
        assertNull(response.getRescheduleMinutes());
    }

    @Test
    void normalizesNonPositiveAiRescheduleMinutesToNull() {
        HabitService service = serviceWithAiResponse("""
                {"habitStatus":"rescheduled","rescheduleMinutes":0,"rationale":"later_without_delay"}
                """);
        HabitVoiceInterpretRequestDTO request = request(List.of(
                "You: Please check again later."));

        HabitVoiceInterpretResponseDTO response = service.interpretVoiceTranscript(request);

        assertEquals("rescheduled", response.getHabitStatus());
        assertNull(response.getRescheduleMinutes());
    }

    private HabitVoiceInterpretRequestDTO request(List<String> transcriptLines) {
        HabitVoiceInterpretRequestDTO request = new HabitVoiceInterpretRequestDTO();
        request.setTranscriptLines(transcriptLines);
        request.setHabitName("Walk");
        request.setHabitTime("09:00 AM");
        return request;
    }

    private HabitService serviceWithAiResponse(String response) {
        AiTextService aiTextService = new AiTextService(List.of(new StubAiTextClient(response)), "stub");
        // These tests only exercise interpretVoiceTranscript, which uses the AI service +
        // object mapper; the repositories are not touched, so null is sufficient.
        return new HabitService(null, null, aiTextService, new ObjectMapper(), null,
                new com.habitbuilder.NutritionTracker.common.CurrentUserProvider());
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
