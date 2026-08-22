package com.habitbuilder.NutritionTracker.modules.voice;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiProviderException;
import com.habitbuilder.NutritionTracker.modules.voice.dto.MealTranscriptParseRequestDTO;
import com.habitbuilder.NutritionTracker.modules.voice.dto.MealTranscriptInterpretRequestDTO;
import com.habitbuilder.NutritionTracker.modules.voice.dto.MealTranscriptInterpretResponseDTO;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VapiSessionConfigResponseDTO;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VapiWebhookRequest;
import com.habitbuilder.NutritionTracker.modules.voice.session.VapiSessionConfig;
import com.habitbuilder.NutritionTracker.modules.voice.session.VapiSessionService;
import com.habitbuilder.NutritionTracker.modules.voice.transcript.MealTranscriptParseResult;
import com.habitbuilder.NutritionTracker.modules.voice.transcript.TranscriptInterpreter;
import com.habitbuilder.NutritionTracker.modules.voice.transcript.TranscriptParsingService;
import com.habitbuilder.NutritionTracker.modules.voice.webhook.VapiWebhookProcessor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/food")
public class VoiceLogController {

    private static final Logger logger = LoggerFactory.getLogger(VoiceLogController.class);

    private final VapiWebhookProcessor webhookProcessor;
    private final VapiSessionService vapiSessionService;
    private final TranscriptParsingService transcriptParsingService;
    private final TranscriptInterpreter transcriptInterpreter;
    private final CurrentUserProvider currentUserProvider;

    @Value("${vapi.webhook-secret:}")
    private String vapiWebhookSecret;

    public VoiceLogController(VapiWebhookProcessor webhookProcessor,
            VapiSessionService vapiSessionService,
            TranscriptParsingService transcriptParsingService,
            TranscriptInterpreter transcriptInterpreter,
            CurrentUserProvider currentUserProvider) {
        this.webhookProcessor = webhookProcessor;
        this.vapiSessionService = vapiSessionService;
        this.transcriptParsingService = transcriptParsingService;
        this.transcriptInterpreter = transcriptInterpreter;
        this.currentUserProvider = currentUserProvider;
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

                    webhookProcessor.processVoiceMealLog(
                            fn.getParameters(),
                            webhookRequest.getCall() != null ? webhookRequest.getCall().getTranscript() : null,
                            callMetadata);
                }
            }
        } catch (Exception e) {
            // Every failure is swallowed on purpose: Vapi retries on any non-2xx, and a
            // re-delivered webhook would duplicate the entries this call already logged.
            logger.error("Error processing Vapi webhook: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.ACCEPTED)
                    .body(Map.of("result", "failed", "recoverable", true));
        }

        // Must return 200 quickly — Vapi will retry on non-2xx
        return ResponseEntity.ok(Map.of("result", "logged"));
    }

    /**
     * Session config endpoint — returns short-lived, safe client config for
     * initializing a Vapi call.
     * Requires JWT authentication so the issued token is scoped to the current
     * user.
     */
    @GetMapping("/voice/session")
    public ResponseEntity<?> getVapiSessionConfig(
            @RequestParam(value = "purpose", defaultValue = "meal") String purpose) {
        Optional<User> authenticated = currentUserProvider.findCurrentUser();
        if (authenticated.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        User user = authenticated.get();

        try {
            VapiSessionConfig config = vapiSessionService.createSessionConfig(user.getId(), purpose);

                return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore())
                    .body(new VapiSessionConfigResponseDTO(
                    config.token(),
                    config.assistantId(),
                    config.purpose()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            logger.error("Vapi session configuration error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Voice service configuration is invalid"));
        } catch (Exception e) {
            logger.error("Failed to initialize Vapi session: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Failed to initialize voice session"));
        }
    }

    /**
     * Backward-compatible token endpoint.
     */
    @GetMapping("/voice/token")
    public ResponseEntity<Map<String, String>> getVapiCallToken() {
        Optional<User> authenticated = currentUserProvider.findCurrentUser();
        if (authenticated.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        User user = authenticated.get();

        String token = vapiSessionService.generateToken(user.getId());
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(Map.of("token", token));
    }

    /**
     * Authenticated endpoint — receives the call transcript from the frontend
     * after a VAPI call ends, parses meal information using the LLM, and logs
     * the food entries for the current user.
     */
    @PostMapping("/voice-log/parse-transcript")
    public ResponseEntity<Map<String, Object>> parseTranscriptAndLog(
            @RequestBody MealTranscriptParseRequestDTO body) {
        Optional<User> authenticated = currentUserProvider.findCurrentUser();
        if (authenticated.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        User user = authenticated.get();

        String transcript = body.getTranscript();
        if (transcript == null || transcript.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Transcript is required"));
        }

        String normalizedTranscript = transcript.trim();
        LocalDate logDate = body.getLogDate() != null ? body.getLogDate() : LocalDate.now();

        logger.info("Received meal transcript parse request: userId={}, chars={}",
                user.getId(), normalizedTranscript.length());

        try {
            MealTranscriptParseResult result = transcriptParsingService.parseTranscriptAndLogMeals(
                    user.getId(), logDate, normalizedTranscript);
            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "entriesLogged", result.entriesLogged(),
                    "duplicateTranscript", result.duplicateTranscript(),
                    "logDate", logDate));
        } catch (Exception e) {
            // A transient provider failure is checked first, and by cause chain, because the
            // client's retry-with-backoff depends on getting 503 rather than 500.
            AiProviderException aiProviderException = findAiProviderException(e);
            if (aiProviderException != null && aiProviderException.isRetryable()) {
                logger.warn(
                        "Failed to parse transcript for user {} due to transient AI failure from provider {} (statusCode={}): {}",
                        user.getId(),
                        aiProviderException.getProvider(),
                        aiProviderException.getStatusCode(),
                        aiProviderException.getMessage());
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Map.of("error", "AI service is temporarily busy. Please try again in a few seconds."));
            }

            // An accurate status the service already decided on (a missing user, a malformed
            // request) belongs to the client rather than being flattened into a 500. The body
            // stays this endpoint's own {error: ...} shape, because the voice screen renders
            // that string to the user — the uniform error contract's "Not Found" reason phrase
            // would read as copy. Ordered after the AI check on purpose: a retryable provider
            // failure must still answer 503.
            if (e instanceof ResponseStatusException statusException) {
                logger.warn("Transcript parse rejected for user {}: {}", user.getId(), statusException.getReason());
                return ResponseEntity.status(statusException.getStatusCode())
                        .body(Map.of("error", statusException.getReason() != null
                                ? statusException.getReason()
                                : "Failed to process meals from conversation"));
            }

            logger.error("Failed to parse transcript for user {}: {}", user.getId(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to process meals from conversation"));
        }
    }

    private AiProviderException findAiProviderException(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof AiProviderException aiProviderException) {
                return aiProviderException;
            }
            current = current.getCause();
        }
        return null;
    }

    @PostMapping("/voice-log/interpret-transcript")
    public ResponseEntity<?> interpretMealTranscript(
            @RequestBody MealTranscriptInterpretRequestDTO body) {
        if (currentUserProvider.findCurrentUser().isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String transcript = body.getTranscript();
        if (transcript == null || transcript.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Transcript is required"));
        }

        MealTranscriptInterpretResponseDTO response = transcriptInterpreter
                .interpretMealTranscript(transcript.trim(), body.getMealSlotId());
        return ResponseEntity.ok(response);
    }
}
