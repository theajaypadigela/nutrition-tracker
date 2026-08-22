package com.habitbuilder.NutritionTracker.modules.voice.transcript;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiJsonSupport;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiTextService;
import com.habitbuilder.NutritionTracker.modules.voice.dto.MealTranscriptInterpretResponseDTO;
import com.habitbuilder.NutritionTracker.modules.voice.transcript.prompt.MealTranscriptPrompts;

/**
 * Classifies a meal call transcript: did the user actually describe food to log now, or ask
 * to be called back later — and if so, in how many minutes?
 *
 * <p>Never throws. A model outage must not stop a call from ending cleanly, so every failure
 * degrades to "don't log, don't reschedule" with a rationale saying why.
 */
@Service
public class TranscriptInterpreter {

    private static final Logger logger = LoggerFactory.getLogger(TranscriptInterpreter.class);

    private final AiTextService aiTextService;
    private final ObjectMapper objectMapper;

    public TranscriptInterpreter(AiTextService aiTextService, ObjectMapper objectMapper) {
        this.aiTextService = aiTextService;
        this.objectMapper = objectMapper;
    }

    public MealTranscriptInterpretResponseDTO interpretMealTranscript(String transcript, String mealSlotId) {
        MealTranscriptInterpretResponseDTO response = new MealTranscriptInterpretResponseDTO();
        response.setShouldLogMeals(false);
        response.setRescheduleMinutes(null);
        response.setRationale(AiJsonSupport.RATIONALE_NO_TRANSCRIPT);

        if (transcript == null || transcript.isBlank()) {
            return response;
        }

        try {
            String modelText = aiTextService.callRawPrompt(
                    MealTranscriptPrompts.interpretation(transcript, mealSlotId));
            JsonNode root = objectMapper.readTree(AiJsonSupport.extractJson(modelText));

            Integer rescheduleMinutes = root.path("rescheduleMinutes").isNumber()
                    ? root.path("rescheduleMinutes").asInt()
                    : null;
            if (rescheduleMinutes != null && rescheduleMinutes <= 0) {
                rescheduleMinutes = null;
            }

            response.setShouldLogMeals(root.path("shouldLogMeals").asBoolean(false));
            response.setRescheduleMinutes(rescheduleMinutes);
            response.setRationale(root.path("rationale").asText(AiJsonSupport.RATIONALE_CLASSIFIED));
            return response;
        } catch (Exception e) {
            logger.warn("Meal transcript interpretation failed: {}", e.getMessage());
            response.setShouldLogMeals(false);
            response.setRescheduleMinutes(null);
            response.setRationale(AiJsonSupport.RATIONALE_FAILED);
            return response;
        }
    }
}
