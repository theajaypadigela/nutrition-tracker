package com.habitbuilder.NutritionTracker.modules.voice.transcript;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.modules.food.FoodLogService;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiJsonSupport;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiTextService;
import com.habitbuilder.NutritionTracker.modules.voice.VoiceMealSession;
import com.habitbuilder.NutritionTracker.modules.voice.VoiceTranscriptProcessingException;
import com.habitbuilder.NutritionTracker.modules.voice.idempotency.TranscriptFingerprint;
import com.habitbuilder.NutritionTracker.modules.voice.idempotency.TranscriptIdempotencyGuard;
import com.habitbuilder.NutritionTracker.modules.voice.session.VoiceSessionRecorder;
import com.habitbuilder.NutritionTracker.modules.voice.transcript.prompt.MealTranscriptPrompts;

/**
 * Turns a finished voice-call transcript into logged food entries.
 *
 * <p>Deliberately not {@code @Transactional}: each {@code addFoodEntryForUser} has to commit
 * on its own so the {@code @Async} nutrition enrichment can see the rows it is meant to
 * enrich.
 */
@Service
public class TranscriptParsingService {

    private static final Logger logger = LoggerFactory.getLogger(TranscriptParsingService.class);

    private final FoodLogService foodLogService;
    private final UserRepository userRepository;
    private final AiTextService aiTextService;
    private final ObjectMapper objectMapper;
    private final VoiceSessionRecorder sessionRecorder;
    private final TranscriptIdempotencyGuard idempotencyGuard;

    public TranscriptParsingService(FoodLogService foodLogService,
            UserRepository userRepository,
            AiTextService aiTextService,
            ObjectMapper objectMapper,
            VoiceSessionRecorder sessionRecorder,
            TranscriptIdempotencyGuard idempotencyGuard) {
        this.foodLogService = foodLogService;
        this.userRepository = userRepository;
        this.aiTextService = aiTextService;
        this.objectMapper = objectMapper;
        this.sessionRecorder = sessionRecorder;
        this.idempotencyGuard = idempotencyGuard;
    }

    public MealTranscriptParseResult parseTranscriptAndLogMeals(String userId, LocalDate logDate, String transcript) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + userId));

        String normalizedTranscript = transcript == null ? "" : transcript.trim();
        LocalDate effectiveLogDate = logDate != null ? logDate : LocalDate.now();
        String idempotencyKey = TranscriptFingerprint.of(userId, effectiveLogDate, normalizedTranscript);

        if (!idempotencyGuard.tryClaim(idempotencyKey)) {
            logger.warn("Skipping duplicate transcript parse request for user {} within idempotency window", userId);
            return new MealTranscriptParseResult(0, true);
        }

        VoiceMealSession session = sessionRecorder.startTranscriptSession(
                user.getId(), effectiveLogDate, transcript);

        try {
            int totalEntries = logMealsFrom(
                    aiTextService.callRawPrompt(MealTranscriptPrompts.parsing(normalizedTranscript)),
                    userId,
                    effectiveLogDate);

            sessionRecorder.complete(session);
            logger.info("Parsed and logged {} meal entries from transcript for user {} on {}",
                    totalEntries, userId, effectiveLogDate);
            return new MealTranscriptParseResult(totalEntries, false);
        } catch (Exception e) {
            // Release the claim so the client's retry is not swallowed as a duplicate.
            idempotencyGuard.release(idempotencyKey);
            sessionRecorder.fail(session, e);
            logger.error("Failed to parse transcript for user {}: {}", userId, e.getMessage(), e);
            throw new VoiceTranscriptProcessingException(
                    "Failed to parse meals from conversation: " + e.getMessage(), e);
        }
    }

    /** Reads the model's meal array and logs each named item. Returns the number logged. */
    private int logMealsFrom(String modelResponse, String userId, LocalDate logDate)
            throws JsonProcessingException {
        JsonNode root = objectMapper.readTree(AiJsonSupport.extractJson(modelResponse));
        JsonNode mealsNode = root.path("meals");
        if (!mealsNode.isArray()) {
            return 0;
        }

        int totalEntries = 0;
        for (JsonNode mealNode : mealsNode) {
            String foodName = mealNode.path("name").asText("");
            if (foodName.isEmpty()) {
                continue;
            }

            foodLogService.addFoodEntryForUser(
                    userId,
                    logDate,
                    mealNode.path("mealType").asText("snack").toLowerCase(),
                    foodName,
                    mealNode.path("quantity").asDouble(1.0),
                    mealNode.path("unit").asText("serving"),
                    mealNode.path("standardQuantity").isNumber()
                            ? mealNode.path("standardQuantity").asDouble()
                            : null,
                    mealNode.path("standardUnit").isTextual()
                            ? mealNode.path("standardUnit").asText(null)
                            : null);
            totalEntries++;
        }
        return totalEntries;
    }
}
