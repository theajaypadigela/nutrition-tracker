package com.habitbuilder.NutritionTracker.modules.notification.controller;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.modules.notification.service.IosVoipTokenService;
import com.habitbuilder.NutritionTracker.modules.notification.dto.IosVoipTokenRequest;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(IosVoipTokenController.class)
class IosVoipTokenControllerTest {

    private static final String TOKEN = "aa".repeat(32);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private IosVoipTokenService tokenService;

    @Test
    void registersTheAuthenticatedInstallationsPushKitToken() throws Exception {
        mockMvc.perform(post("/notifications/ios/voip-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + TOKEN + "\"}"))
                .andExpect(status().isNoContent());

        verify(tokenService).register(TOKEN);
    }

    @Test
    void rejectsRegistrationWhenRemoteDeliveryIsUnavailable() throws Exception {
        doThrow(new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "iOS VoIP delivery is unavailable"))
                .when(tokenService).register(TOKEN);

        mockMvc.perform(post("/notifications/ios/voip-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + TOKEN + "\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("iOS VoIP delivery is unavailable"));
    }

    @Test
    void validatesTheRegistrationBody() throws Exception {
        mockMvc.perform(post("/notifications/ios/voip-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("token is required"));
    }

    @Test
    void deletesOnlyTheAuthenticatedInstallationsToken() throws Exception {
        mockMvc.perform(delete("/notifications/ios/voip-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + TOKEN + "\"}"))
                .andExpect(status().isNoContent());

        verify(tokenService).deleteForCurrentUser(TOKEN);
    }

    @Test
    void requestDiagnosticsNeverRenderTheToken() {
        assertEquals(
                "IosVoipTokenRequest[token=***]",
                new IosVoipTokenRequest(TOKEN).toString());
    }
}
