package com.habitbuilder.NutritionTracker.modules.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.habitbuilder.NutritionTracker.modules.auth.dto.ProfileResponse;
import com.habitbuilder.NutritionTracker.modules.auth.dto.UpdateProfileRequest;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.service.AuthService;
import com.habitbuilder.NutritionTracker.security.AuthenticatedUserProvider;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final AuthService authService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public ProfileController(AuthService authService, AuthenticatedUserProvider authenticatedUserProvider) {
        this.authService = authService;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @GetMapping
    public ResponseEntity<?> getProfile() {
        User user = authenticatedUserProvider.getAuthenticatedUser();
        User currentUser = authService.getUserById(user.getId());

        return ResponseEntity.ok(toResponse(currentUser));
    }

    @PutMapping
    public ResponseEntity<?> updateProfile(@RequestBody @Valid UpdateProfileRequest request) {
        User user = authenticatedUserProvider.getAuthenticatedUser();
        User updatedUser = authService.updateProfile(
                user.getId(),
                request.getName(),
                request.getAge(),
                request.getGender(),
                request.getTimezone());

        return ResponseEntity.ok(toResponse(updatedUser));
    }

    private ProfileResponse toResponse(User user) {
        return new ProfileResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getAge(),
                user.getGender(),
                user.getTimezone());
    }
}
