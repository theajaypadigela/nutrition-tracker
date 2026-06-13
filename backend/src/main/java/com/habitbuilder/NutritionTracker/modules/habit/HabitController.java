package com.habitbuilder.NutritionTracker.modules.habit;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

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

    @GetMapping("/today")
    public List<HabitWithCompletionDTO> getpresentDayHabits() {
        return habitService.getPresentDayHabits();
    }

    /** All habits for the current user — consumed by the device reconciliation pass. */
    @GetMapping
    public List<Habit> getAllHabits(@RequestParam(name = "tz", required = false) String tz) {
        return habitService.getAllHabitsForCurrentUser(tz);
    }

    /** Records a terminal occurrence status (MISSED/DECLINED) so habits don't stay PENDING. */
    @PostMapping("/occurrence-status")
    public void reportOccurrenceStatus(@RequestBody HabitOccurrenceStatusDTO request) {
        habitService.recordOccurrenceStatus(request);
    }

    @PostMapping("/{id}/toggle")
    public void toggleHabit(@PathVariable String id) {
        HabitCompletionDTO habitCompletion = new HabitCompletionDTO();
        habitCompletion.setId(id);
        habitService.toggleHabit(habitCompletion);
    }

    @DeleteMapping("/{id}")
    public void deleteHabit(@PathVariable String id) {
        habitService.deleteHabit(id);
    }

    @PostMapping("/voice-result")
    public HabitWithCompletionDTO processVoiceResult(@RequestBody HabitVoiceResultDTO result) {
        return habitService.processVoiceResult(result);
    }

    @PostMapping("/interpret-voice")
    public HabitVoiceInterpretResponseDTO interpretVoice(@RequestBody HabitVoiceInterpretRequestDTO request) {
        return habitService.interpretVoiceTranscript(request);
    }
}
