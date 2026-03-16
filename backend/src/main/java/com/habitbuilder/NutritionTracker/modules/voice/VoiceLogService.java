package com.habitbuilder.NutritionTracker.modules.voice;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.modules.food.FoodService;
import com.habitbuilder.NutritionTracker.modules.nutrition.GeminiService;
import com.habitbuilder.NutritionTracker.modules.voice.dto.MealTranscriptInterpretResponseDTO;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VapiWebhookRequest;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VoiceMealLogRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class VoiceLogService {

    private static final Logger logger = LoggerFactory.getLogger(VoiceLogService.class);

    private final FoodService foodService;
    private final UserRepository userRepository;
    private final VoiceMealSessionRepository sessionRepo;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final GeminiService geminiService;

    @Value("${vapi.private-key}")
    private String vapiPrivateKey;

    @Value("${vapi.assistant-id}")
    private String vapiAssistantId;

        private static final Pattern RESCHEDULE_MINUTES_PATTERN = Pattern
            .compile("(?:in|after)\\s+(\\d{1,3})\\s*(?:minutes?|mins?|m)\\b", Pattern.CASE_INSENSITIVE);

    public VoiceLogService(FoodService foodService,
            UserRepository userRepository,
            VoiceMealSessionRepository sessionRepo,
            ObjectMapper objectMapper,
            GeminiService geminiService) {
        this.foodService = foodService;
        this.userRepository = userRepository;
        this.sessionRepo = sessionRepo;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
        this.geminiService = geminiService;
    }

    /**
     * Processes a voice meal log from the Vapi webhook.
     * Not @Transactional so each addFoodEntryForUser call auto-commits,
     * allowing the @Async nutrition enrichment to see the committed rows.
     */
    public void processVoiceMealLog(Map<String, Object> params,
            List<VapiWebhookRequest.TranscriptEntry> transcript,
            Map<String, Object> callMetadata) {
        VoiceMealLogRequest req = objectMapper.convertValue(params, VoiceMealLogRequest.class);
        LocalDate logDate = LocalDate.parse(req.getDate());

        String userId = resolveUserFromCallMetadata(callMetadata);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found for voice log: " + userId));

        // Save session record for audit
        VoiceMealSession session = new VoiceMealSession();
        session.setUserId(user.getId());
        session.setLogDate(logDate);
        session.setRawTranscript(transcriptToString(transcript));
        session.setStatus(VoiceMealSession.SessionStatus.PENDING);
        session.setCreatedAt(LocalDateTime.now());
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
            session.setCompletedAt(LocalDateTime.now());
            sessionRepo.save(session);

            logger.info("Voice meal log completed for user {} on {}", userId, logDate);
        } catch (Exception e) {
            session.setStatus(VoiceMealSession.SessionStatus.FAILED);
            sessionRepo.save(session);
            logger.error("Voice meal log failed for user {}: {}", userId, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Generates a short-lived Vapi web call token scoped to the given user.
     * The userId is embedded in metadata so the webhook can identify the user.
     */
    @SuppressWarnings({ "unchecked", "rawtypes" })
    public String generateVapiToken(String userId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(vapiPrivateKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "assistantId", vapiAssistantId,
                "assistantOverrides", Map.of(
                        "metadata", Map.of("userId", userId)));

        ResponseEntity<Map> response = restTemplate.postForEntity(
                "https://api.vapi.ai/call/web",
                new HttpEntity<>(body, headers),
                Map.class);

        Map responseBody = response.getBody();
        if (responseBody == null || !responseBody.containsKey("token")) {
            throw new RuntimeException("Failed to obtain Vapi call token");
        }

        return (String) responseBody.get("token");
    }

    private String resolveUserFromCallMetadata(Map<String, Object> callMetadata) {
        if (callMetadata != null && callMetadata.containsKey("userId")) {
            return callMetadata.get("userId").toString();
        }
        throw new RuntimeException("Cannot resolve user from Vapi webhook — userId missing from call metadata");
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
    public int parseTranscriptAndLogMeals(String userId, String transcript) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        LocalDate logDate = LocalDate.now();

        // Save session record for audit
        VoiceMealSession session = new VoiceMealSession();
        session.setUserId(user.getId());
        session.setLogDate(logDate);
        session.setRawTranscript(transcript);
        session.setStatus(VoiceMealSession.SessionStatus.PENDING);
        session.setCreatedAt(LocalDateTime.now());
        sessionRepo.save(session);

        try {
            String prompt = buildTranscriptParsingPrompt(transcript);
            String content = geminiService.callRawPrompt(prompt);
            String json = extractJson(content);

            JsonNode root = objectMapper.readTree(json);
            JsonNode mealsNode = root.path("meals");

            int totalEntries = 0;

            if (mealsNode.isArray()) {
                for (JsonNode mealNode : mealsNode) {
                    String mealType = mealNode.path("mealType").asText("snack").toLowerCase();
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
            session.setCompletedAt(LocalDateTime.now());
            sessionRepo.save(session);

            logger.info("Parsed and logged {} meal entries from transcript for user {} on {}",
                    totalEntries, userId, logDate);
            return totalEntries;
        } catch (Exception e) {
            session.setStatus(VoiceMealSession.SessionStatus.FAILED);
            sessionRepo.save(session);
            logger.error("Failed to parse transcript for user {}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Failed to parse meals from conversation: " + e.getMessage(), e);
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

    public MealTranscriptInterpretResponseDTO interpretMealTranscript(String transcript, String mealSlotId) {
        MealTranscriptInterpretResponseDTO response = new MealTranscriptInterpretResponseDTO();
        response.setShouldLogMeals(false);
        response.setRescheduleMinutes(null);
        response.setRationale("no_transcript");

        if (transcript == null || transcript.isBlank()) {
            return response;
        }

        String prompt = String.format(
                """
                        You are classifying a meal voice call transcript.

                        Return ONLY valid JSON in this exact shape:
                        {
                          "shouldLogMeals": true or false,
                          "rescheduleMinutes": number or null,
                          "rationale": "short explanation"
                        }

                        Rules:
                        1) shouldLogMeals = true when user actually provided meal/food details to be logged now.
                        2) shouldLogMeals = false when user asks to do it later, asks to be called/reminded later, or only confirms a later time.
                        3) rescheduleMinutes should be set when user asks for delay or confirms delayed follow-up time; otherwise null.
                        4) If both happened, keep shouldLogMeals=true and also set rescheduleMinutes.
                        5) If uncertain, choose shouldLogMeals=false and rescheduleMinutes=null.

                        Context meal slot: %s

                        Transcript:
                        %s
                        """,
                mealSlotId != null ? mealSlotId : "unknown",
                transcript);

        try {
            String modelText = geminiService.callRawPrompt(prompt);
            String json = extractJson(modelText);
            JsonNode root = objectMapper.readTree(json);

            boolean shouldLogMeals = root.path("shouldLogMeals").asBoolean(false);
            Integer rescheduleMinutes = root.path("rescheduleMinutes").isNumber()
                    ? root.path("rescheduleMinutes").asInt()
                    : null;
            if (rescheduleMinutes != null && rescheduleMinutes <= 0) {
                rescheduleMinutes = null;
            }
            if (rescheduleMinutes == null) {
                rescheduleMinutes = inferRescheduleMinutes(transcript);
            }

            response.setShouldLogMeals(shouldLogMeals);
            response.setRescheduleMinutes(rescheduleMinutes);
            response.setRationale(root.path("rationale").asText("classified_by_gemini"));
            return response;
        } catch (Exception e) {
            logger.warn("Meal transcript interpretation failed, using fallback: {}", e.getMessage());
            Integer fallbackMinutes = inferRescheduleMinutes(transcript);
            response.setShouldLogMeals(fallbackMinutes == null);
            response.setRescheduleMinutes(fallbackMinutes);
            response.setRationale(fallbackMinutes != null ? "fallback_delay_detected" : "fallback_log_meals");
            return response;
        }
    }

    private Integer inferRescheduleMinutes(String transcript) {
        if (transcript == null || transcript.isBlank()) {
            return null;
        }

        Matcher matcher = RESCHEDULE_MINUTES_PATTERN.matcher(transcript);
        if (!matcher.find()) {
            return null;
        }

        try {
            int parsed = Integer.parseInt(matcher.group(1));
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
