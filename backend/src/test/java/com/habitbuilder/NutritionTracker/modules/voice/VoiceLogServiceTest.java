package com.habitbuilder.NutritionTracker.modules.voice;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.modules.auth.service.UserTimeZone;
import com.habitbuilder.NutritionTracker.modules.food.FoodService;
import com.habitbuilder.NutritionTracker.modules.nutrition.GeminiService;

@ExtendWith(MockitoExtension.class)
class VoiceLogServiceTest {

    @Mock private FoodService foodService;
    @Mock private UserRepository userRepository;
    @Mock private VoiceMealSessionRepository sessionRepository;
    @Mock private GeminiService geminiService;
    @Mock private VapiClient vapiClient;
    @Mock private UserTimeZone userTimeZone;

    private VoiceLogService service;

    @BeforeEach
    void setUp() {
        service = new VoiceLogService(
                foodService,
                userRepository,
                sessionRepository,
                new ObjectMapper(),
                geminiService,
                vapiClient,
                userTimeZone);
    }

    @Test
    void unmintedProviderCallCannotWriteForABodySuppliedUser() {
        when(sessionRepository.findByProviderCallId("attacker-call")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.processVoiceMealLog(
                mealParameters(), List.of(), "attacker-call", Map.of("userId", "42")))
                .isInstanceOf(SecurityException.class);

        verifyNoInteractions(foodService);
    }

    @Test
    void userClaimMustMatchThePersistedMintedCallSession() {
        User owner = new User();
        owner.setId(41L);
        VoiceMealSession session = new VoiceMealSession();
        session.setUser(owner);
        session.setProviderCallId("minted-call");
        when(sessionRepository.findByProviderCallId("minted-call")).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.processVoiceMealLog(
                mealParameters(), List.of(), "minted-call", Map.of("userId", "42")))
                .isInstanceOf(SecurityException.class);

        verifyNoInteractions(foodService);
    }

    private Map<String, Object> mealParameters() {
        return Map.of(
                "date", "2026-08-22",
                "meals", Map.of("breakfast", List.of(Map.of(
                        "foodName", "Oats",
                        "quantity", 1,
                        "unit", "bowl"))));
    }
}
