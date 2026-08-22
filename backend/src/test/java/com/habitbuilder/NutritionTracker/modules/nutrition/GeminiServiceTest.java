package com.habitbuilder.NutritionTracker.modules.nutrition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.ObjectMapper;

class GeminiServiceTest {

    private final GeminiService service = new GeminiService(
            WebClient.builder(),
            new ObjectMapper(),
            "https://provider.example/v1",
            "test-token",
            "test-model");

    @Test
    void noNumericNutrientsIsAParseFailure() {
        String response = envelope("{\"calories\":\"unknown\",\"proteinG\":null}");

        assertThatThrownBy(() -> service.parseNutritionResponse(response))
                .isInstanceOf(NutritionParseException.class)
                .hasMessageContaining("no numeric nutrient values");
    }

    @Test
    void explicitNumericZerosRemainAValidNutritionResult() {
        NutritionResponse response = service.parseNutritionResponse(envelope("""
                {"calories":0,"proteinG":0,"carbsG":0,"fatsG":0,"fiberG":0,"sugarG":0,"sodiumMg":0}
                """));

        assertThat(response.getCalories()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(response.hasAnyNumericValue()).isTrue();
        assertThat(response.hasAnyNonZeroValue()).isFalse();
        assertThat(response.isCacheable()).isFalse();
    }

    private String envelope(String content) {
        try {
            return new ObjectMapper().writeValueAsString(java.util.Map.of(
                    "choices", java.util.List.of(java.util.Map.of(
                            "message", java.util.Map.of("content", content)))));
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new AssertionError(exception);
        }
    }
}
