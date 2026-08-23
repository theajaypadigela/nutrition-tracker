package com.habitbuilder.NutritionTracker.modules.voice.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiProviderException;
import com.habitbuilder.NutritionTracker.modules.voice.VoiceTranscriptProcessingException;
import com.habitbuilder.NutritionTracker.modules.voice.dto.MealTranscriptInterpretResponseDTO;
import com.habitbuilder.NutritionTracker.modules.voice.dto.VapiWebhookRequest;
import com.habitbuilder.NutritionTracker.modules.voice.session.VapiSessionConfig;
import com.habitbuilder.NutritionTracker.modules.voice.session.VapiSessionService;
import com.habitbuilder.NutritionTracker.modules.voice.transcript.MealTranscriptParseResult;
import com.habitbuilder.NutritionTracker.modules.voice.transcript.TranscriptInterpreter;
import com.habitbuilder.NutritionTracker.modules.voice.transcript.TranscriptParsingService;
import com.habitbuilder.NutritionTracker.modules.voice.webhook.VapiWebhookProcessor;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(VoiceLogController.class)
class VoiceLogControllerTest {

    private static final String USER_ID = "user-42";
    private static final LocalDate LOG_DATE = LocalDate.of(2026, 6, 14);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private VapiWebhookProcessor webhookProcessor;

    @MockitoBean
    private VapiSessionService vapiSessionService;

    @MockitoBean
    private TranscriptParsingService transcriptParsingService;

    @MockitoBean
    private TranscriptInterpreter transcriptInterpreter;

    @MockitoBean
    private CurrentUserProvider currentUserProvider;

    private void signedIn() {
        User user = new User();
        user.setId(USER_ID);
        user.setEmail("voice@example.com");
        when(currentUserProvider.findCurrentUser()).thenReturn(Optional.of(user));
    }

    private void anonymous() {
        when(currentUserProvider.findCurrentUser()).thenReturn(Optional.empty());
    }

    // ---------------------------------------------------------------- POST /food/voice-log

    @Test
    void logsTheMealAndAnswers200WhenVapiCallsSubmitMealLog() throws Exception {
        mockMvc.perform(post("/food/voice-log")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "message": {
                            "type": "function-call",
                            "functionCall": {
                              "name": "submit_meal_log",
                              "parameters": {
                                "date": "2026-06-14",
                                "meals": {
                                  "breakfast": [{"foodName": "scrambled eggs", "quantity": 2}]
                                }
                              }
                            }
                          },
                          "call": {
                            "id": "call-1",
                            "transcript": [{"role": "user", "message": "I had two scrambled eggs", "time": 1.5}],
                            "metadata": {"userId": "user-42"}
                          }
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("logged"));

        ArgumentCaptor<Map<String, Object>> parameters = ArgumentCaptor.captor();
        ArgumentCaptor<List<VapiWebhookRequest.TranscriptEntry>> transcript = ArgumentCaptor.captor();
        ArgumentCaptor<Map<String, Object>> metadata = ArgumentCaptor.captor();
        verify(webhookProcessor).processVoiceMealLog(
                parameters.capture(), transcript.capture(), metadata.capture());

        assertEquals("2026-06-14", parameters.getValue().get("date"));
        assertEquals(Map.of("breakfast", List.of(Map.of("foodName", "scrambled eggs", "quantity", 2))),
                parameters.getValue().get("meals"));
        assertEquals(1, transcript.getValue().size());
        assertEquals("user", transcript.getValue().get(0).getRole());
        assertEquals("I had two scrambled eggs", transcript.getValue().get(0).getMessage());
        assertEquals(Map.of("userId", USER_ID), metadata.getValue());
    }

    /**
     * The swallow is deliberate and must stay: Vapi retries on any non-2xx, and a re-delivered
     * webhook would double-log the entries the failed call already wrote. The failure is
     * reported inside a 2xx body instead.
     */
    @Test
    void answers202WithAFailedResultWhenTheProcessorThrows() throws Exception {
        doThrow(new IllegalStateException("mongo unavailable"))
                .when(webhookProcessor).processVoiceMealLog(any(), any(), any());

        mockMvc.perform(post("/food/voice-log")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "message": {
                            "type": "function-call",
                            "functionCall": {"name": "submit_meal_log", "parameters": {"date": "2026-06-14"}}
                          },
                          "call": {"metadata": {"userId": "user-42"}}
                        }
                        """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.result").value("failed"))
                .andExpect(jsonPath("$.recoverable").value(true));
    }

    @Test
    void ignoresWebhooksThatAreNotASubmitMealLogFunctionCall() throws Exception {
        mockMvc.perform(post("/food/voice-log")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":{\"type\":\"end-of-call-report\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("logged"));

        mockMvc.perform(post("/food/voice-log")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":{\"type\":\"function-call\",\"functionCall\":{\"name\":\"other_tool\"}}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("logged"));

        mockMvc.perform(post("/food/voice-log")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("logged"));

        verifyNoInteractions(webhookProcessor);
    }

    /** No {@code call} object at all still reaches the processor — with nulls for both of its
     * call-derived arguments, which is where the "user missing from metadata" rejection is
     * decided, not here. */
    @Test
    void passesNullTranscriptAndMetadataWhenTheWebhookCarriesNoCall() throws Exception {
        mockMvc.perform(post("/food/voice-log")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "message": {
                            "type": "function-call",
                            "functionCall": {"name": "submit_meal_log", "parameters": {"date": "2026-06-14"}}
                          }
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("logged"));

        verify(webhookProcessor).processVoiceMealLog(
                eq(Map.of("date", "2026-06-14")), isNull(), isNull());
    }

    // ----------------------------------------------------------- GET /food/voice/session

    @Test
    void answers401WithAnEmptyBodyForAnAnonymousSessionRequest() throws Exception {
        anonymous();

        mockMvc.perform(get("/food/voice/session").param("purpose", "meal"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));

        verifyNoInteractions(vapiSessionService);
    }

    @Test
    void returnsTheSessionConfigForTheRequestedPurpose() throws Exception {
        signedIn();
        when(vapiSessionService.createSessionConfig(USER_ID, "habit"))
                .thenReturn(new VapiSessionConfig("pk_live_abc", "asst_habit", "habit"));

        mockMvc.perform(get("/food/voice/session").param("purpose", "habit"))
                .andExpect(status().isOk())
                // The token is short-lived and user-scoped, so no cache may keep a copy.
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.token").value("pk_live_abc"))
                .andExpect(jsonPath("$.assistantId").value("asst_habit"))
                .andExpect(jsonPath("$.purpose").value("habit"));
    }

    @Test
    void defaultsTheSessionPurposeToMealWhenNoneIsRequested() throws Exception {
        signedIn();
        when(vapiSessionService.createSessionConfig(USER_ID, "meal"))
                .thenReturn(new VapiSessionConfig("pk_live_abc", "asst_meal", "meal"));

        mockMvc.perform(get("/food/voice/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purpose").value("meal"));

        verify(vapiSessionService).createSessionConfig(USER_ID, "meal");
    }

    @Test
    void answers400WhenTheSessionServiceRejectsThePurpose() throws Exception {
        signedIn();
        when(vapiSessionService.createSessionConfig(USER_ID, "dessert"))
                .thenThrow(new IllegalArgumentException("Unsupported voice purpose: dessert"));

        mockMvc.perform(get("/food/voice/session").param("purpose", "dessert"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Unsupported voice purpose: dessert"));
    }

    /** A misconfigured server keeps its own diagnostics: the caller is told the configuration
     * is invalid, never what is missing. */
    @Test
    void answers500WhenTheVoiceServiceIsMisconfigured() throws Exception {
        signedIn();
        when(vapiSessionService.createSessionConfig(USER_ID, "meal"))
                .thenThrow(new IllegalStateException("Vapi public key is not configured"));

        mockMvc.perform(get("/food/voice/session").param("purpose", "meal"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.message").value("Voice service configuration is invalid"));
    }

    @Test
    void answers502WhenSessionSetupFailsForAnyOtherReason() throws Exception {
        signedIn();
        when(vapiSessionService.createSessionConfig(USER_ID, "meal"))
                .thenThrow(new RuntimeException("vapi unreachable"));

        mockMvc.perform(get("/food/voice/session").param("purpose", "meal"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value(502))
                .andExpect(jsonPath("$.error").value("Bad Gateway"))
                .andExpect(jsonPath("$.message").value("Failed to initialize voice session"));
    }

    // ------------------------------------------------------------- GET /food/voice/token

    @Test
    void answers401WithAnEmptyBodyForAnAnonymousTokenRequest() throws Exception {
        anonymous();

        mockMvc.perform(get("/food/voice/token"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));

        verifyNoInteractions(vapiSessionService);
    }

    @Test
    void returnsTheCallTokenForTheAuthenticatedUser() throws Exception {
        signedIn();
        when(vapiSessionService.generateToken(USER_ID)).thenReturn("pk_live_abc");

        mockMvc.perform(get("/food/voice/token"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.token").value("pk_live_abc"));
    }

    // -------------------------------------------- POST /food/voice-log/parse-transcript

    @Test
    void answers401WithAnEmptyBodyForAnAnonymousParseRequest() throws Exception {
        anonymous();

        mockMvc.perform(post("/food/voice-log/parse-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"I had two eggs\",\"logDate\":\"2026-06-14\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));

        verifyNoInteractions(transcriptParsingService);
    }

    @Test
    void rejectsAMissingOrBlankTranscriptWith400() throws Exception {
        signedIn();

        mockMvc.perform(post("/food/voice-log/parse-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"logDate\":\"2026-06-14\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Transcript is required"));

        mockMvc.perform(post("/food/voice-log/parse-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"   \",\"logDate\":\"2026-06-14\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Transcript is required"));

        verifyNoInteractions(transcriptParsingService);
    }

    @Test
    void parsesTheTranscriptAndReportsWhatWasLogged() throws Exception {
        signedIn();
        when(transcriptParsingService.parseTranscriptAndLogMeals(USER_ID, LOG_DATE, "I had two eggs"))
                .thenReturn(new MealTranscriptParseResult(2, false));

        mockMvc.perform(post("/food/voice-log/parse-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"  I had two eggs  \",\"logDate\":\"2026-06-14\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.entriesLogged").value(2))
                .andExpect(jsonPath("$.duplicateTranscript").value(false))
                .andExpect(jsonPath("$.logDate").value("2026-06-14"));

        // The transcript is trimmed before it reaches the service; the fingerprint the
        // idempotency guard builds depends on that exact string.
        verify(transcriptParsingService).parseTranscriptAndLogMeals(USER_ID, LOG_DATE, "I had two eggs");
    }

    @Test
    void answers503WhenARetryableProviderFailureIsAnywhereInTheCauseChain() throws Exception {
        signedIn();
        when(transcriptParsingService.parseTranscriptAndLogMeals(USER_ID, LOG_DATE, "I had two eggs"))
                .thenThrow(new VoiceTranscriptProcessingException(
                        "Failed to parse meals from conversation: 503 overloaded",
                        new AiProviderException("gemini", "Model overloaded", "{}", 503, true)));

        mockMvc.perform(post("/food/voice-log/parse-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"I had two eggs\",\"logDate\":\"2026-06-14\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error")
                        .value("AI service is temporarily busy. Please try again in a few seconds."));
    }

    /**
     * Load-bearing ordering, constructed so both branches could claim the response: a
     * {@code ResponseStatusException} whose cause chain holds a retryable provider failure
     * must still answer 503, not the exception's own 404. The client backs off and retries on
     * 503 only — flipping the two checks would turn a transient outage into a permanent
     * "user not found" on the voice screen.
     */
    @Test
    void prefersThe503OverTheStatusOfAResponseStatusExceptionWithARetryableCause() throws Exception {
        signedIn();
        when(transcriptParsingService.parseTranscriptAndLogMeals(USER_ID, LOG_DATE, "I had two eggs"))
                .thenThrow(new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "User not found: user-42",
                        new AiProviderException("gemini", "Model overloaded", "{}", 503, true)));

        mockMvc.perform(post("/food/voice-log/parse-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"I had two eggs\",\"logDate\":\"2026-06-14\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error")
                        .value("AI service is temporarily busy. Please try again in a few seconds."));
    }

    /**
     * The status and reason the service already decided on reach the client, and in this
     * endpoint's own {@code {error: ...}} shape rather than the uniform error envelope — the
     * voice screen renders that string verbatim, so the absence of {@code timestamp} here is
     * part of the contract, not an oversight.
     */
    @Test
    void passesThroughTheStatusAndReasonOfAResponseStatusException() throws Exception {
        signedIn();
        when(transcriptParsingService.parseTranscriptAndLogMeals(USER_ID, LOG_DATE, "I had two eggs"))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: user-42"));

        mockMvc.perform(post("/food/voice-log/parse-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"I had two eggs\",\"logDate\":\"2026-06-14\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("User not found: user-42"))
                .andExpect(jsonPath("$.timestamp").doesNotExist());
    }

    /** A provider failure that the provider itself called permanent is not worth retrying, so
     * it lands on the generic 500 rather than the 503 backoff path. */
    @Test
    void answers500WhenTheProviderFailureIsNotRetryable() throws Exception {
        signedIn();
        when(transcriptParsingService.parseTranscriptAndLogMeals(USER_ID, LOG_DATE, "I had two eggs"))
                .thenThrow(new AiProviderException("gemini", "Invalid API key", "{}", 401, false));

        mockMvc.perform(post("/food/voice-log/parse-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"I had two eggs\",\"logDate\":\"2026-06-14\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Failed to process meals from conversation"));
    }

    @Test
    void answers500WithTheGenericCopyForAnyOtherParseFailure() throws Exception {
        signedIn();
        when(transcriptParsingService.parseTranscriptAndLogMeals(USER_ID, LOG_DATE, "I had two eggs"))
                .thenThrow(new RuntimeException("mongo unavailable"));

        mockMvc.perform(post("/food/voice-log/parse-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"I had two eggs\",\"logDate\":\"2026-06-14\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Failed to process meals from conversation"));
    }

    // ---------------------------------------- POST /food/voice-log/interpret-transcript

    @Test
    void answers401WithAnEmptyBodyForAnAnonymousInterpretRequest() throws Exception {
        anonymous();

        mockMvc.perform(post("/food/voice-log/interpret-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"Call me back later\",\"mealSlotId\":\"slot-lunch\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));

        verifyNoInteractions(transcriptInterpreter);
    }

    /**
     * Pins a real inconsistency rather than endorsing it: the same "Transcript is required"
     * rejection that parse-transcript returns as {@code {"error": ...}} is thrown here as a
     * {@code ResponseStatusException}, so it comes back in the {@code GlobalExceptionHandler}
     * envelope — the message lives under {@code message} and {@code error} holds the reason
     * phrase. Two endpoints, two error shapes.
     */
    @Test
    void answers400InTheUniformErrorShapeForABlankInterpretTranscript() throws Exception {
        signedIn();

        mockMvc.perform(post("/food/voice-log/interpret-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"   \",\"mealSlotId\":\"slot-lunch\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Transcript is required"));

        verifyNoInteractions(transcriptInterpreter);
    }

    @Test
    void returnsTheInterpretationOfTheTranscript() throws Exception {
        signedIn();
        MealTranscriptInterpretResponseDTO interpretation = new MealTranscriptInterpretResponseDTO();
        interpretation.setShouldLogMeals(false);
        interpretation.setRescheduleMinutes(30);
        interpretation.setRationale("classified_by_ai");
        when(transcriptInterpreter.interpretMealTranscript("Call me back in half an hour", "slot-lunch"))
                .thenReturn(interpretation);

        mockMvc.perform(post("/food/voice-log/interpret-transcript")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transcript\":\"  Call me back in half an hour  \",\"mealSlotId\":\"slot-lunch\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shouldLogMeals").value(false))
                .andExpect(jsonPath("$.rescheduleMinutes").value(30))
                .andExpect(jsonPath("$.rationale").value("classified_by_ai"));

        verify(transcriptInterpreter).interpretMealTranscript("Call me back in half an hour", "slot-lunch");
    }
}
