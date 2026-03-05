package com.habitbuilder.NutritionTracker.modules.auth.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import com.habitbuilder.NutritionTracker.modules.auth.dto.ProfileResponse;
import com.habitbuilder.NutritionTracker.modules.auth.dto.UpdateProfileRequest;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.service.AuthService;

import java.util.Map;

@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final AuthService authService;

    public ProfileController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping
    public ResponseEntity<?> getProfile() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated() && authentication.getPrincipal() instanceof User) {
                User user = (User) authentication.getPrincipal();
                User currentUser = authService.getUserById(user.getId());
                
                ProfileResponse response = new ProfileResponse(
                    currentUser.getId(),
                    currentUser.getName(),
                    currentUser.getEmail(),
                    currentUser.getAge(),
                    currentUser.getGender()
                );
                
                return ResponseEntity.ok(response);
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "User not authenticated"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping
    public ResponseEntity<?> updateProfile(@RequestBody UpdateProfileRequest request) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated() && authentication.getPrincipal() instanceof User) {
                User user = (User) authentication.getPrincipal();
                
                User updatedUser = authService.updateProfile(
                    user.getId(),
                    request.getName(),
                    request.getAge(),
                    request.getGender()
                );
                
                ProfileResponse response = new ProfileResponse(
                    updatedUser.getId(),
                    updatedUser.getName(),
                    updatedUser.getEmail(),
                    updatedUser.getAge(),
                    updatedUser.getGender()
                );
                
                return ResponseEntity.ok(response);
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "User not authenticated"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
