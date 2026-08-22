package com.habitbuilder.NutritionTracker.modules.auth.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.*;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.auth.service.AuthService;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.dto.AuthRequest;
import com.habitbuilder.NutritionTracker.modules.auth.dto.LoginResponse;
import com.habitbuilder.NutritionTracker.security.jwt.JwtTokenProvider;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService service;
    private final JwtTokenProvider jwtTokenProvider;
    private final CurrentUserProvider currentUserProvider;

    public AuthController(AuthService service,
            JwtTokenProvider jwtTokenProvider,
            CurrentUserProvider currentUserProvider) {
        this.service = service;
        this.jwtTokenProvider = jwtTokenProvider;
        this.currentUserProvider = currentUserProvider;
    }

    /** Age in years derived from DOB (with legacy-age fallback), as a String, or null. */
    private static String ageString(User user) {
        Integer age = user.getDerivedAge();
        return age != null ? String.valueOf(age) : null;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthRequest request) {
        try {
            service.register(request.getEmail(), request.getPassword(), request.getName(), request.getDob(),
                    request.getGender());
            return ResponseEntity.ok(Map.of("message", "User registered"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        try {
            User user = service.login(request.getEmail(), request.getPassword());
            String token = jwtTokenProvider.generateToken(user.getEmail());
            return ResponseEntity.ok(new LoginResponse(user.getId(), user.getName(), user.getEmail(), ageString(user),
                    user.getDob(), user.getGender(), token));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid email or password"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Token probe on a {@code permitAll} path: an anonymous caller gets
     * {@code {valid: false}} rather than an error, because the client uses this to decide
     * whether a stored token is still good.
     */
    @GetMapping("/me")
    public ResponseEntity<?> validateToken() {
        try {
            return currentUserProvider.findCurrentUser()
                    .<ResponseEntity<?>>map(user -> {
                        // HashMap (not Map.of) because age/dob may be null for some accounts.
                        Map<String, Object> me = new HashMap<>();
                        me.put("id", user.getId());
                        me.put("name", user.getName());
                        me.put("email", user.getEmail());
                        me.put("age", ageString(user));
                        me.put("dob", user.getDob());
                        me.put("gender", user.getGender());
                        return ResponseEntity.ok(me);
                    })
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("valid", false)));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("valid", false));
        }
    }
    
}
