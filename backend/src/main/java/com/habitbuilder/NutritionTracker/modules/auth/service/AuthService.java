package com.habitbuilder.NutritionTracker.modules.auth.service;

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

    public void register(String email, String password, String name, String dob, String gender) {
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("User already exists");
        }

        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setName(name);
        user.setDob(dob);
        user.setGender(gender);
        user.setRole("USER");

        userRepository.save(user);
    }

    public User login(String email, String password) {

        UsernamePasswordAuthenticationToken token = new UsernamePasswordAuthenticationToken(email, password);

        authenticationManager.authenticate(token);

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public User updateProfile(String userId, String name, String age, String dob, String gender) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (name != null && !name.trim().isEmpty()) {
            user.setName(name);
        }
        if (age != null && !age.trim().isEmpty()) {
            user.setAge(age);
        }
        if (dob != null && !dob.trim().isEmpty()) {
            user.setDob(dob);
        }
        if (gender != null && !gender.trim().isEmpty()) {
            user.setGender(gender);
        }

        return userRepository.save(user);
    }

    public User getUserById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
