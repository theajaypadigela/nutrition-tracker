package com.habitbuilder.NutritionTracker.modules.auth.controller;

import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.auth.dto.ProfileResponse;
import com.habitbuilder.NutritionTracker.modules.auth.dto.UpdateProfileRequest;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.service.AuthService;

import java.util.Map;

@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final AuthService authService;
    private final CurrentUserProvider currentUserProvider;

    public ProfileController(AuthService authService, CurrentUserProvider currentUserProvider) {
        this.authService = authService;
        this.currentUserProvider = currentUserProvider;
    }

    /** Age in years derived from DOB (with legacy-age fallback), as a String, or null. */
    private static String ageString(User user) {
        Integer age = user.getDerivedAge();
        return age != null ? String.valueOf(age) : null;
    }

    private static ProfileResponse toResponse(User user) {
        return new ProfileResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                ageString(user),
                user.getDob(),
                user.getGender());
    }

    @GetMapping
    public ResponseEntity<?> getProfile() {
        try {
            Optional<User> authenticated = currentUserProvider.findCurrentUser();
            if (authenticated.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "User not authenticated"));
            }

            User currentUser = authService.getUserById(authenticated.get().getId());
            return ResponseEntity.ok(toResponse(currentUser));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping
    public ResponseEntity<?> updateProfile(@RequestBody UpdateProfileRequest request) {
        try {
            Optional<User> authenticated = currentUserProvider.findCurrentUser();
            if (authenticated.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "User not authenticated"));
            }

            User updatedUser = authService.updateProfile(
                    authenticated.get().getId(),
                    request.getName(),
                    request.getAge(),
                    request.getDob(),
                    request.getGender());

            return ResponseEntity.ok(toResponse(updatedUser));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
