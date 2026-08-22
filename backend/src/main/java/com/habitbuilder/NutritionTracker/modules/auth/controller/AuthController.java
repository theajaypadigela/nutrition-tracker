package com.habitbuilder.NutritionTracker.modules.auth.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.habitbuilder.NutritionTracker.modules.auth.service.AuthService;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.dto.AuthRequest;
import com.habitbuilder.NutritionTracker.modules.auth.dto.LoginResponse;
import com.habitbuilder.NutritionTracker.security.jwt.JwtTokenProvider;
import com.habitbuilder.NutritionTracker.security.AuthenticatedUserProvider;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService service;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public AuthController(AuthService service, JwtTokenProvider jwtTokenProvider,
            AuthenticatedUserProvider authenticatedUserProvider) {
        this.service = service;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(
            @RequestBody @Validated(AuthRequest.Registration.class) AuthRequest request) {
        service.register(request.getEmail(), request.getPassword(), request.getName(), request.getAge(),
                request.getGender(), request.getTimezone());
        return ResponseEntity.ok(Map.of("message", "User registered"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Validated(AuthRequest.Login.class) AuthRequest request) {
        User user = service.login(request.getEmail(), request.getPassword());
        String token = jwtTokenProvider.generateToken(user.getEmail());
        return ResponseEntity.ok(new LoginResponse(user.getId(), user.getName(), user.getEmail(), user.getAge(),
                user.getGender(), user.getTimezone(), token));
    }

    @GetMapping("/me")
    public ResponseEntity<?> validateToken() {
        User user = authenticatedUserProvider.getAuthenticatedUser();
        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "age", user.getAge(),
                "gender", user.getGender(),
                "timezone", user.getTimezone()));
    }
    
}
