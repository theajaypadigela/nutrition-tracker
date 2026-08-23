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

import com.habitbuilder.NutritionTracker.modules.food.dto.DailyNutritionSummary;
import com.habitbuilder.NutritionTracker.modules.food.dto.NutrientSummary;
import com.habitbuilder.NutritionTracker.modules.food.dto.NutritionTotals;
import com.habitbuilder.NutritionTracker.modules.food.dto.TopFoodSource;
import com.habitbuilder.NutritionTracker.modules.food.dto.WeeklyNutritionReport;
import com.habitbuilder.NutritionTracker.modules.food.service.NutritionReportService;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(NutritionReportController.class)
class NutritionReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NutritionReportService nutritionReportService;

    @Test
    void returnsTheWeeklyReportForTheRequestedRange() throws Exception {
        when(nutritionReportService.getWeeklyNutritionReport(LocalDate.of(2026, 6, 8), LocalDate.of(2026, 6, 14)))
                .thenReturn(WeeklyNutritionReport.builder()
                        .avgDailyCalories(1850.5)
                        .weeklyTotals(NutritionTotals.builder()
                                .calories(12953.5)
                                .protein(840.0)
                                .carbs(1120.0)
                                .fat(420.0)
                                .fiber(210.0)
                                .sugar(280.0)
                                .sodium(16100.0)
                                .build())
                        .weeklyAverage(NutritionTotals.builder()
                                .calories(1850.5)
                                .protein(120.0)
                                .carbs(160.0)
                                .fat(60.0)
                                .fiber(30.0)
                                .sugar(40.0)
                                .sodium(2300.0)
                                .build())
                        .dailySummaries(List.of(DailyNutritionSummary.builder()
                                .date(LocalDate.of(2026, 6, 8))
                                .totals(NutritionTotals.builder()
                                        .calories(1900.0)
                                        .protein(130.0)
                                        .carbs(150.0)
                                        .fat(55.0)
                                        .fiber(28.0)
                                        .sugar(35.0)
                                        .sodium(2100.0)
                                        .build())
                                .build()))
                        .build());

        mockMvc.perform(get("/food/nutrition/weekly")
                .param("startDate", "2026-06-08")
                .param("endDate", "2026-06-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avgDailyCalories").value(1850.5))
                .andExpect(jsonPath("$.weeklyTotals.calories").value(12953.5))
                .andExpect(jsonPath("$.weeklyTotals.protein").value(840.0))
                .andExpect(jsonPath("$.weeklyTotals.carbs").value(1120.0))
                .andExpect(jsonPath("$.weeklyTotals.fat").value(420.0))
                .andExpect(jsonPath("$.weeklyTotals.fiber").value(210.0))
                .andExpect(jsonPath("$.weeklyTotals.sugar").value(280.0))
                .andExpect(jsonPath("$.weeklyTotals.sodium").value(16100.0))
                .andExpect(jsonPath("$.weeklyAverage.calories").value(1850.5))
                .andExpect(jsonPath("$.weeklyAverage.sodium").value(2300.0))
                .andExpect(jsonPath("$.dailySummaries").isArray())
                .andExpect(jsonPath("$.dailySummaries.length()").value(1))
                .andExpect(jsonPath("$.dailySummaries[0].date").value("2026-06-08"))
                .andExpect(jsonPath("$.dailySummaries[0].totals.calories").value(1900.0))
                .andExpect(jsonPath("$.dailySummaries[0].totals.protein").value(130.0));

        // The ISO strings must arrive as those exact LocalDate values, not shifted or reparsed.
        verify(nutritionReportService).getWeeklyNutritionReport(LocalDate.of(2026, 6, 8), LocalDate.of(2026, 6, 14));
    }

    @Test
    void returnsAllNutrientSummariesForTheRequestedRange() throws Exception {
        when(nutritionReportService.getAllNutrientsSummary(LocalDate.of(2026, 6, 8), LocalDate.of(2026, 6, 14)))
                .thenReturn(List.of(
                        NutrientSummary.builder()
                                .id("protein")
                                .name("Protein")
                                .unit("g")
                                .category("macro")
                                .value(120.4)
                                .goal(150.0)
                                .pctDV(80)
                                .flag("ok")
                                .weeklyAvg(120.4)
                                .trend(List.of(110.0, 130.0, 0.0))
                                .topSources(List.of(TopFoodSource.builder()
                                        .name("Chicken breast")
                                        .amount(62.5)
                                        .unit("g")
                                        .contribution(51.9)
                                        .build()))
                                .pinned(true)
                                .avoidedFoods("peanuts")
                                .customTarget(150.0)
                                .build(),
                        NutrientSummary.builder()
                                .id("vitaminC")
                                .name("Vitamin C")
                                .unit("mg")
                                .category("vitamin")
                                .value(0.0)
                                .goal(90.0)
                                .pctDV(0)
                                .flag("none")
                                .weeklyAvg(0.0)
                                .trend(List.of())
                                .topSources(List.of())
                                .pinned(false)
                                .build()));

        mockMvc.perform(get("/food/nutrition/all")
                .param("startDate", "2026-06-08")
                .param("endDate", "2026-06-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("protein"))
                .andExpect(jsonPath("$[0].name").value("Protein"))
                .andExpect(jsonPath("$[0].unit").value("g"))
                .andExpect(jsonPath("$[0].category").value("macro"))
                .andExpect(jsonPath("$[0].value").value(120.4))
                .andExpect(jsonPath("$[0].goal").value(150.0))
                // Lombok's getPctDV() keeps the capitalised DV in the JSON name the client reads.
                .andExpect(jsonPath("$[0].pctDV").value(80))
                .andExpect(jsonPath("$[0].flag").value("ok"))
                .andExpect(jsonPath("$[0].weeklyAvg").value(120.4))
                .andExpect(jsonPath("$[0].trend").isArray())
                .andExpect(jsonPath("$[0].trend.length()").value(3))
                .andExpect(jsonPath("$[0].trend[0]").value(110.0))
                .andExpect(jsonPath("$[0].topSources").isArray())
                .andExpect(jsonPath("$[0].topSources[0].name").value("Chicken breast"))
                .andExpect(jsonPath("$[0].topSources[0].amount").value(62.5))
                .andExpect(jsonPath("$[0].topSources[0].unit").value("g"))
                .andExpect(jsonPath("$[0].topSources[0].contribution").value(51.9))
                .andExpect(jsonPath("$[0].pinned").value(true))
                .andExpect(jsonPath("$[0].avoidedFoods").value("peanuts"))
                .andExpect(jsonPath("$[0].customTarget").value(150.0))
                .andExpect(jsonPath("$[1].id").value("vitaminC"))
                .andExpect(jsonPath("$[1].flag").value("none"))
                .andExpect(jsonPath("$[1].pinned").value(false))
                // No preference row for this nutrient: both fields serialise as null, which doesNotExist() accepts.
                .andExpect(jsonPath("$[1].avoidedFoods").doesNotExist())
                .andExpect(jsonPath("$[1].customTarget").doesNotExist());

        verify(nutritionReportService).getAllNutrientsSummary(LocalDate.of(2026, 6, 8), LocalDate.of(2026, 6, 14));
    }

    /**
     * Pins current behaviour, not desirable behaviour: both request params are required, and a
     * missing one raises {@code MissingServletRequestParameterException}, which
     * {@code GlobalExceptionHandler} has no specific handler for. It falls to the
     * {@code Exception} catch-all and answers 500 where 400 is the honest status. Recorded, not
     * fixed — C1.
     */
    @Test
    void answers500WhenTheWeeklyReportIsMissingEndDate() throws Exception {
        mockMvc.perform(get("/food/nutrition/weekly").param("startDate", "2026-06-08"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
    }

    /**
     * Same pinned wart, other cause: an unparseable date is a
     * {@code MethodArgumentTypeMismatchException}, also unhandled, also a 500.
     */
    @Test
    void answers500ForAnUnparseableAllNutrientsDate() throws Exception {
        mockMvc.perform(get("/food/nutrition/all")
                .param("startDate", "2026-06-08")
                .param("endDate", "not-a-date"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
    }
}
