package com.habitbuilder.NutritionTracker.modules.habit;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

@RestController
@RequestMapping("/habit")
public class HabitController {

    private HabitService habitService;

    HabitController(HabitService habitService) {
        this.habitService = habitService;
    }

    @PostMapping
    public Habit addHabit(@RequestBody HabitDTO param) {
        return habitService.addHabit(param);
    }

    @GetMapping
    public List<Habit> getAllHabits() {
        return habitService.getAllHabits();
    }

    @GetMapping("/today")
    public List<HabitWithCompletionDTO> getpresentDayHabits() {
        return habitService.getPresentDayHabits();
    }

    @PostMapping("/{id}/toggle")
    public void toggleHabit(@PathVariable Long id) {
        HabitCompletionDTO habitCompletion = new HabitCompletionDTO();
        habitCompletion.setId(id);
        habitService.toggleHabit(habitCompletion);
    }

    @DeleteMapping("/{id}")
    public void deleteHabit(@PathVariable Long id) {
        habitService.deleteHabit(id);
    }

    @PostMapping("/voice-result")
    public HabitWithCompletionDTO processVoiceResult(@RequestBody HabitVoiceResultDTO result) {
        return habitService.processVoiceResult(result);
    }
}
