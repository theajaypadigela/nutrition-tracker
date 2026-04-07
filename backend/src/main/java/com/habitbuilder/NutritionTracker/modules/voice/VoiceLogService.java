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
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class VoiceLogService {

    private static final Logger logger = LoggerFactory.getLogger(VoiceLogService.class);
    private static final long TRANSCRIPT_IDEMPOTENCY_WINDOW_MILLIS = 120_000;

    public record MealTranscriptParseResult(int entriesLogged, boolean duplicateTranscript) {
    }

    public record VapiSessionConfig(String token, String assistantId, String purpose) {
    }

    private final FoodService foodService;
    private final UserRepository userRepository;
    private final VoiceMealSessionRepository sessionRepo;
    private final ObjectMapper objectMapper;
    private final GeminiService geminiService;
    private final ConcurrentHashMap<String, Long> recentTranscriptParses = new ConcurrentHashMap<>();

    @Value("${vapi.public-key:}")
    private String vapiPublicKey;

    @Value("${vapi.meal-assistant-id:${vapi.assistant-id:}}")
    private String vapiMealAssistantId;

    @Value("${vapi.habit-assistant-id:${vapi.assistant-id:}}")
    private String vapiHabitAssistantId;

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
        VoiceMealSession session = new VoiceMealSession();
        session.setStatus(VoiceMealSession.SessionStatus.PENDING);
        session.setCreatedAt(LocalDateTime.now());
        session.setRawTranscript(transcriptToString(transcript));
        session.setPayloadSnapshot(buildWebhookPayloadSnapshot(params, callMetadata));
        sessionRepo.save(session);

        try {
            VoiceMealLogRequest req = objectMapper.convertValue(params, VoiceMealLogRequest.class);
            String userId = resolveUserFromCallMetadata(callMetadata);
            session.setUserId(userId);

            LocalDate logDate = parseRequestedLogDate(req.getDate());
            session.setLogDate(logDate);

            userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found for voice log: " + userId));

            Map<String, List<VoiceMealLogRequest.MealEntryDto>> meals = req.getMeals();
            if (meals == null || meals.isEmpty()) {
                throw new RuntimeException("Webhook payload did not contain any meals");
            }

            sessionRepo.save(session);

            final int[] totalEntries = { 0 };
            meals.forEach((mealType, entries) -> {
                if (entries == null || entries.isEmpty()) {
                    return;
                }

                entries.forEach(entry -> {
                    if (entry == null) {
                        return;
                    }

                    foodService.addFoodEntryForUser(
                            userId, logDate, mealType,
                            entry.getFoodName(),
                            entry.getQuantity() != null ? entry.getQuantity() : 1.0,
                            entry.getUnit() != null ? entry.getUnit() : "serving");
                    totalEntries[0]++;
                });
            });

            if (totalEntries[0] == 0) {
                throw new RuntimeException("Webhook payload did not contain any valid meal entries");
            }

            session.setStatus(VoiceMealSession.SessionStatus.COMPLETED);
            session.setCompletedAt(LocalDateTime.now());
            session.setFailureReason(null);
            sessionRepo.save(session);

            logger.info("Voice meal log completed for user {} on {}", userId, logDate);
        } catch (Exception e) {
            session.setStatus(VoiceMealSession.SessionStatus.FAILED);
            session.setFailureReason(e.getMessage());
            sessionRepo.save(session);
            logger.error("Voice meal log failed for session {}: {}", session.getId(), e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Builds the client-side Vapi session config for the authenticated user and
     * purpose. The token returned here is the Vapi API token used to initialize
     * the React Native SDK instance.
     */
    public VapiSessionConfig createVapiSessionConfig(String userId, String purpose) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User id is required to create Vapi session");
        }

        String normalizedPurpose = normalizePurpose(purpose);
        String assistantId = resolveAssistantIdForPurpose(normalizedPurpose);
        String clientToken = resolveClientToken();

        return new VapiSessionConfig(clientToken, assistantId, normalizedPurpose);
    }

    private String resolveClientToken() {
        String publicKey = sanitizeApiKey(vapiPublicKey);
        if (!publicKey.isBlank()) {
            return publicKey;
        }

        throw new IllegalStateException("Vapi public key is not configured");
    }

    private String sanitizeApiKey(String rawKey) {
        if (rawKey == null) {
            return "";
        }

        String key = rawKey.trim();
        if (key.startsWith("Bearer ")) {
            key = key.substring("Bearer ".length()).trim();
        }
        if ((key.startsWith("\"") && key.endsWith("\"")) || (key.startsWith("'") && key.endsWith("'"))) {
            key = key.substring(1, key.length() - 1).trim();
        }

        return key;
    }

    /**
     * Backward-compatible helper used by older callers that only require token.
     */
    public String generateVapiToken(String userId) {
        return createVapiSessionConfig(userId, "meal").token();
    }

    private String normalizePurpose(String purpose) {
        if (purpose == null || purpose.isBlank()) {
            return "meal";
        }

        String normalized = purpose.trim().toLowerCase(Locale.ROOT);
        if (!"meal".equals(normalized) && !"habit".equals(normalized)) {
            throw new IllegalArgumentException("Unsupported voice purpose: " + purpose);
        }
        return normalized;
    }

    private String resolveAssistantIdForPurpose(String purpose) {
        String assistantId = "habit".equals(purpose) ? vapiHabitAssistantId : vapiMealAssistantId;
        if (assistantId == null || assistantId.isBlank()) {
            throw new IllegalStateException("Vapi assistant id is not configured for purpose: " + purpose);
        }
        return assistantId;
    }

    private String resolveUserFromCallMetadata(Map<String, Object> callMetadata) {
        if (callMetadata != null && callMetadata.containsKey("userId")) {
            return callMetadata.get("userId").toString();
        }
        throw new RuntimeException("Cannot resolve user from Vapi webhook — userId missing from call metadata");
    }

    private LocalDate parseRequestedLogDate(String requestedDate) {
        if (requestedDate == null || requestedDate.isBlank()) {
            throw new RuntimeException("Voice log date is required");
        }

        try {
            return LocalDate.parse(requestedDate.trim());
        } catch (Exception e) {
            throw new RuntimeException("Voice log date must be in YYYY-MM-DD format", e);
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

    /**
     * Parses a voice call transcript using the LLM to extract meal entries,
     * then logs them via FoodService for the authenticated user.
     * Not @Transactional so each addFoodEntryForUser call auto-commits,
     * allowing the @Async nutrition enrichment to see the committed rows.
     */
    public MealTranscriptParseResult parseTranscriptAndLogMeals(String userId, LocalDate logDate, String transcript) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        String normalizedTranscript = transcript == null ? "" : transcript.trim();
        LocalDate effectiveLogDate = logDate != null ? logDate : LocalDate.now();
        String idempotencyKey = userId + ":" + effectiveLogDate + ":" + sha256(normalizedTranscript);
        long now = System.currentTimeMillis();
        cleanupOldIdempotencyKeys(now);

        Long previous = recentTranscriptParses.putIfAbsent(idempotencyKey, now);
        if (previous != null && now - previous < TRANSCRIPT_IDEMPOTENCY_WINDOW_MILLIS) {
            logger.warn("Skipping duplicate transcript parse request for user {} within idempotency window", userId);
            return new MealTranscriptParseResult(0, true);
        }
        if (previous != null) {
            recentTranscriptParses.put(idempotencyKey, now);
        }

        // Save session record for audit
        VoiceMealSession session = new VoiceMealSession();
        session.setUserId(user.getId());
        session.setLogDate(effectiveLogDate);
        session.setRawTranscript(transcript);
        session.setStatus(VoiceMealSession.SessionStatus.PENDING);
        session.setCreatedAt(LocalDateTime.now());
        sessionRepo.save(session);

        try {
            String prompt = buildTranscriptParsingPrompt(normalizedTranscript);
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
                        foodService.addFoodEntryForUser(userId, effectiveLogDate, mealType,
                                foodName, quantity, unit);
                        totalEntries++;
                    }
                }
            }

            session.setStatus(VoiceMealSession.SessionStatus.COMPLETED);
            session.setCompletedAt(LocalDateTime.now());
            session.setFailureReason(null);
            sessionRepo.save(session);

            logger.info("Parsed and logged {} meal entries from transcript for user {} on {}",
                    totalEntries, userId, effectiveLogDate);
            return new MealTranscriptParseResult(totalEntries, false);
        } catch (Exception e) {
            recentTranscriptParses.remove(idempotencyKey);
            session.setStatus(VoiceMealSession.SessionStatus.FAILED);
            session.setFailureReason(e.getMessage());
            sessionRepo.save(session);
            logger.error("Failed to parse transcript for user {}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Failed to parse meals from conversation: " + e.getMessage(), e);
        }
    }

    private String buildTranscriptParsingPrompt(String transcript) {
        return String.format(
                """
                        You are a nutrition assistant. Analyze the following transcript lines spoken by a user describing the meals they ate today.

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

                        User transcript:
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

    private void cleanupOldIdempotencyKeys(long nowMillis) {
        recentTranscriptParses.entrySet().removeIf(
                entry -> nowMillis - entry.getValue() >= TRANSCRIPT_IDEMPOTENCY_WINDOW_MILLIS);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }
}
