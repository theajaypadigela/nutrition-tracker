package com.habitbuilder.NutritionTracker.modules.dashboard.controller;

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

import com.habitbuilder.NutritionTracker.modules.dashboard.dto.DashboardResponse;
import com.habitbuilder.NutritionTracker.modules.dashboard.service.DashboardService;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(DashboardController.class)
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DashboardService dashboardService;

    @Test
    void returnsDashboardSummaryForTheRequestedDate() throws Exception {
        when(dashboardService.getDashboardSummary(LocalDate.of(2026, 6, 14)))
                .thenReturn(DashboardResponse.builder()
                        .date(LocalDate.of(2026, 6, 14))
                        .habits(List.of())
                        .build());

        mockMvc.perform(get("/dashboard/2026-06-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value("2026-06-14"))
                .andExpect(jsonPath("$.habits").isArray());
    }

    /**
     * Pins current behaviour, which is not the behaviour you would design: an unparseable
     * path date is a {@code MethodArgumentTypeMismatchException}, which
     * {@code GlobalExceptionHandler} has no specific handler for, so it lands on the
     * catch-all and answers 500 rather than 400. Recorded, not fixed — C1.
     */
    @Test
    void answers500ForAnUnparseableDate() throws Exception {
        mockMvc.perform(get("/dashboard/not-a-date"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
    }
}
