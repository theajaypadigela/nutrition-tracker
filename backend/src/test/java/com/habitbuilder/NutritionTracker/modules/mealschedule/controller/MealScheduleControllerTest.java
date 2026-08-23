package com.habitbuilder.NutritionTracker.modules.mealschedule.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.habitbuilder.NutritionTracker.modules.mealschedule.dto.MealScheduleDTO;
import com.habitbuilder.NutritionTracker.modules.mealschedule.entity.MealSchedule;
import com.habitbuilder.NutritionTracker.modules.mealschedule.service.MealScheduleService;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(MealScheduleController.class)
class MealScheduleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MealScheduleService mealScheduleService;

    private static MealSchedule schedule(int hour, int minute, boolean enabled, String timezone) {
        MealSchedule schedule = new MealSchedule();
        schedule.setHour(hour);
        schedule.setMinute(minute);
        schedule.setEnabled(enabled);
        schedule.setTimezone(timezone);
        return schedule;
    }

    @Test
    void returnsTheStoredScheduleForTheCurrentUser() throws Exception {
        when(mealScheduleService.getForCurrentUser())
                .thenReturn(Optional.of(schedule(19, 45, true, "Asia/Kolkata")));

        mockMvc.perform(get("/meal-schedule"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hour").value(19))
                .andExpect(jsonPath("$.minute").value(45))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.timezone").value("Asia/Kolkata"));
    }

    /**
     * The empty body matters as much as the status: the client's {@code mealScheduleStore}
     * branches on a bare 404 to mean "no schedule saved yet", so this endpoint must not grow
     * an error envelope here.
     */
    @Test
    void answers404WithAnEmptyBodyWhenNoScheduleIsSaved() throws Exception {
        when(mealScheduleService.getForCurrentUser()).thenReturn(Optional.empty());

        mockMvc.perform(get("/meal-schedule"))
                .andExpect(status().isNotFound())
                .andExpect(content().string(""));
    }

    @Test
    void upsertsTheScheduleAndReturnsWhatTheServiceSaved() throws Exception {
        when(mealScheduleService.upsertForCurrentUser(any(MealScheduleDTO.class)))
                .thenReturn(schedule(7, 30, true, "Europe/Berlin"));

        mockMvc.perform(put("/meal-schedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"hour\":7,\"minute\":30,\"enabled\":true,\"timezone\":\"Europe/Berlin\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hour").value(7))
                .andExpect(jsonPath("$.minute").value(30))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.timezone").value("Europe/Berlin"));

        ArgumentCaptor<MealScheduleDTO> captor = ArgumentCaptor.forClass(MealScheduleDTO.class);
        verify(mealScheduleService).upsertForCurrentUser(captor.capture());
        MealScheduleDTO sent = captor.getValue();
        assertEquals(7, sent.getHour());
        assertEquals(30, sent.getMinute());
        assertTrue(sent.isEnabled());
        assertEquals("Europe/Berlin", sent.getTimezone());
    }

    /**
     * Pins that the controller validates nothing — the body has no {@code @Valid} and no
     * range constraints, so an out-of-range hour reaches the service untouched and it is the
     * service that clamps. Recorded as today's split of responsibility, not as a design.
     */
    @Test
    void passesOutOfRangeValuesStraightThroughToTheService() throws Exception {
        when(mealScheduleService.upsertForCurrentUser(any(MealScheduleDTO.class)))
                .thenReturn(schedule(23, 59, false, "UTC"));

        mockMvc.perform(put("/meal-schedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"hour\":99,\"minute\":-5,\"enabled\":false,\"timezone\":\"UTC\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hour").value(23))
                .andExpect(jsonPath("$.minute").value(59))
                .andExpect(jsonPath("$.enabled").value(false));

        ArgumentCaptor<MealScheduleDTO> captor = ArgumentCaptor.forClass(MealScheduleDTO.class);
        verify(mealScheduleService).upsertForCurrentUser(captor.capture());
        assertEquals(99, captor.getValue().getHour());
        assertEquals(-5, captor.getValue().getMinute());
    }
}
