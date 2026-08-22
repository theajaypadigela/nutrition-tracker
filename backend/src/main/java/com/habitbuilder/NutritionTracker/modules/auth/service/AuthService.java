package com.habitbuilder.NutritionTracker.modules.auth.service;

import java.time.DateTimeException;
import java.time.ZoneId;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.security.jwt.JwtTokenProvider;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtTokenProvider jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
    }

    public void register(String email, String password, String name, String age, String gender, String timezone) {
        if (userRepository.existsByEmail(email)) {
            throw new UserAlreadyExistsException();
        }

        User user = new User(); 
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setName(name);
        user.setAge(age);
        user.setGender(gender);
        user.setTimezone(normalizeTimezone(timezone, true));
        user.setRole("USER");

        userRepository.save(user);
    }

    public User login(String email, String password) {

        UsernamePasswordAuthenticationToken token = new UsernamePasswordAuthenticationToken(email, password);

        authenticationManager.authenticate(token);

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public User updateProfile(Long userId, String name, String age, String gender, String timezone) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        if (name != null && !name.trim().isEmpty()) {
            user.setName(name);
        }
        if (age != null && !age.trim().isEmpty()) {
            user.setAge(age);
        }
        if (gender != null && !gender.trim().isEmpty()) {
            user.setGender(gender);
        }
        if (timezone != null && !timezone.isBlank()) {
            user.setTimezone(normalizeTimezone(timezone, false));
        }
        
        return userRepository.save(user);
    }

    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private String normalizeTimezone(String timezone, boolean useDefaultWhenBlank) {
        if (timezone == null || timezone.isBlank()) {
            if (useDefaultWhenBlank) {
                return "UTC";
            }
            throw new IllegalArgumentException("Timezone is required");
        }
        try {
            return ZoneId.of(timezone.trim()).getId();
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("Timezone must be a valid IANA zone", exception);
        }
    }
}
