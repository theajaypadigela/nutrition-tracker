package com.habitbuilder.NutritionTracker.modules.mealschedule;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/meal-schedule")
public class MealScheduleController {

    private final MealScheduleService mealScheduleService;

    public MealScheduleController(MealScheduleService mealScheduleService) {
        this.mealScheduleService = mealScheduleService;
    }

    /** Returns the current user's meal schedule, or 404 if none has been saved. */
    @GetMapping
    public ResponseEntity<MealScheduleDTO> getSchedule() {
        return mealScheduleService.getForCurrentUser()
                .map(MealScheduleController::toDto)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping
    public MealScheduleDTO upsertSchedule(@RequestBody MealScheduleDTO body) {
        return toDto(mealScheduleService.upsertForCurrentUser(body));
    }

    private static MealScheduleDTO toDto(MealSchedule schedule) {
        MealScheduleDTO dto = new MealScheduleDTO();
        dto.setHour(schedule.getHour());
        dto.setMinute(schedule.getMinute());
        dto.setEnabled(schedule.isEnabled());
        dto.setTimezone(schedule.getTimezone());
        return dto;
    }
}
