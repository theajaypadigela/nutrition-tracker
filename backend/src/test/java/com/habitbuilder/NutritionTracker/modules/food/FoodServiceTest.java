package com.habitbuilder.NutritionTracker.modules.food;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.nutrition.GeminiService;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionDetails;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionEnrichmentService;
import com.habitbuilder.NutritionTracker.security.AuthenticatedUserProvider;

@ExtendWith(MockitoExtension.class)
class FoodServiceTest {

    @Mock
    private FoodLogRepository foodLogRepository;
    @Mock
    private FoodEntryRepository foodEntryRepository;
    @Mock
    private NutritionEnrichmentService nutritionEnrichmentService;
    @Mock
    private GeminiService geminiService;
    @Mock
    private UserNutrientPreferenceRepository preferenceRepository;
    @Mock
    private AuthenticatedUserProvider authenticatedUserProvider;

    private FoodService foodService;

    @BeforeEach
    void setUp() {
        foodService = new FoodService(
                foodLogRepository,
                foodEntryRepository,
                nutritionEnrichmentService,
                geminiService,
                new ObjectMapper(),
                preferenceRepository,
                authenticatedUserProvider,
                Clock.fixed(Instant.parse("2026-08-19T12:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void getDayLogUsesAuthenticatedUserAndPreservesMappingAndTotals() {
        authenticateAs(41L);
        LocalDate date = LocalDate.of(2026, 8, 19);
        FoodLog log = foodLog(41L, date);
        FoodEntry breakfast = foodEntry(
                "66f7a012-e87d-48f0-9062-c8c42292c209",
                log,
                "breakfast",
                "Eggs",
                2.0,
                "piece",
                nutrition("100.0", "10.0", null, "5.0", "1.0", null, "80.0"));
        FoodEntry lunch = foodEntry(
                "8c63079c-da62-4e99-a184-36d658447546",
                log,
                "lunch",
                "Rice",
                1.5,
                "bowl",
                nutrition("250.5", "20.5", "30.0", null, "4.0", "8.0", null));
        log.setEntries(List.of(breakfast, lunch));
        when(foodLogRepository.findByUserIdAndLogDate(41L, date)).thenReturn(Optional.of(log));

        MealsResponse response = foodService.getDayLogAsMeals(date);

        verify(foodLogRepository).findByUserIdAndLogDate(41L, date);
        assertThat(response.getMeals()).containsOnlyKeys("breakfast", "lunch");
        assertThat(response.getMeals().get("breakfast")).singleElement().satisfies(item -> {
            assertThat(item.getId()).isEqualTo("66f7a012-e87d-48f0-9062-c8c42292c209");
            assertThat(item.getName()).isEqualTo("Eggs");
            assertThat(item.getQuantity()).isEqualTo("2.0");
            assertThat(item.getServingSize()).isEqualTo("piece");
            assertThat(item.getCarbs()).isNull();
            assertThat(item.getSugar()).isNull();
        });
        assertThat(response.getTotals())
                .isEqualTo(new NutritionTotals(350.5, 30.5, 30.0, 5.0, 5.0, 8.0, 80.0));
    }

    @Test
    void getDayLogDoesNotFallBackToAnotherUsersLog() {
        authenticateAs(41L);
        LocalDate date = LocalDate.of(2026, 8, 19);
        when(foodLogRepository.findByUserIdAndLogDate(41L, date)).thenReturn(Optional.empty());

        MealsResponse response = foodService.getDayLogAsMeals(date);

        verify(foodLogRepository).findByUserIdAndLogDate(41L, date);
        verify(foodLogRepository, never()).findByUserIdAndLogDate(99L, date);
        assertThat(response.getMeals()).isEmpty();
        assertThat(response.getTotals())
                .isEqualTo(new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0));
    }

    @Test
    void getDayLogRequiresAUserPrincipal() {
        LocalDate date = LocalDate.of(2026, 8, 19);
        when(authenticatedUserProvider.getAuthenticatedUser())
                .thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated"));

        assertThatThrownBy(() -> foodService.getDayLogAsMeals(date))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
        verifyNoInteractions(foodLogRepository);
    }

    @Test
    void updateRejectsAnEntryOwnedByAnotherUser() {
        authenticateAs(41L);
        LocalDate date = LocalDate.of(2026, 8, 19);
        FoodLog otherUsersLog = foodLog(99L, date);
        FoodEntry entry = foodEntry(
                "b68196bb-ee07-4bc3-b91f-60fef0cb2467",
                otherUsersLog,
                "dinner",
                "Soup",
                1.0,
                "bowl",
                null);
        UUID entryId = entry.getId();
        UpdateFoodEntryRequest request = new UpdateFoodEntryRequest();
        request.setName("Updated soup");
        when(foodEntryRepository.findById(entryId)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> foodService.updateEntry(date, entryId, request))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(foodEntryRepository, never()).save(any(FoodEntry.class));
    }

    @Test
    void deleteRejectsAnEntryOwnedByAnotherUser() {
        authenticateAs(41L);
        LocalDate date = LocalDate.of(2026, 8, 19);
        FoodLog otherUsersLog = foodLog(99L, date);
        FoodEntry entry = foodEntry(
                "647f7df5-315a-4382-95aa-39769194095f",
                otherUsersLog,
                "dinner",
                "Soup",
                1.0,
                "bowl",
                null);
        UUID entryId = entry.getId();
        when(foodEntryRepository.findById(entryId)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> foodService.deleteEntry(date, entryId))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(foodEntryRepository, never()).delete(any(FoodEntry.class));
    }

    @Test
    void aiInsightsCacheUsesInjectedClockForExpiration() {
        Instant cachedAt = Instant.parse("2026-08-19T12:00:00Z");
        Clock cacheClock = mock(Clock.class);
        when(cacheClock.instant()).thenReturn(
                cachedAt,
                cachedAt.plusSeconds(59 * 60),
                cachedAt.plusSeconds(61 * 60),
                cachedAt.plusSeconds(61 * 60));
        foodService = new FoodService(
                foodLogRepository,
                foodEntryRepository,
                nutritionEnrichmentService,
                geminiService,
                new ObjectMapper(),
                preferenceRepository,
                authenticatedUserProvider,
                cacheClock);
        authenticateAs(41L);
        LocalDate startDate = LocalDate.of(2026, 8, 13);
        LocalDate endDate = LocalDate.of(2026, 8, 19);
        when(foodLogRepository.findByUserIdAndLogDateBetweenOrderByLogDateAsc(41L, startDate, endDate))
                .thenReturn(List.of());
        when(preferenceRepository.findByUserId(41L)).thenReturn(List.of());
        when(geminiService.callRawPrompt(any(String.class))).thenReturn(
                "{\"choices\":[{\"message\":{\"content\":\"[{\\\"variant\\\":\\\"neutral\\\",\\\"message\\\":\\\"Steady\\\"}]\"}}]}");

        assertThat(foodService.getAiInsights(startDate, endDate)).singleElement()
                .extracting(InsightResponse::getMessage)
                .isEqualTo("Steady");
        assertThat(foodService.getAiInsights(startDate, endDate)).singleElement()
                .extracting(InsightResponse::getMessage)
                .isEqualTo("Steady");
        assertThat(foodService.getAiInsights(startDate, endDate)).singleElement()
                .extracting(InsightResponse::getMessage)
                .isEqualTo("Steady");

        verify(geminiService, times(2)).callRawPrompt(any(String.class));
    }

    private void authenticateAs(Long userId) {
        User user = new User();
        user.setId(userId);
        when(authenticatedUserProvider.getAuthenticatedUser()).thenReturn(user);
    }

    private FoodLog foodLog(Long userId, LocalDate date) {
        FoodLog log = new FoodLog();
        log.setUserId(userId);
        log.setLogDate(date);
        return log;
    }

    private FoodEntry foodEntry(
            String id,
            FoodLog log,
            String mealType,
            String name,
            double quantity,
            String unit,
            NutritionDetails nutritionDetails) {
        FoodEntry entry = new FoodEntry();
        entry.setId(UUID.fromString(id));
        entry.setFoodLog(log);
        entry.setMealType(mealType);
        entry.setName(name);
        entry.setQuantity(quantity);
        entry.setUnit(unit);
        entry.setNutritionDetails(nutritionDetails);
        return entry;
    }

    private NutritionDetails nutrition(
            String calories,
            String protein,
            String carbs,
            String fat,
            String fiber,
            String sugar,
            String sodium) {
        NutritionDetails details = new NutritionDetails();
        details.setCalories(decimal(calories));
        details.setProteinG(decimal(protein));
        details.setCarbsG(decimal(carbs));
        details.setFatsG(decimal(fat));
        details.setFiberG(decimal(fiber));
        details.setSugarG(decimal(sugar));
        details.setSodiumMg(decimal(sodium));
        return details;
    }

    private BigDecimal decimal(String value) {
        return value == null ? null : new BigDecimal(value);
    }
}
