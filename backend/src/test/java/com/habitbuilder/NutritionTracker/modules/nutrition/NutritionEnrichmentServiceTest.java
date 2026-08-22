package com.habitbuilder.NutritionTracker.modules.nutrition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.food.FoodEntry;
import com.habitbuilder.NutritionTracker.modules.food.FoodEntryRepository;

@ExtendWith(MockitoExtension.class)
class NutritionEnrichmentServiceTest {

    @Mock private GeminiService geminiService;
    @Mock private NutritionDetailsRepository detailsRepository;
    @Mock private NutritionCacheRepository cacheRepository;
    @Mock private FoodEntryRepository foodEntryRepository;

    private NutritionEnrichmentService service;

    @BeforeEach
    void setUp() {
        service = new NutritionEnrichmentService(
                geminiService,
                detailsRepository,
                cacheRepository,
                foodEntryRepository,
                new ObjectMapper());
    }

    @Test
    void unparseableResponseMarksEntryFailedAndDoesNotWriteCache() {
        FoodEntry entry = entryWithDetails();
        when(cacheRepository.findByEntryHash(any())).thenReturn(Optional.empty());
        when(geminiService.getRawNutritionResponse("Oats", 1.0, "bowl"))
                .thenReturn("provider-envelope");
        when(geminiService.parseNutritionResponse("provider-envelope"))
                .thenThrow(new NutritionParseException("no numeric values", "provider-envelope"));

        service.enrichFoodEntry(entry);

        assertThat(entry.getNutritionDetails().getEnrichmentStatus()).isEqualTo("failed");
        assertThat(entry.getNutritionDetails().getRetryCount()).isEqualTo(1);
        verify(cacheRepository, never()).save(any(NutritionCache.class));
    }

    @Test
    void numericAllZeroResponseCompletesButIsNotCached() {
        FoodEntry entry = entryWithDetails();
        NutritionResponse zero = NutritionResponse.builder()
                .calories(BigDecimal.ZERO)
                .proteinG(BigDecimal.ZERO)
                .carbsG(BigDecimal.ZERO)
                .fatsG(BigDecimal.ZERO)
                .fiberG(BigDecimal.ZERO)
                .sugarG(BigDecimal.ZERO)
                .sodiumMg(BigDecimal.ZERO)
                .build();
        when(cacheRepository.findByEntryHash(any())).thenReturn(Optional.empty());
        when(geminiService.getRawNutritionResponse("Oats", 1.0, "bowl"))
                .thenReturn("provider-envelope");
        when(geminiService.parseNutritionResponse("provider-envelope")).thenReturn(zero);

        service.enrichFoodEntry(entry);

        assertThat(entry.getNutritionDetails().getEnrichmentStatus()).isEqualTo("completed");
        assertThat(entry.getNutritionDetails().getCalories()).isEqualByComparingTo(BigDecimal.ZERO);
        verify(cacheRepository, never()).save(any(NutritionCache.class));
    }

    @Test
    void cacheIdentityIsIndependentOfTheJvmDefaultLocale() {
        Locale original = Locale.getDefault();
        try {
            Locale.setDefault(Locale.forLanguageTag("tr-TR"));
            String turkish = ReflectionTestUtils.invokeMethod(
                    service, "generateEntryHash", "IRMIK", 1.25, "INCH");
            Locale.setDefault(Locale.US);
            String english = ReflectionTestUtils.invokeMethod(
                    service, "generateEntryHash", "IRMIK", 1.25, "INCH");

            assertThat(turkish).isEqualTo(english);
        } finally {
            Locale.setDefault(original);
        }
    }

    private FoodEntry entryWithDetails() {
        FoodEntry entry = new FoodEntry();
        entry.setName("Oats");
        entry.setQuantity(1.0);
        entry.setUnit("bowl");
        NutritionDetails details = new NutritionDetails();
        details.setFoodEntry(entry);
        entry.setNutritionDetails(details);
        return entry;
    }
}
