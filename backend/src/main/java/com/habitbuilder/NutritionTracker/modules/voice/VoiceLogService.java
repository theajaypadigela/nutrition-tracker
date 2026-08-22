package com.habitbuilder.NutritionTracker.modules.voice;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.modules.auth.service.UserTimeZone;
import com.habitbuilder.NutritionTracker.modules.food.FoodService;
import com.habitbuilder.NutritionTracker.modules.nutrition.GeminiService;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VapiWebhookRequest;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VoiceMealLogRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class VoiceLogService {

    private static final Logger logger = LoggerFactory.getLogger(VoiceLogService.class);

    private final FoodService foodService;
    private final UserRepository userRepository;
    private final VoiceMealSessionRepository sessionRepo;
    private final ObjectMapper objectMapper;
    private final GeminiService geminiService;
    private final VapiClient vapiClient;
    private final UserTimeZone userTimeZone;

    public VoiceLogService(FoodService foodService,
            UserRepository userRepository,
            VoiceMealSessionRepository sessionRepo,
            ObjectMapper objectMapper,
            GeminiService geminiService,
            VapiClient vapiClient,
            UserTimeZone userTimeZone) {
        this.foodService = foodService;
        this.userRepository = userRepository;
        this.sessionRepo = sessionRepo;
        this.objectMapper = objectMapper;
        this.geminiService = geminiService;
        this.vapiClient = vapiClient;
        this.userTimeZone = userTimeZone;
    }

    /**
     * Processes a voice meal log from the Vapi webhook.
     * Not @Transactional so each addFoodEntryForUser call auto-commits,
     * allowing the @Async nutrition enrichment to see the committed rows.
     */
    public void processVoiceMealLog(Map<String, Object> params,
            List<VapiWebhookRequest.TranscriptEntry> transcript,
            String providerCallId,
            Map<String, Object> callMetadata) {
        VoiceMealLogRequest req = objectMapper.convertValue(params, VoiceMealLogRequest.class);
        var logDate = java.time.LocalDate.parse(req.getDate());

        VoiceMealSession session = resolveAuthorizedSession(providerCallId, callMetadata);
        if (session.getStatus() != VoiceMealSession.SessionStatus.PENDING) {
            logger.info("Ignoring duplicate Vapi meal log for provider call {}", providerCallId);
            return;
        }
        User user = session.getUser();
        Long userId = user.getId();
        session.setLogDate(logDate);
        session.setRawTranscript(transcriptToString(transcript));
        sessionRepo.save(session);

        try {
            // Delegate to existing FoodService for each meal type
            req.getMeals().forEach((mealType, entries) -> {
                entries.forEach(entry -> {
                    foodService.addFoodEntryForUser(
                            userId, logDate, mealType,
                            entry.getFoodName(),
                            entry.getQuantity() != null ? entry.getQuantity() : 1.0,
                            entry.getUnit() != null ? entry.getUnit() : "serving");
                });
            });

            session.setStatus(VoiceMealSession.SessionStatus.COMPLETED);
            session.setCompletedAt(userTimeZone.localDateTime(user));
            sessionRepo.save(session);

            logger.info("Voice meal log completed for user {} on {}", userId, logDate);
        } catch (Exception e) {
            session.setStatus(VoiceMealSession.SessionStatus.FAILED);
            sessionRepo.save(session);
            logger.error("Voice meal log failed: userId={}, errorType={}",
                    userId, e.getClass().getSimpleName());
            throw e;
        }
    }

    /**
     * Generates a short-lived Vapi web call token scoped to the given user.
     * The userId is embedded in metadata so the webhook can identify the user.
     */
    public String generateVapiToken(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        VapiClient.VapiWebCall call = vapiClient.createWebCall(userId);

        VoiceMealSession session = new VoiceMealSession();
        session.setUser(user);
        session.setProviderCallId(call.id());
        session.setStatus(VoiceMealSession.SessionStatus.PENDING);
        session.setCreatedAt(userTimeZone.localDateTime(user));
        sessionRepo.save(session);

        return call.token();
    }

    private VoiceMealSession resolveAuthorizedSession(String providerCallId, Map<String, Object> callMetadata) {
        if (providerCallId == null || providerCallId.isBlank()) {
            throw new SecurityException("Vapi call id is missing");
        }

        VoiceMealSession session = sessionRepo.findByProviderCallId(providerCallId)
                .orElseThrow(() -> new SecurityException("Vapi call was not minted by this application"));
        Object claimedUserId = callMetadata != null ? callMetadata.get("userId") : null;
        if (claimedUserId == null
                || !session.getUser().getId().toString().equals(claimedUserId.toString())) {
            throw new SecurityException("Vapi call user claim does not match its authenticated session");
        }
        return session;
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

    /**
     * Parses a voice call transcript using the LLM to extract meal entries,
     * then logs them via FoodService for the authenticated user.
     * Not @Transactional so each addFoodEntryForUser call auto-commits,
     * allowing the @Async nutrition enrichment to see the committed rows.
     */
    public int parseTranscriptAndLogMeals(Long userId, String transcript) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        var logDate = userTimeZone.today(user);

        // Save session record for audit
        VoiceMealSession session = new VoiceMealSession();
        session.setUser(user);
        session.setLogDate(logDate);
        session.setRawTranscript(transcript);
        session.setStatus(VoiceMealSession.SessionStatus.PENDING);
        session.setCreatedAt(userTimeZone.localDateTime(user));
        sessionRepo.save(session);

        try {
            String prompt = buildTranscriptParsingPrompt(transcript);
            String rawResponse = geminiService.callRawPrompt(prompt);
            String content = extractContentFromLLMResponse(rawResponse);
            String json = extractJson(content);

            JsonNode root = objectMapper.readTree(json);
            JsonNode mealsNode = root.path("meals");

            int totalEntries = 0;

            if (mealsNode.isArray()) {
                for (JsonNode mealNode : mealsNode) {
                    String mealType = mealNode.path("mealType").asText("snack").toLowerCase(Locale.ROOT);
                    String foodName = mealNode.path("name").asText("");
                    double quantity = mealNode.path("quantity").asDouble(1.0);
                    String unit = mealNode.path("unit").asText("serving");

                    if (!foodName.isEmpty()) {
                        foodService.addFoodEntryForUser(userId, logDate, mealType,
                                foodName, quantity, unit);
                        totalEntries++;
                    }
                }
            }

            session.setStatus(VoiceMealSession.SessionStatus.COMPLETED);
            session.setCompletedAt(userTimeZone.localDateTime(user));
            sessionRepo.save(session);

            logger.info("Parsed and logged {} meal entries from transcript for user {} on {}",
                    totalEntries, userId, logDate);
            return totalEntries;
        } catch (Exception e) {
            session.setStatus(VoiceMealSession.SessionStatus.FAILED);
            sessionRepo.save(session);
            logger.error("Failed to parse transcript: userId={}, errorType={}",
                    userId, e.getClass().getSimpleName());
            throw new RuntimeException("Failed to parse meals from conversation", e);
        }
    }

    private String buildTranscriptParsingPrompt(String transcript) {
        return String.format(
                """
                        You are a nutrition assistant. Analyze the following conversation transcript between a user and an AI assistant where the user describes the meals they ate today.

                        Extract ALL food items mentioned by the user. For each food item, determine:
                        - name: the food name
                        - quantity: numeric amount (default 1 if not mentioned)
                        - unit: the unit of measurement (e.g., "serving", "cup", "piece", "bowl", "plate", "g", "ml"). Default to "serving" if not mentioned.
                        - mealType: one of "breakfast", "lunch", "snack", "dinner". Infer from context or time-of-day clues. If unclear, use "snack".

                        IMPORTANT: Respond ONLY with valid JSON, no markdown, no explanation:
                        {
                          "meals": [
                            { "name": "food name", "quantity": 1, "unit": "serving", "mealType": "breakfast" }
                          ]
                        }

                        If no food items were mentioned, return: { "meals": [] }

                        Conversation transcript:
                        %s
                        """,
                transcript);
    }

    private String extractContentFromLLMResponse(String rawResponse) {
        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            JsonNode choices = root.path("choices");
            if (choices.isArray() && !choices.isEmpty()) {
                return choices.get(0).path("message").path("content").asText("");
            }
        } catch (Exception e) {
            logger.warn("Could not parse AI provider response structure: errorType={}",
                    e.getClass().getSimpleName());
        }
        return rawResponse;
    }

    private String extractJson(String text) {
        String cleaned = text.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }
        cleaned = cleaned.trim();
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start != -1 && end != -1 && end > start) {
            return cleaned.substring(start, end + 1);
        }
        return cleaned;
    }
}
