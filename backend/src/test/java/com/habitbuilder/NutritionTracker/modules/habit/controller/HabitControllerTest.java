package com.habitbuilder.NutritionTracker.modules.habit.controller;

import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.modules.habit.dto.HabitCompletionDTO;
import com.habitbuilder.NutritionTracker.modules.habit.dto.HabitDTO;
import com.habitbuilder.NutritionTracker.modules.habit.dto.HabitOccurrenceStatusDTO;
import com.habitbuilder.NutritionTracker.modules.habit.dto.HabitVoiceInterpretRequestDTO;
import com.habitbuilder.NutritionTracker.modules.habit.dto.HabitVoiceInterpretResponseDTO;
import com.habitbuilder.NutritionTracker.modules.habit.dto.HabitVoiceResultDTO;
import com.habitbuilder.NutritionTracker.modules.habit.dto.HabitWithCompletionDTO;
import com.habitbuilder.NutritionTracker.modules.habit.entity.Habit;
import com.habitbuilder.NutritionTracker.modules.habit.service.HabitService;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(HabitController.class)
class HabitControllerTest {

    /**
     * {@code reminderTime} is serialized through {@code @JsonFormat(pattern = "hh:mm a")}, so it
     * is a 12-hour clock string rather than ISO-8601. Only the shape is pinned: the AM/PM marker
     * itself comes from the JVM's default locale.
     */
    private static final String TWELVE_HOUR_CLOCK = "\\d{2}:\\d{2} .+";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private HabitService habitService;

    @Test
    void createsAHabitFromThePostedBody() throws Exception {
        when(habitService.addHabit(any(HabitDTO.class))).thenReturn(habit());

        mockMvc.perform(post("/habit")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Morning walk","repeatDays":["MON","WED"],
                         "reminderTime":"07:30 AM","reminderType":"call"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("h-1"))
                .andExpect(jsonPath("$.name").value("Morning walk"))
                .andExpect(jsonPath("$.repeatDays").isArray())
                .andExpect(jsonPath("$.repeatDays[0]").value("MON"))
                .andExpect(jsonPath("$.reminderTime").value(matchesPattern(TWELVE_HOUR_CLOCK)))
                .andExpect(jsonPath("$.reminderType").value("call"));

        ArgumentCaptor<HabitDTO> captor = ArgumentCaptor.forClass(HabitDTO.class);
        verify(habitService).addHabit(captor.capture());
        assertEquals("Morning walk", captor.getValue().getName());
        assertArrayEquals(new String[] { "MON", "WED" }, captor.getValue().getRepeatDays());
        assertEquals("07:30 AM", captor.getValue().getReminderTime());
        assertEquals("call", captor.getValue().getReminderType());
    }

    @Test
    void returnsTodaysHabitsWithTheirCompletionState() throws Exception {
        HabitWithCompletionDTO today = new HabitWithCompletionDTO();
        today.setId("h-1");
        today.setName("Morning walk");
        today.setRepeatDays(new String[] { "MON", "WED" });
        today.setReminderTime(LocalTime.of(7, 30));
        today.setReminderType("call");
        today.setCompleted(true);
        today.setStatus("COMPLETED");
        today.setCompletedAt("07:35 AM");
        when(habitService.getPresentDayHabits()).thenReturn(List.of(today));

        mockMvc.perform(get("/habit/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].id").value("h-1"))
                .andExpect(jsonPath("$[0].name").value("Morning walk"))
                .andExpect(jsonPath("$[0].repeatDays").isArray())
                .andExpect(jsonPath("$[0].repeatDays[0]").value("MON"))
                .andExpect(jsonPath("$[0].reminderTime").value(matchesPattern(TWELVE_HOUR_CLOCK)))
                .andExpect(jsonPath("$[0].reminderType").value("call"))
                .andExpect(jsonPath("$[0].completed").value(true))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$[0].completedAt").value("07:35 AM"));
    }

    @Test
    void returnsEveryHabitWhenNoTimezoneIsGiven() throws Exception {
        when(habitService.getAllHabitsForCurrentUser(null)).thenReturn(List.of(habit()));

        mockMvc.perform(get("/habit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].id").value("h-1"));

        verify(habitService).getAllHabitsForCurrentUser(null);
    }

    @Test
    void passesTheTimezoneQueryParamToTheService() throws Exception {
        when(habitService.getAllHabitsForCurrentUser("Asia/Kolkata")).thenReturn(List.of(habit()));

        mockMvc.perform(get("/habit").param("tz", "Asia/Kolkata"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("h-1"));

        verify(habitService).getAllHabitsForCurrentUser("Asia/Kolkata");
    }

    /** A {@code void} handler answers 200 with an empty body — no envelope for the client. */
    @Test
    void recordsAnOccurrenceStatusAndAnswers200WithAnEmptyBody() throws Exception {
        mockMvc.perform(post("/habit/occurrence-status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"habitId":"h-1","reminderTime":"07:30 AM",
                         "status":"MISSED","timezone":"Asia/Kolkata"}
                        """))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        ArgumentCaptor<HabitOccurrenceStatusDTO> captor =
                ArgumentCaptor.forClass(HabitOccurrenceStatusDTO.class);
        verify(habitService).recordOccurrenceStatus(captor.capture());
        assertEquals("h-1", captor.getValue().getHabitId());
        assertEquals("07:30 AM", captor.getValue().getReminderTime());
        assertEquals("MISSED", captor.getValue().getStatus());
        assertEquals("Asia/Kolkata", captor.getValue().getTimezone());
    }

    /** The path id is the whole request: the handler wraps it in a {@link HabitCompletionDTO}. */
    @Test
    void togglesTheHabitNamedInThePath() throws Exception {
        mockMvc.perform(post("/habit/h-1/toggle"))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        ArgumentCaptor<HabitCompletionDTO> captor = ArgumentCaptor.forClass(HabitCompletionDTO.class);
        verify(habitService).toggleHabit(captor.capture());
        assertEquals("h-1", captor.getValue().getId());
    }

    /** 200 rather than 204: the handler returns {@code void} without a {@code @ResponseStatus}. */
    @Test
    void deletesTheHabitNamedInThePath() throws Exception {
        mockMvc.perform(delete("/habit/h-1"))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        verify(habitService).deleteHabit("h-1");
    }

    @Test
    void returnsTheUpdatedHabitAfterAVoiceResult() throws Exception {
        HabitWithCompletionDTO rescheduled = new HabitWithCompletionDTO();
        rescheduled.setId("h-1");
        rescheduled.setName("Morning walk");
        rescheduled.setRepeatDays(new String[] { "MON", "WED" });
        rescheduled.setReminderTime(LocalTime.of(7, 30));
        rescheduled.setReminderType("call");
        rescheduled.setCompleted(false);
        rescheduled.setStatus("RESCHEDULED");
        rescheduled.setRescheduledTime(LocalDateTime.of(2026, 6, 14, 8, 15));
        when(habitService.processVoiceResult(any(HabitVoiceResultDTO.class))).thenReturn(rescheduled);

        mockMvc.perform(post("/habit/voice-result")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"habitId":"h-1","habitName":"Morning walk",
                         "habitStatus":"rescheduled","rescheduleMinutes":15,
                         "completedAt":"07:35 AM"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("h-1"))
                .andExpect(jsonPath("$.status").value("RESCHEDULED"))
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.rescheduledTime").value(startsWith("2026-06-14T08:15")));

        ArgumentCaptor<HabitVoiceResultDTO> captor = ArgumentCaptor.forClass(HabitVoiceResultDTO.class);
        verify(habitService).processVoiceResult(captor.capture());
        assertEquals("h-1", captor.getValue().getHabitId());
        assertEquals("Morning walk", captor.getValue().getHabitName());
        assertEquals("rescheduled", captor.getValue().getHabitStatus());
        assertEquals(15, captor.getValue().getRescheduleMinutes());
        assertEquals("07:35 AM", captor.getValue().getCompletedAt());
    }

    @Test
    void returnsTheInterpretedVoiceDecision() throws Exception {
        HabitVoiceInterpretResponseDTO decision = new HabitVoiceInterpretResponseDTO();
        decision.setHabitStatus("rescheduled");
        decision.setRescheduleMinutes(10);
        decision.setRationale("user_asked_for_delay");
        when(habitService.interpretVoiceTranscript(any(HabitVoiceInterpretRequestDTO.class)))
                .thenReturn(decision);

        mockMvc.perform(post("/habit/interpret-voice")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"transcriptLines":["Assistant: Did you finish your walk?",
                                            "You: Call me in 10 minutes."],
                         "habitName":"Morning walk","habitTime":"07:30 AM"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.habitStatus").value("rescheduled"))
                .andExpect(jsonPath("$.rescheduleMinutes").value(10))
                .andExpect(jsonPath("$.rationale").value("user_asked_for_delay"));

        ArgumentCaptor<HabitVoiceInterpretRequestDTO> captor =
                ArgumentCaptor.forClass(HabitVoiceInterpretRequestDTO.class);
        verify(habitService).interpretVoiceTranscript(captor.capture());
        assertEquals(
                List.of("Assistant: Did you finish your walk?", "You: Call me in 10 minutes."),
                captor.getValue().getTranscriptLines());
        assertEquals("Morning walk", captor.getValue().getHabitName());
        assertEquals("07:30 AM", captor.getValue().getHabitTime());
    }

    @Test
    void mapsAServiceResponseStatusExceptionToItsStatusAndReason() throws Exception {
        when(habitService.addHabit(any(HabitDTO.class))).thenThrow(
                new ResponseStatusException(HttpStatus.BAD_REQUEST, "reminderTime is required"));

        mockMvc.perform(post("/habit")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Morning walk","repeatDays":["MON"],"reminderType":"call"}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("reminderTime is required"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    /**
     * Pins current behaviour, not a design choice: the service signals an unknown habit with
     * {@code IllegalArgumentException}, which {@code GlobalExceptionHandler} has no specific
     * handler for, so a delete of a missing habit answers 500 rather than 404.
     */
    @Test
    void answers500WhenTheServiceRejectsADeleteWithAnIllegalArgument() throws Exception {
        doThrow(new IllegalArgumentException("Habit not found"))
                .when(habitService).deleteHabit("missing");

        mockMvc.perform(delete("/habit/missing"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
    }

    /**
     * Also pinned rather than endorsed: an unparseable body is a
     * {@code HttpMessageNotReadableException}, which lands on the advice's catch-all, so the
     * client sees 500 where 400 would be the honest answer.
     */
    @Test
    void answers500ForAnUnparseableRequestBody() throws Exception {
        mockMvc.perform(post("/habit")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"));

        verifyNoInteractions(habitService);
    }

    private static Habit habit() {
        Habit habit = new Habit();
        habit.setId("h-1");
        habit.setName("Morning walk");
        habit.setRepeatDays(List.of("MON", "WED"));
        habit.setReminderTime(LocalTime.of(7, 30));
        habit.setReminderType("call");
        habit.setUserId("u-1");
        return habit;
    }
}
