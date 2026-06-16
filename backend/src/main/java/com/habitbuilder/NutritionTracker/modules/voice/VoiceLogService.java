package com.habitbuilder.NutritionTracker.modules.voice;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.modules.food.FoodService;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiJsonSupport;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiTextService;
import com.habitbuilder.NutritionTracker.modules.voice.dto.MealTranscriptInterpretResponseDTO;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VapiWebhookRequest;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VoiceMealLogRequest;

import jakarta.annotation.PostConstruct;
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
    private final AiTextService aiTextService;
    private final ConcurrentHashMap<String, Long> recentTranscriptParses = new ConcurrentHashMap<>();

    @Value("${vapi.public-key:}")
    private String vapiPublicKey;

    @Value("${vapi.meal-assistant-id:${vapi.assistant-id:}}")
    private String vapiMealAssistantId;

    // The dedicated meal id WITHOUT the shared fallback, so we can detect (and log) when meal
    // calls are silently borrowing the generic VAPI_ASSISTANT_ID instead of their own assistant.
    @Value("${vapi.meal-assistant-id:}")
    private String dedicatedMealAssistantId;

    @Value("${vapi.habit-assistant-id:${vapi.assistant-id:}}")
    private String vapiHabitAssistantId;

    public VoiceLogService(FoodService foodService,
            UserRepository userRepository,
            VoiceMealSessionRepository sessionRepo,
            ObjectMapper objectMapper,
            AiTextService aiTextService) {
        this.foodService = foodService;
        this.userRepository = userRepository;
        this.sessionRepo = sessionRepo;
        this.objectMapper = objectMapper;
        this.aiTextService = aiTextService;
    }

    /**
     * Surfaces the meal-assistant configuration at startup so a missing dedicated meal
     * assistant is observable, not a silent accident. Meal and habit deliberately use two
     * separate Vapi assistants (their voice/persona are aligned in the Vapi dashboard); this
     * warns when meal has no dedicated id and is borrowing the shared VAPI_ASSISTANT_ID.
     */
    @PostConstruct
    void logAssistantConfiguration() {
        if (dedicatedMealAssistantId == null || dedicatedMealAssistantId.isBlank()) {
            logger.warn(
                    "Vapi meal assistant id not set (VAPI_MEAL_ASSISTANT_ID); meal calls fall back to the shared "
                            + "VAPI_ASSISTANT_ID. Set a dedicated meal assistant to control the meal call persona/voice "
                            + "independently of habit calls.");
        } else {
            logger.info("Vapi meal assistant configured via VAPI_MEAL_ASSISTANT_ID.");
        }
        if (vapiHabitAssistantId == null || vapiHabitAssistantId.isBlank()) {
            logger.warn(
                    "Vapi habit assistant id resolves empty; habit calls will fail until VAPI_HABIT_ASSISTANT_ID "
                            + "(or VAPI_ASSISTANT_ID) is configured.");
        }
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
            String content = aiTextService.callRawPrompt(prompt);
            String json = AiJsonSupport.extractJson(content);

            JsonNode root = objectMapper.readTree(json);
            JsonNode mealsNode = root.path("meals");

            int totalEntries = 0;

            if (mealsNode.isArray()) {
                for (JsonNode mealNode : mealsNode) {
                    String mealType = mealNode.path("mealType").asText("snack").toLowerCase();
                    String foodName = mealNode.path("name").asText("");
                    double quantity = mealNode.path("quantity").asDouble(1.0);
                    String unit = mealNode.path("unit").asText("serving");
                    Double standardQuantity = mealNode.path("standardQuantity").isNumber()
                            ? mealNode.path("standardQuantity").asDouble()
                            : null;
                    String standardUnit = mealNode.path("standardUnit").isTextual()
                            ? mealNode.path("standardUnit").asText(null)
                            : null;

                    if (!foodName.isEmpty()) {
                        foodService.addFoodEntryForUser(userId, effectiveLogDate, mealType,
                                foodName, quantity, unit, standardQuantity, standardUnit);
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
                        - quantity: numeric amount as spoken by the user (default 1 if not mentioned)
                        - unit: the unit as spoken by the user (e.g., "serving", "cup", "piece", "bowl", "plate", "g", "ml"). Default to "serving" if not mentioned.
                        - mealType: one of "breakfast", "lunch", "snack", "dinner". Infer from context or time-of-day clues. If unclear, use "snack".
                        - standardQuantity: if the unit is non-standard or vague (e.g., bowl, plate, piece, handful, glass, scoop, serving), estimate the equivalent weight in grams (for solids) or volume in ml (for liquids). Set to null if the unit is already a standard measurement like g, kg, oz, ml, l, tbsp, tsp, cup.
                        - standardUnit: "g" when standardQuantity is a weight, "ml" when it is a volume. Set to null when standardQuantity is null.

                        Examples:
                        - "2 bowls of rice" → quantity=2, unit="bowl", standardQuantity=350, standardUnit="g"
                        - "1 plate of chicken curry" → quantity=1, unit="plate", standardQuantity=400, standardUnit="g"
                        - "3 pieces of bread" → quantity=3, unit="piece", standardQuantity=90, standardUnit="g"
                        - "200g of oats" → quantity=200, unit="g", standardQuantity=null, standardUnit=null
                        - "1 cup of milk" → quantity=1, unit="cup", standardQuantity=240, standardUnit="ml"

                        IMPORTANT: Respond ONLY with valid JSON, no markdown, no explanation:
                        {
                          "meals": [
                            { "name": "food name", "quantity": 1, "unit": "serving", "mealType": "breakfast", "standardQuantity": 150, "standardUnit": "g" }
                          ]
                        }

                        If no food items were mentioned, return: { "meals": [] }

                        User transcript:
                        %s
                        """,
                transcript);
    }

    public MealTranscriptInterpretResponseDTO interpretMealTranscript(String transcript, String mealSlotId) {
        MealTranscriptInterpretResponseDTO response = new MealTranscriptInterpretResponseDTO();
        response.setShouldLogMeals(false);
        response.setRescheduleMinutes(null);
        response.setRationale(AiJsonSupport.RATIONALE_NO_TRANSCRIPT);

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
                        3) rescheduleMinutes should be set when user asks for a callback or follow-up call later.
                           Extract the specific minutes when mentioned (e.g., "call me in 5 minutes" → 5,
                           "remind me in an hour" → 60). If user asks to reschedule/call back without specifying
                           a time, default to 30. Return null only when no reschedule was requested.
                        4) If both happened, keep shouldLogMeals=true and also set rescheduleMinutes.
                        5) If uncertain, choose shouldLogMeals=false and rescheduleMinutes=null.
                        6) Never include markdown or extra text.

                        Context meal slot: %s

                        Transcript:
                        %s
                        """,
                mealSlotId != null ? mealSlotId : "unknown",
                transcript);

        try {
            String modelText = aiTextService.callRawPrompt(prompt);
            String json = AiJsonSupport.extractJson(modelText);
            JsonNode root = objectMapper.readTree(json);

            boolean shouldLogMeals = root.path("shouldLogMeals").asBoolean(false);
            Integer rescheduleMinutes = root.path("rescheduleMinutes").isNumber()
                    ? root.path("rescheduleMinutes").asInt()
                    : null;
            if (rescheduleMinutes != null && rescheduleMinutes <= 0) {
                rescheduleMinutes = null;
            }

            response.setShouldLogMeals(shouldLogMeals);
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
