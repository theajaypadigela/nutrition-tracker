package com.habitbuilder.NutritionTracker.modules.voice;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VapiWebhookRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/food")
public class VoiceLogController {

    private static final Logger logger = LoggerFactory.getLogger(VoiceLogController.class);

    private final VoiceLogService voiceLogService;

    @Value("${vapi.webhook-secret:}")
    private String vapiWebhookSecret;

    public VoiceLogController(VoiceLogService voiceLogService) {
        this.voiceLogService = voiceLogService;
    }

    /**
     * Webhook endpoint called by Vapi when a voice call ends or a function is
     * invoked.
     * This endpoint is publicly accessible (no JWT) but validated via X-Vapi-Secret
     * header.
     */
    @PostMapping("/voice-log")
    public ResponseEntity<?> handleVapiWebhook(
            @RequestHeader(value = "X-Vapi-Secret", required = false) String secret,
            @RequestBody VapiWebhookRequest webhookRequest) {

        // Validate webhook secret if configured
        if (vapiWebhookSecret != null && !vapiWebhookSecret.isEmpty()
                && !vapiWebhookSecret.equals(secret)) {
            logger.warn("Vapi webhook request rejected — invalid secret");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            if (webhookRequest.getMessage() != null
                    && "function-call".equals(webhookRequest.getMessage().getType())) {

                VapiWebhookRequest.FunctionCall fn = webhookRequest.getMessage().getFunctionCall();
                if (fn != null && "submit_meal_log".equals(fn.getName())) {
                    Map<String, Object> callMetadata = webhookRequest.getCall() != null
                            ? webhookRequest.getCall().getMetadata()
                            : null;

                    voiceLogService.processVoiceMealLog(
                            fn.getParameters(),
                            webhookRequest.getCall() != null ? webhookRequest.getCall().getTranscript() : null,
                            callMetadata);
                }
            }
        } catch (Exception e) {
            logger.error("Error processing Vapi webhook: {}", e.getMessage(), e);
            // Still return 200 to prevent Vapi retries for application errors
        }

        // Must return 200 quickly — Vapi will retry on non-2xx
        return ResponseEntity.ok(Map.of("result", "logged"));
    }

    /**
     * Token endpoint — returns a short-lived Vapi web call token.
     * Requires JWT authentication so we know which user is starting the call.
     */
    @GetMapping("/voice/token")
    public ResponseEntity<Map<String, String>> getVapiCallToken() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String token = voiceLogService.generateVapiToken(user.getId());
        return ResponseEntity.ok(Map.of("token", token));
    }

    /**
     * Authenticated endpoint — receives the call transcript from the frontend
     * after a VAPI call ends, parses meal information using the LLM, and logs
     * the food entries for the current user.
     */
    @PostMapping("/voice-log/parse-transcript")
    public ResponseEntity<Map<String, Object>> parseTranscriptAndLog(
            @RequestBody Map<String, String> body) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String transcript = body.get("transcript");
        if (transcript == null || transcript.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Transcript is required"));
        }

        String normalizedTranscript = transcript.trim();
        String loweredTranscript = normalizedTranscript.toLowerCase();
        boolean hasDelayIntent = loweredTranscript.contains("call me in")
                || loweredTranscript.contains("remind me in")
                || loweredTranscript.contains("in 5 min")
                || loweredTranscript.matches(".*\\b(in|after)\\s+\\d{1,3}\\s*(minutes?|mins?|m)\\b.*");

        logger.info("Received meal transcript parse request: userId={}, chars={}, delayIntentDetected={}",
                user.getId(), normalizedTranscript.length(), hasDelayIntent);

        try {
            int entriesLogged = voiceLogService.parseTranscriptAndLogMeals(
                    user.getId(), normalizedTranscript);
            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "entriesLogged", entriesLogged));
        } catch (Exception e) {
            logger.error("Failed to parse transcript for user {}: {}", user.getId(), e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to process meals from conversation"));
        }
    }
}
