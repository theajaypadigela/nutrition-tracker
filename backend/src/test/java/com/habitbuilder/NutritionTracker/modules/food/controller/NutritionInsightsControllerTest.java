package com.habitbuilder.NutritionTracker.modules.food.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.habitbuilder.NutritionTracker.modules.food.dto.InsightResponse;
import com.habitbuilder.NutritionTracker.modules.food.service.NutritionInsightsService;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(NutritionInsightsController.class)
class NutritionInsightsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NutritionInsightsService nutritionInsightsService;

    @Test
    void returnsInsightsForTheRequestedRange() throws Exception {
        when(nutritionInsightsService.getAiInsights(LocalDate.of(2026, 6, 8), LocalDate.of(2026, 6, 14)))
                .thenReturn(List.of(
                        InsightResponse.builder()
                                .variant("positive")
                                .message("Great protein intake! Keep it up.")
                                .build(),
                        InsightResponse.builder()
                                .variant("negative")
                                .message("Fiber is low this week.")
                                .build()));

        mockMvc.perform(get("/food/nutrition/insights")
                .param("startDate", "2026-06-08")
                .param("endDate", "2026-06-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].variant").value("positive"))
                .andExpect(jsonPath("$[0].message").value("Great protein intake! Keep it up."))
                .andExpect(jsonPath("$[1].variant").value("negative"))
                .andExpect(jsonPath("$[1].message").value("Fiber is low this week."));

        // The ISO strings must arrive as those exact LocalDate values, not shifted or reparsed.
        verify(nutritionInsightsService).getAiInsights(LocalDate.of(2026, 6, 8), LocalDate.of(2026, 6, 14));
    }

    /**
     * Pins current behaviour, not desirable behaviour: both request params are required, and a
     * missing one raises {@code MissingServletRequestParameterException}, which
     * {@code GlobalExceptionHandler} has no specific handler for. It falls to the
     * {@code Exception} catch-all and answers 500 where 400 is the honest status. Recorded, not
     * fixed — C1.
     */
    @Test
    void answers500WhenEndDateIsMissing() throws Exception {
        mockMvc.perform(get("/food/nutrition/insights").param("startDate", "2026-06-08"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
    }

    /**
     * Same pinned wart, other cause: an unparseable date is a
     * {@code MethodArgumentTypeMismatchException}, also unhandled, also a 500.
     */
    @Test
    void answers500ForAnUnparseableDate() throws Exception {
        mockMvc.perform(get("/food/nutrition/insights")
                .param("startDate", "not-a-date")
                .param("endDate", "2026-06-14"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
    }
}
