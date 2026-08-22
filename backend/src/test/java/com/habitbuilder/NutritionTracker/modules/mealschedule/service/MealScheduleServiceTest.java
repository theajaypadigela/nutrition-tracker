package com.habitbuilder.NutritionTracker.modules.mealschedule.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;
import com.habitbuilder.NutritionTracker.modules.mealschedule.dto.MealScheduleDTO;
import com.habitbuilder.NutritionTracker.modules.mealschedule.entity.MealSchedule;
import com.habitbuilder.NutritionTracker.modules.mealschedule.repository.MealScheduleRepository;

class MealScheduleServiceTest {

    private MealScheduleRepository scheduleRepo;
    private UserRepository userRepo;
    private MealScheduleService service;
    private User user;

    @BeforeEach
    void setUp() {
        scheduleRepo = mock(MealScheduleRepository.class);
        userRepo = mock(UserRepository.class);
        service = new MealScheduleService(scheduleRepo, userRepo,
                new com.habitbuilder.NutritionTracker.common.CurrentUserProvider());

        user = new User();
        user.setId("u1");
        user.setRole("USER");
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(user, null));

        when(scheduleRepo.save(any(MealSchedule.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void clampsOutOfRangeHourAndMinute() {
        when(scheduleRepo.findByUserId("u1")).thenReturn(Optional.empty());

        MealScheduleDTO dto = new MealScheduleDTO();
        dto.setHour(25);
        dto.setMinute(70);
        dto.setEnabled(true);

        MealSchedule saved = service.upsertForCurrentUser(dto);

        assertEquals(23, saved.getHour());
        assertEquals(59, saved.getMinute());
        assertEquals("u1", saved.getUserId());
        assertTrue(saved.isEnabled());
    }

    @Test
    void persistsUserTimezoneWhenProvided() {
        when(scheduleRepo.findByUserId("u1")).thenReturn(Optional.empty());

        MealScheduleDTO dto = new MealScheduleDTO();
        dto.setHour(20);
        dto.setMinute(0);
        dto.setEnabled(true);
        dto.setTimezone("Asia/Kolkata");

        service.upsertForCurrentUser(dto);

        assertEquals("Asia/Kolkata", user.getTimezone());
        verify(userRepo).save(user);
    }

    @Test
    void updatesExistingScheduleInPlace() {
        MealSchedule existing = new MealSchedule();
        existing.setId("s1");
        existing.setUserId("u1");
        existing.setHour(8);
        existing.setMinute(0);
        existing.setEnabled(false);
        when(scheduleRepo.findByUserId("u1")).thenReturn(Optional.of(existing));

        MealScheduleDTO dto = new MealScheduleDTO();
        dto.setHour(21);
        dto.setMinute(30);
        dto.setEnabled(true);

        MealSchedule saved = service.upsertForCurrentUser(dto);

        assertEquals("s1", saved.getId()); // same document, updated in place
        assertEquals(21, saved.getHour());
        assertEquals(30, saved.getMinute());
        assertTrue(saved.isEnabled());
    }
}
