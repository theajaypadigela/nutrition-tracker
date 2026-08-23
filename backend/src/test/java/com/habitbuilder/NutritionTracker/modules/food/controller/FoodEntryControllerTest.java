package com.habitbuilder.NutritionTracker.modules.food.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.modules.food.dto.AddFoodEntryRequest;
import com.habitbuilder.NutritionTracker.modules.food.dto.DayLogResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.FoodEntryResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.FoodItemResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.MealEntriesResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.MealsResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.NutritionTotals;
import com.habitbuilder.NutritionTracker.modules.food.dto.UpdateFoodEntryRequest;
import com.habitbuilder.NutritionTracker.modules.food.service.FoodLogService;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(FoodEntryController.class)
class FoodEntryControllerTest {

    private static final LocalDate DATE = LocalDate.of(2026, 6, 14);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FoodLogService foodLogService;

    @Test
    void addsTheEntriesPostedForADateAndMealType() throws Exception {
        when(foodLogService.addFoodEntries(DATE, "breakfast", List.of(addRequest("Oats", 150.0, "g"))))
                .thenReturn(List.of(FoodEntryResponse.builder()
                        .id("entry-1")
                        .name("Oats")
                        .quantity(150.0)
                        .unit("g")
                        .mealType("breakfast")
                        .nutritionResponse("Nutrition enrichment in progress")
                        .build()));

        mockMvc.perform(post("/food/2026-06-14/meals/breakfast/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"name\":\"Oats\",\"quantity\":150.0,\"unit\":\"g\"}]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].id").value("entry-1"))
                .andExpect(jsonPath("$[0].name").value("Oats"))
                .andExpect(jsonPath("$[0].quantity").value(150.0))
                .andExpect(jsonPath("$[0].unit").value("g"))
                .andExpect(jsonPath("$[0].mealType").value("breakfast"))
                .andExpect(jsonPath("$[0].nutritionResponse").value("Nutrition enrichment in progress"));
    }

    /**
     * The meal-type segment reaches the service verbatim — normalization onto a canonical slot
     * (and the 400 for an unrecognized label) happens inside {@code FoodLogService}, not here.
     */
    @Test
    void passesTheMealTypePathVariableThroughUnnormalized() throws Exception {
        when(foodLogService.addFoodEntries(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(post("/food/2026-06-14/meals/SNACKS/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"name\":\"Almonds\",\"quantity\":20.0,\"unit\":\"g\"}]"))
                .andExpect(status().isOk());

        verify(foodLogService).addFoodEntries(DATE, "SNACKS", List.of(addRequest("Almonds", 20.0, "g")));
    }

    @Test
    void returnsTheDayLogAsMealsForTheRequestedDate() throws Exception {
        when(foodLogService.getDayLogAsMeals(DATE)).thenReturn(dayMeals());

        mockMvc.perform(get("/food/2026-06-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals.breakfast").isArray())
                .andExpect(jsonPath("$.meals.breakfast[0].id").value("entry-1"))
                .andExpect(jsonPath("$.meals.breakfast[0].name").value("Oats"))
                // FoodItemResponse.quantity is a String here, unlike the number on FoodEntryResponse.
                .andExpect(jsonPath("$.meals.breakfast[0].quantity").value("150.0"))
                .andExpect(jsonPath("$.meals.breakfast[0].servingSize").value("g"))
                .andExpect(jsonPath("$.meals.breakfast[0].calories").value(210.0))
                .andExpect(jsonPath("$.meals.lunch").isArray())
                .andExpect(jsonPath("$.meals.snack").isArray())
                .andExpect(jsonPath("$.meals.dinner").isArray())
                .andExpect(jsonPath("$.totals.calories").value(210.0))
                .andExpect(jsonPath("$.totals.protein").value(8.0));
    }

    @Test
    void returnsOneDayLogPerDayInTheRequestedRange() throws Exception {
        when(foodLogService.getDayLogs(LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7)))
                .thenReturn(List.of(DayLogResponse.builder()
                        .foodLogId("log-1")
                        .date(LocalDate.of(2026, 6, 1))
                        .meals(List.of(new MealEntriesResponse("breakfast",
                                List.of(FoodEntryResponse.builder()
                                        .id("entry-1")
                                        .name("Oats")
                                        .quantity(150.0)
                                        .unit("g")
                                        .mealType("breakfast")
                                        .build()))))
                        .build()));

        mockMvc.perform(get("/food").param("from", "2026-06-01").param("to", "2026-06-07"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].foodLogId").value("log-1"))
                .andExpect(jsonPath("$[0].date").value("2026-06-01"))
                .andExpect(jsonPath("$[0].meals[0].mealType").value("breakfast"))
                .andExpect(jsonPath("$[0].meals[0].entries[0].id").value("entry-1"))
                .andExpect(jsonPath("$[0].meals[0].entries[0].name").value("Oats"))
                .andExpect(jsonPath("$[0].meals[0].entries[0].mealType").value("breakfast"));
    }

    @Test
    void updatesTheEntryNamedInThePathFromTheRequestBody() throws Exception {
        when(foodLogService.updateEntry(DATE, "entry-1", updateRequest("Oats", 120.0, "g")))
                .thenReturn(dayMeals());

        mockMvc.perform(put("/food/2026-06-14/meals/entries/entry-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Oats\",\"quantity\":120.0,\"unit\":\"g\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals.breakfast[0].id").value("entry-1"))
                .andExpect(jsonPath("$.totals.calories").value(210.0));
    }

    @Test
    void deletesTheEntryScopedToTheDateInThePath() throws Exception {
        when(foodLogService.deleteEntry(DATE, "entry-1")).thenReturn(dayMeals());

        mockMvc.perform(delete("/food/2026-06-14/meals/entries/entry-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.calories").value(210.0));

        verify(foodLogService).deleteEntry(DATE, "entry-1");
        verify(foodLogService, never()).deleteEntryById(any());
    }

    /**
     * The dateless delete is a mapping of its own, not the dated one with a segment left out:
     * the two paths differ in length, so they never collide, and each reaches its own service
     * method. Asserted from both sides because the URLs are one segment apart.
     */
    @Test
    void deletesTheEntryByIdWhenThePathCarriesNoDate() throws Exception {
        when(foodLogService.deleteEntryById("entry-1")).thenReturn(dayMeals());

        mockMvc.perform(delete("/food/meals/entries/entry-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.calories").value(210.0));

        verify(foodLogService).deleteEntryById("entry-1");
        verify(foodLogService, never()).deleteEntry(any(), any());
    }

    @Test
    void answers400WithTheFieldMessageWhenTheUpdateBodyIsInvalid() throws Exception {
        mockMvc.perform(put("/food/2026-06-14/meals/entries/entry-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":-5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Quantity must be positive"));
    }

    /**
     * Pinned, not endorsed. The two validated bodies on this controller fail through different
     * machinery and so produce different messages:
     *
     * <ul>
     * <li>{@code @RequestBody @Valid UpdateFoodEntryRequest} is validated by the argument
     * resolver, raising {@code MethodArgumentNotValidException}, which
     * {@code GlobalExceptionHandler} unpacks into the joined field messages.</li>
     * <li>{@code @RequestBody List<@Valid AddFoodEntryRequest>} carries no parameter-level
     * {@code @Valid}, so the resolver skips it; the container-element {@code @Valid} instead
     * turns on Spring's method validation, which raises
     * {@code HandlerMethodValidationException} — a {@code ResponseStatusException} whose reason
     * is the fixed string below. The caller gets a 400 either way, but only the single-body
     * route tells them which field was wrong.</li>
     * </ul>
     */
    @Test
    void answers400WithAGenericMessageWhenAnAddedEntryIsInvalid() throws Exception {
        mockMvc.perform(post("/food/2026-06-14/meals/breakfast/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"name\":\"\",\"quantity\":0,\"unit\":\"\"}]"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Validation failure"));
    }

    @Test
    void propagatesAServiceResponseStatusExceptionAsItsOwnStatus() throws Exception {
        when(foodLogService.deleteEntryById("missing"))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Food entry not found"));

        mockMvc.perform(delete("/food/meals/entries/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Food entry not found"));
    }

    /**
     * Pins current behaviour, as {@code DashboardControllerTest} does: an unparseable path date
     * is a {@code MethodArgumentTypeMismatchException}, which has no specific handler, so it
     * lands on the catch-all and answers 500 rather than 400. Recorded, not fixed — C1.
     */
    @Test
    void answers500ForAnUnparseableDate() throws Exception {
        mockMvc.perform(get("/food/not-a-date"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
    }

    /**
     * The same wart from the query-string side: {@code from} and {@code to} are required, and
     * omitting them is a {@code MissingServletRequestParameterException} with no specific
     * handler, so the range endpoint answers 500 for a plainly malformed request.
     */
    @Test
    void answers500WhenTheRangeParametersAreMissing() throws Exception {
        mockMvc.perform(get("/food"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
    }

    private static AddFoodEntryRequest addRequest(String name, double quantity, String unit) {
        AddFoodEntryRequest request = new AddFoodEntryRequest();
        request.setName(name);
        request.setQuantity(quantity);
        request.setUnit(unit);
        return request;
    }

    private static UpdateFoodEntryRequest updateRequest(String name, double quantity, String unit) {
        UpdateFoodEntryRequest request = new UpdateFoodEntryRequest();
        request.setName(name);
        request.setQuantity(quantity);
        request.setUnit(unit);
        return request;
    }

    private static MealsResponse dayMeals() {
        Map<String, List<FoodItemResponse>> meals = new LinkedHashMap<>();
        meals.put("breakfast", List.of(FoodItemResponse.builder()
                .id("entry-1")
                .name("Oats")
                .quantity("150.0")
                .servingSize("g")
                .calories(210.0)
                .protein(8.0)
                .build()));
        meals.put("lunch", List.of());
        meals.put("snack", List.of());
        meals.put("dinner", List.of());

        return MealsResponse.builder()
                .meals(meals)
                .totals(NutritionTotals.builder().calories(210.0).protein(8.0).build())
                .build();
    }
}
