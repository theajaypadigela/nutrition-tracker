package com.habitbuilder.NutritionTracker.modules.voice.webhook;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.modules.food.FoodLogService;
import com.habitbuilder.NutritionTracker.modules.voice.VoiceMealSession;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VapiWebhookRequest;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VoiceMealLogRequest;
import com.habitbuilder.NutritionTracker.modules.voice.session.VoiceSessionRecorder;

/**
 * Turns a Vapi {@code submit_meal_log} webhook payload into logged food entries.
 *
 * <p>Deliberately not {@code @Transactional}: each {@code addFoodEntryForUser} has to commit
 * on its own so the {@code @Async} nutrition enrichment can see the rows it is meant to
 * enrich.
 */
@Service
public class VapiWebhookProcessor {

    private static final Logger logger = LoggerFactory.getLogger(VapiWebhookProcessor.class);

    private final FoodLogService foodLogService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final VoiceSessionRecorder sessionRecorder;

    public VapiWebhookProcessor(FoodLogService foodLogService,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            VoiceSessionRecorder sessionRecorder) {
        this.foodLogService = foodLogService;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.sessionRecorder = sessionRecorder;
    }

    public void processVoiceMealLog(Map<String, Object> params,
            List<VapiWebhookRequest.TranscriptEntry> transcript,
            Map<String, Object> callMetadata) {
        VoiceMealSession session = sessionRecorder.startWebhookSession(
                transcriptToString(transcript),
                buildWebhookPayloadSnapshot(params, callMetadata));

        try {
            VoiceMealLogRequest request = objectMapper.convertValue(params, VoiceMealLogRequest.class);
            String userId = resolveUserFromCallMetadata(callMetadata);
            session.setUserId(userId);

            LocalDate logDate = parseRequestedLogDate(request.getDate());
            session.setLogDate(logDate);

            userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "User not found for voice log: " + userId));

            Map<String, List<VoiceMealLogRequest.MealEntryDto>> meals = request.getMeals();
            if (meals == null || meals.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY, "Webhook payload did not contain any meals");
            }

            // Persist the now-known user and date before logging entries, so a failure
            // mid-loop still leaves an attributable audit record.
            sessionRecorder.save(session);

            int totalEntries = logEntries(meals, userId, logDate);
            if (totalEntries == 0) {
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY, "Webhook payload did not contain any valid meal entries");
            }

            sessionRecorder.complete(session);
            logger.info("Voice meal log completed for user {} on {}", userId, logDate);
        } catch (Exception e) {
            sessionRecorder.fail(session, e);
            logger.error("Voice meal log failed for session {}: {}", session.getId(), e.getMessage(), e);
            throw e;
        }
    }

    private int logEntries(Map<String, List<VoiceMealLogRequest.MealEntryDto>> meals,
            String userId,
            LocalDate logDate) {
        int totalEntries = 0;
        for (Map.Entry<String, List<VoiceMealLogRequest.MealEntryDto>> meal : meals.entrySet()) {
            List<VoiceMealLogRequest.MealEntryDto> entries = meal.getValue();
            if (entries == null || entries.isEmpty()) {
                continue;
            }

            for (VoiceMealLogRequest.MealEntryDto entry : entries) {
                if (entry == null) {
                    continue;
                }

                foodLogService.addFoodEntryForUser(
                        userId, logDate, meal.getKey(),
                        entry.getFoodName(),
                        entry.getQuantity() != null ? entry.getQuantity() : 1.0,
                        entry.getUnit() != null ? entry.getUnit() : "serving");
                totalEntries++;
            }
        }
        return totalEntries;
    }

    private String resolveUserFromCallMetadata(Map<String, Object> callMetadata) {
        if (callMetadata != null && callMetadata.containsKey("userId")) {
            return callMetadata.get("userId").toString();
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cannot resolve user from Vapi webhook — userId missing from call metadata");
    }

    private LocalDate parseRequestedLogDate(String requestedDate) {
        if (requestedDate == null || requestedDate.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voice log date is required");
        }

        try {
            return LocalDate.parse(requestedDate.trim());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Voice log date must be in YYYY-MM-DD format", e);
        }
    }

    private String buildWebhookPayloadSnapshot(Map<String, Object> params, Map<String, Object> callMetadata) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "params", params != null ? params : Map.of(),
                    "callMetadata", callMetadata != null ? callMetadata : Map.of()));
        } catch (Exception e) {
            logger.warn("Failed to serialize webhook payload snapshot: {}", e.getMessage());
            return "{\"serialization\":\"failed\"}";
        }
    }

    private String transcriptToString(List<VapiWebhookRequest.TranscriptEntry> transcript) {
        if (transcript == null || transcript.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (VapiWebhookRequest.TranscriptEntry entry : transcript) {
            sb.append("[").append(entry.getRole()).append("] ").append(entry.getMessage()).append("\n");
        }
        return sb.toString();
    }
}
