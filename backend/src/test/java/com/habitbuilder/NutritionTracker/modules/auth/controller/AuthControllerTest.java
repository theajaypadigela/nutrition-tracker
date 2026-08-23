package com.habitbuilder.NutritionTracker.modules.auth.controller;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.Period;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.service.AuthService;
import com.habitbuilder.NutritionTracker.security.jwt.JwtTokenProvider;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(AuthController.class)
class AuthControllerTest {

    private static final String DOB = "1990-05-20";

    private static final String REGISTRATION_JSON =
            "{\"email\":\"ada@example.com\",\"password\":\"secret\",\"name\":\"Ada\","
                    + "\"dob\":\"1990-05-20\",\"gender\":\"female\"}";

    private static final String CREDENTIALS_JSON =
            "{\"email\":\"ada@example.com\",\"password\":\"secret\"}";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private CurrentUserProvider currentUserProvider;

    @Test
    void registersAUserAndAnswersWithAConfirmationMessage() throws Exception {
        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(REGISTRATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User registered"));
    }

    /**
     * Every {@code RuntimeException} out of the service becomes a 409 carrying the
     * exception's own message — the handler does not distinguish "already exists" from a
     * genuine failure. Pinned, not endorsed.
     */
    @Test
    void answers409WhenRegistrationIsRejected() throws Exception {
        doThrow(new RuntimeException("User already exists"))
                .when(authService).register("ada@example.com", "secret", "Ada", DOB, "female");

        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(REGISTRATION_JSON))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("User already exists"));
    }

    @Test
    void returnsTheProfileAndTokenOnSuccessfulLogin() throws Exception {
        when(authService.login("ada@example.com", "secret")).thenReturn(registeredUser());
        when(jwtTokenProvider.generateToken("ada@example.com")).thenReturn("jwt-token");

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(CREDENTIALS_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u-1"))
                .andExpect(jsonPath("$.name").value("Ada"))
                .andExpect(jsonPath("$.email").value("ada@example.com"))
                // age is derived from dob at render time, so the expectation is derived too.
                .andExpect(jsonPath("$.age").value(ageDerivedFromDob()))
                .andExpect(jsonPath("$.dob").value(DOB))
                .andExpect(jsonPath("$.gender").value("female"))
                .andExpect(jsonPath("$.token").value("jwt-token"));
    }

    @Test
    void answers401WithAGenericMessageWhenTheCredentialsAreWrong() throws Exception {
        when(authService.login("ada@example.com", "secret"))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(CREDENTIALS_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    /**
     * The second catch is broader than the first: any other {@code RuntimeException} — a
     * missing user row included — also answers 401, and leaks the internal message rather
     * than the generic one above. Pinned, not endorsed.
     */
    @Test
    void answers401WithTheServiceMessageForAnyOtherLoginFailure() throws Exception {
        when(authService.login("ada@example.com", "secret"))
                .thenThrow(new RuntimeException("User not found"));

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(CREDENTIALS_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("User not found"));
    }

    @Test
    void returnsTheCurrentUserForAnAuthenticatedCaller() throws Exception {
        User user = new User();
        user.setId("u-1");
        user.setName("Ada");
        user.setEmail("ada@example.com");
        user.setGender("female");
        when(currentUserProvider.findCurrentUser()).thenReturn(Optional.of(user));

        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u-1"))
                .andExpect(jsonPath("$.name").value("Ada"))
                .andExpect(jsonPath("$.email").value("ada@example.com"))
                .andExpect(jsonPath("$.gender").value("female"))
                // A HashMap rather than Map.of precisely because of these two: an account
                // with neither dob nor legacy age still gets both keys, serialized as null.
                .andExpect(jsonPath("$.age").value(nullValue()))
                .andExpect(jsonPath("$.dob").value(nullValue()));
    }

    /**
     * {@code /auth/me} is the client's token probe on a {@code permitAll} path, so an
     * anonymous caller gets a 401 with a body it can read rather than an error page.
     */
    @Test
    void answers401WithValidFalseForAnAnonymousCaller() throws Exception {
        when(currentUserProvider.findCurrentUser()).thenReturn(Optional.empty());

        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.valid").value(false));
    }

    private static User registeredUser() {
        User user = new User();
        user.setId("u-1");
        user.setName("Ada");
        user.setEmail("ada@example.com");
        user.setDob(DOB);
        user.setGender("female");
        return user;
    }

    private static String ageDerivedFromDob() {
        return String.valueOf(Period.between(LocalDate.parse(DOB), LocalDate.now()).getYears());
    }
}
