package com.habitbuilder.NutritionTracker.modules.voice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.habitbuilder.NutritionTracker.modules.voice.dto.VapiWebhookRequest;

@ExtendWith(MockitoExtension.class)
class VoiceLogControllerWebhookContractTest {

    private static final String CONFIGURED_SECRET = "configured-secret";
    private static final String ACKNOWLEDGEMENT = """
            {"result":"logged"}
            """;
    private static final String IGNORED_EVENT = """
            {
              "message": {
                "type": "end-of-call-report"
              }
            }
            """;
    private static final String SUBMIT_MEAL_LOG = """
            {
              "call": {
                "id": "call-123",
                "metadata": {"userId": "42"},
                "transcript": [{
                  "role": "user",
                  "message": "I had oats for breakfast",
                  "time": 1.25
                }]
              },
              "message": {
                "type": "function-call",
                "functionCall": {
                  "name": "submit_meal_log",
                  "parameters": {
                    "date": "2026-08-19",
                    "meals": {
                      "breakfast": [{
                        "foodName": "Oats",
                        "quantity": 1.0,
                        "unit": "bowl"
                      }]
                    }
                  }
                }
              }
            }
            """;

    @Mock
    private VoiceLogService voiceLogService;

    @Captor
    private ArgumentCaptor<Map<String, Object>> parametersCaptor;
    @Captor
    private ArgumentCaptor<List<VapiWebhookRequest.TranscriptEntry>> transcriptCaptor;
    @Captor
    private ArgumentCaptor<String> callIdCaptor;
    @Captor
    private ArgumentCaptor<Map<String, Object>> metadataCaptor;

    @Test
    void configuredSecretRejectsAMissingHeaderWithAnEmpty401() throws Exception {
        mockMvc(CONFIGURED_SECRET)
                .perform(post("/food/voice-log")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SUBMIT_MEAL_LOG))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));

        verifyNoInteractions(voiceLogService);
    }

    @Test
    void configuredSecretRejectsAWrongHeaderWithAnEmpty401() throws Exception {
        mockMvc(CONFIGURED_SECRET)
                .perform(post("/food/voice-log")
                        .header("X-Vapi-Secret", "wrong-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SUBMIT_MEAL_LOG))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));

        verifyNoInteractions(voiceLogService);
    }

    @Test
    void matchingSecretProcessesSubmitMealLogAndReturnsTheExistingAcknowledgement() throws Exception {
        mockMvc(CONFIGURED_SECRET)
                .perform(post("/food/voice-log")
                        .header("X-Vapi-Secret", CONFIGURED_SECRET)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SUBMIT_MEAL_LOG))
                .andExpect(status().isOk())
                .andExpect(content().json(ACKNOWLEDGEMENT, JsonCompareMode.STRICT));

        verify(voiceLogService).processVoiceMealLog(
                parametersCaptor.capture(),
                transcriptCaptor.capture(),
                callIdCaptor.capture(),
                metadataCaptor.capture());
        assertThat(parametersCaptor.getValue())
                .containsEntry("date", "2026-08-19")
                .containsKey("meals");
        assertThat(transcriptCaptor.getValue()).singleElement().satisfies(entry -> {
            assertThat(entry.getRole()).isEqualTo("user");
            assertThat(entry.getMessage()).isEqualTo("I had oats for breakfast");
            assertThat(entry.getTime()).isEqualTo(1.25);
        });
        assertThat(callIdCaptor.getValue()).isEqualTo("call-123");
        assertThat(metadataCaptor.getValue()).containsEntry("userId", "42");
    }

    @Test
    void emptyConfiguredSecretRejectsARequestWithoutAHeader() throws Exception {
        mockMvc("")
                .perform(post("/food/voice-log")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SUBMIT_MEAL_LOG))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));

        verifyNoInteractions(voiceLogService);
    }

    @Test
    void ignoredEventReturnsLoggedWithoutCallingTheApplicationService() throws Exception {
        mockMvc(CONFIGURED_SECRET)
                .perform(post("/food/voice-log")
                        .header("X-Vapi-Secret", CONFIGURED_SECRET)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(IGNORED_EVENT))
                .andExpect(status().isOk())
                .andExpect(content().json(ACKNOWLEDGEMENT, JsonCompareMode.STRICT));

        verifyNoInteractions(voiceLogService);
    }

    @Test
    void applicationProcessingExceptionStillReturnsLogged() throws Exception {
        doThrow(new IllegalStateException("application failure"))
                .when(voiceLogService)
                .processVoiceMealLog(anyMap(), anyList(), anyString(), anyMap());

        mockMvc(CONFIGURED_SECRET)
                .perform(post("/food/voice-log")
                        .header("X-Vapi-Secret", CONFIGURED_SECRET)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SUBMIT_MEAL_LOG))
                .andExpect(status().isOk())
                .andExpect(content().json(ACKNOWLEDGEMENT, JsonCompareMode.STRICT));

        verify(voiceLogService).processVoiceMealLog(anyMap(), anyList(), anyString(), anyMap());
    }

    @Test
    void rejectsCallsAboveTheConfiguredMealLimitWithoutInvokingTheService() throws Exception {
        mockMvc(CONFIGURED_SECRET, 1)
                .perform(post("/food/voice-log")
                        .header("X-Vapi-Secret", CONFIGURED_SECRET)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "call":{"id":"call-123","metadata":{"userId":"42"}},
                                  "message":{"type":"function-call","functionCall":{
                                    "name":"submit_meal_log",
                                    "parameters":{"date":"2026-08-22","meals":{"breakfast":[
                                      {"foodName":"Oats","quantity":1,"unit":"bowl"},
                                      {"foodName":"Milk","quantity":1,"unit":"cup"}
                                    ]}}
                                  }}
                                }
                                """))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(content().json("""
                        {"status":413,"code":"TOO_MANY_MEALS","message":"Webhook meal count exceeds the configured limit"}
                        """, JsonCompareMode.STRICT));

        verifyNoInteractions(voiceLogService);
    }

    private MockMvc mockMvc(String configuredSecret) {
        return mockMvc(configuredSecret, 20);
    }

    private MockMvc mockMvc(String configuredSecret, int maxMeals) {
        VoiceLogController controller = new VoiceLogController(
                voiceLogService,
                new VapiWebhookSecretPolicy(configuredSecret),
                maxMeals);
        return MockMvcBuilders.standaloneSetup(controller).build();
    }
}
