package com.habitbuilder.NutritionTracker.modules.notification.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.habitbuilder.NutritionTracker.modules.notification.dto.IosVoipTokenRequest;
import com.habitbuilder.NutritionTracker.modules.notification.service.IosVoipTokenService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/notifications/ios/voip-token")
public class IosVoipTokenController {

    private final IosVoipTokenService tokenService;

    public IosVoipTokenController(IosVoipTokenService tokenService) {
        this.tokenService = tokenService;
    }

    @PostMapping
    public ResponseEntity<Void> register(@Valid @RequestBody IosVoipTokenRequest request) {
        tokenService.register(request.token());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@Valid @RequestBody IosVoipTokenRequest request) {
        tokenService.deleteForCurrentUser(request.token());
        return ResponseEntity.noContent().build();
    }
}
