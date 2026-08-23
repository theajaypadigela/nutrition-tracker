package com.habitbuilder.NutritionTracker.modules.auth.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.service.AuthService;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(ProfileController.class)
class ProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private CurrentUserProvider currentUserProvider;

    /** The controller reads nothing but the id off the principal. */
    private static User principal(String id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static User user(String id, String name, String email, String age, String dob, String gender) {
        User user = new User();
        user.setId(id);
        user.setName(name);
        user.setEmail(email);
        user.setAge(age);
        user.setDob(dob);
        user.setGender(gender);
        return user;
    }

    /**
     * {@code age} in the response is derived, not stored. This account predates DOB capture, so
     * the derivation falls back to the legacy numeric field and {@code dob} serialises as null —
     * which keeps the expectation stable, unlike an age computed from a date of birth.
     */
    @Test
    void returnsTheProfileOfTheAuthenticatedUser() throws Exception {
        when(currentUserProvider.findCurrentUser()).thenReturn(Optional.of(principal("u-1")));
        when(authService.getUserById("u-1"))
                .thenReturn(user("u-1", "Ada Lovelace", "ada@example.com", "31", null, "female"));

        mockMvc.perform(get("/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u-1"))
                .andExpect(jsonPath("$.name").value("Ada Lovelace"))
                .andExpect(jsonPath("$.email").value("ada@example.com"))
                .andExpect(jsonPath("$.age").value("31"))
                .andExpect(jsonPath("$.dob").isEmpty())
                .andExpect(jsonPath("$.gender").value("female"));
    }

    @Test
    void answers401WhenTheProfileIsRequestedAnonymously() throws Exception {
        when(currentUserProvider.findCurrentUser()).thenReturn(Optional.empty());

        mockMvc.perform(get("/profile"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("User not authenticated"));

        verifyNoInteractions(authService);
    }

    /**
     * Pins current behaviour, not desirable behaviour: this handler catches {@code Exception}
     * itself, so the failure never reaches {@code GlobalExceptionHandler}. The body is the
     * controller's own {@code {message}} shape carrying the raw exception text, rather than the
     * {@code {timestamp, status, error, message}} envelope with its scrubbed
     * "An unexpected error occurred". Recorded, not fixed — C1.
     */
    @Test
    void answers500WithTheRawExceptionMessageWhenTheLookupFails() throws Exception {
        when(currentUserProvider.findCurrentUser()).thenReturn(Optional.of(principal("u-1")));
        when(authService.getUserById("u-1")).thenThrow(new RuntimeException("User not found"));

        mockMvc.perform(get("/profile"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("User not found"))
                .andExpect(jsonPath("$.timestamp").doesNotExist());
    }

    @Test
    void updatesTheProfileAndReturnsTheStoredUser() throws Exception {
        when(currentUserProvider.findCurrentUser()).thenReturn(Optional.of(principal("u-1")));
        when(authService.updateProfile(any(), any(), any(), any(), any()))
                .thenReturn(user("u-1", "Ada King", "ada@example.com", null, "1990-05-20", "female"));

        mockMvc.perform(put("/profile")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Ada King","age":"31","dob":"1990-05-20","gender":"female"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u-1"))
                .andExpect(jsonPath("$.name").value("Ada King"))
                .andExpect(jsonPath("$.email").value("ada@example.com"))
                // Only presence: with a DOB stored, the derived age moves with the calendar.
                .andExpect(jsonPath("$.age").exists())
                .andExpect(jsonPath("$.dob").value("1990-05-20"))
                .andExpect(jsonPath("$.gender").value("female"));

        // The id is taken from the security context, never from the request body; the other four
        // arguments are the body's fields, unvalidated and in this order.
        verify(authService).updateProfile("u-1", "Ada King", "31", "1990-05-20", "female");
    }

    @Test
    void answers401WhenTheUpdateIsAnonymous() throws Exception {
        when(currentUserProvider.findCurrentUser()).thenReturn(Optional.empty());

        mockMvc.perform(put("/profile")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Ada King","age":"31","dob":"1990-05-20","gender":"female"}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("User not authenticated"));

        verifyNoInteractions(authService);
    }
}
