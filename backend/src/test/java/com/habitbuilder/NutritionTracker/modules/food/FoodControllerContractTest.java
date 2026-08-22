package com.habitbuilder.NutritionTracker.modules.food;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.habitbuilder.NutritionTracker.common.api.GlobalExceptionHandler;

@ExtendWith(MockitoExtension.class)
class FoodControllerContractTest {

    @Mock
    private FoodService foodService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new FoodController(foodService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getDayLogKeepsTheExistingMealsResponseShape() throws Exception {
        LocalDate date = LocalDate.of(2026, 8, 19);
        UUID entryId = UUID.fromString("3fded42d-d99b-4a85-b0e1-93c76c8128f1");
        FoodItemResponse item = FoodItemResponse.builder()
                .id(entryId.toString())
                .name("Oats")
                .quantity("1.5")
                .servingSize("bowl")
                .enrichmentStatus("completed")
                .calories(240.0)
                .protein(8.0)
                .carbs(42.0)
                .fat(5.0)
                .fiber(6.0)
                .sugar(3.0)
                .sodium(120.0)
                .build();
        Map<String, List<FoodItemResponse>> meals = new LinkedHashMap<>();
        meals.put("breakfast", List.of(item));
        MealsResponse response = new MealsResponse(
                meals,
                new NutritionTotals(240.0, 8.0, 42.0, 5.0, 6.0, 3.0, 120.0));
        when(foodService.getDayLogAsMeals(date)).thenReturn(response);

        mockMvc.perform(get("/food/{date}", "2026-08-19"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {
                          "meals": {
                            "breakfast": [{
                              "id": "3fded42d-d99b-4a85-b0e1-93c76c8128f1",
                              "name": "Oats",
                              "quantity": "1.5",
                              "servingSize": "bowl",
                              "enrichmentStatus": "completed",
                              "calories": 240.0,
                              "protein": 8.0,
                              "carbs": 42.0,
                              "fat": 5.0,
                              "fiber": 6.0,
                              "sugar": 3.0,
                              "sodium": 120.0
                            }]
                          },
                          "totals": {
                            "calories": 240.0,
                            "protein": 8.0,
                            "carbs": 42.0,
                            "fat": 5.0,
                            "fiber": 6.0,
                            "sugar": 3.0,
                            "sodium": 120.0
                          }
                        }
                        """, JsonCompareMode.STRICT));

        verify(foodService).getDayLogAsMeals(date);
    }

    @Test
    void getDayLogKeepsNullNutritionFieldsWhileEnrichmentIsIncomplete() throws Exception {
        LocalDate date = LocalDate.of(2026, 8, 20);
        FoodItemResponse item = FoodItemResponse.builder()
                .id("94692764-919c-45d1-8b5c-c74dd6cced33")
                .name("Apple")
                .quantity("1.0")
                .servingSize("piece")
                .enrichmentStatus("pending")
                .build();
        MealsResponse response = new MealsResponse(
                Map.of("snack", List.of(item)),
                new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0));
        when(foodService.getDayLogAsMeals(date)).thenReturn(response);

        mockMvc.perform(get("/food/{date}", "2026-08-20"))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {
                          "meals": {
                            "snack": [{
                              "id": "94692764-919c-45d1-8b5c-c74dd6cced33",
                              "name": "Apple",
                              "quantity": "1.0",
                              "servingSize": "piece",
                              "enrichmentStatus": "pending",
                              "calories": null,
                              "protein": null,
                              "carbs": null,
                              "fat": null,
                              "fiber": null,
                              "sugar": null,
                              "sodium": null
                            }]
                          },
                          "totals": {
                            "calories": 0.0,
                            "protein": 0.0,
                            "carbs": 0.0,
                            "fat": 0.0,
                            "fiber": 0.0,
                            "sugar": 0.0,
                            "sodium": 0.0
                          }
                        }
                        """, JsonCompareMode.STRICT));

        verify(foodService).getDayLogAsMeals(date);
    }

    @Test
    void getDayLogKeepsTheEmptyDayShape() throws Exception {
        LocalDate date = LocalDate.of(2026, 8, 21);
        MealsResponse response = new MealsResponse(
                Map.of(),
                new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0));
        when(foodService.getDayLogAsMeals(date)).thenReturn(response);

        mockMvc.perform(get("/food/{date}", "2026-08-21"))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {
                          "meals": {},
                          "totals": {
                            "calories": 0.0,
                            "protein": 0.0,
                            "carbs": 0.0,
                            "fat": 0.0,
                            "fiber": 0.0,
                            "sugar": 0.0,
                            "sodium": 0.0
                          }
                        }
                        """, JsonCompareMode.STRICT));

        verify(foodService).getDayLogAsMeals(date);
    }

    @Test
    void batchValidationRejectsBlankNamesAndNegativeQuantities() throws Exception {
        mockMvc.perform(post("/food/{date}/meals/{mealType}/entries", "2026-08-22", "breakfast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"name":"   ","quantity":-1,"unit":"bowl"}]
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("Request validation failed"));

        verifyNoInteractions(foodService);
    }

    @Test
    void malformedDatePathVariableIsRejectedAsBadRequestRatherThanServerError() throws Exception {
        mockMvc.perform(get("/food/{date}", "not-a-date"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verifyNoInteractions(foodService);
    }

    @Test
    void malformedJsonBodyIsRejectedAsBadRequest() throws Exception {
        mockMvc.perform(post("/food/{date}/meals/{mealType}/entries", "2026-08-22", "breakfast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"name\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("Request validation failed"));

        verifyNoInteractions(foodService);
    }

    @Test
    void unsupportedMethodKeepsItsOwnStatus() throws Exception {
        mockMvc.perform(delete("/food/{date}", "2026-08-22"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.status").value(405))
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));

        verifyNoInteractions(foodService);
    }

    @Test
    void unsupportedMediaTypeKeepsItsOwnStatus() throws Exception {
        mockMvc.perform(post("/food/{date}/meals/{mealType}/entries", "2026-08-22", "breakfast")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("oats"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.status").value(415))
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));

        verifyNoInteractions(foodService);
    }
}
