package com.habitbuilder.NutritionTracker.modules.auth.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.habitbuilder.NutritionTracker.common.api.GlobalExceptionHandler;
import com.habitbuilder.NutritionTracker.modules.auth.service.AuthService;
import com.habitbuilder.NutritionTracker.modules.auth.service.UserAlreadyExistsException;
import com.habitbuilder.NutritionTracker.security.AuthenticatedUserProvider;
import com.habitbuilder.NutritionTracker.security.jwt.JwtTokenProvider;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock private AuthService authService;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private AuthenticatedUserProvider authenticatedUserProvider;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new AuthController(authService, jwtTokenProvider, authenticatedUserProvider))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void registrationConflictUsesSanitizedCommonErrorModel() throws Exception {
        doThrow(new UserAlreadyExistsException()).when(authService)
                .register(any(), any(), any(), any(), any(), any());

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRegistration()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("ACCOUNT_EXISTS"))
                .andExpect(jsonPath("$.message")
                        .value("An account with this email already exists"));
    }

    @Test
    void invalidRegistrationIsRejectedBeforeTheService() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"not-an-email","password":"weak","name":"","age":"","gender":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verifyNoInteractions(authService);
    }

    private String validRegistration() {
        return """
                {
                  "email":"person@example.com",
                  "password":"healthy123",
                  "name":"Person",
                  "age":"30",
                  "gender":"unspecified",
                  "timezone":"Asia/Kolkata"
                }
                """;
    }
}
