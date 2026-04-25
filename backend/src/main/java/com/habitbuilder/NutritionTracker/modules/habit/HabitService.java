package com.habitbuilder.NutritionTracker.modules.habit;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiTextService;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;

@Service
public class HabitService {

    private static final Logger log = LoggerFactory.getLogger(HabitService.class);

    private HabitRepository habitRepository;
    private HabitEntityRepository habitEntityRepository;
    private AiTextService aiTextService;
    private ObjectMapper objectMapper;

    HabitService(
            HabitRepository habitRepository,
            HabitEntityRepository habitEntityRepository,
            AiTextService aiTextService,
            ObjectMapper objectMapper) {
        this.habitRepository = habitRepository;
        this.habitEntityRepository = habitEntityRepository;
        this.aiTextService = aiTextService;
        this.objectMapper = objectMapper;
    }

    public Habit addHabit(HabitDTO habitDto) {
        User currentUser = getCurrentUser();

        Habit newHabit = new Habit();
        newHabit.setName(habitDto.getName());
        newHabit.setRepeatDays(Arrays.asList(habitDto.getRepeatDays()));
        newHabit.setReminderTime(parseReminderTime(habitDto.getReminderTime()));
        newHabit.setReminderType(habitDto.getReminderType());
        newHabit.setUserId(currentUser.getId());

        return habitRepository.save(newHabit);
    }

    private LocalTime parseReminderTime(String rawReminderTime) {
        if (rawReminderTime == null || rawReminderTime.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reminderTime is required");
        }

        String value = rawReminderTime.trim();
        DateTimeFormatter[] acceptedFormats = new DateTimeFormatter[] {
                DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH),
                DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH),
                DateTimeFormatter.ofPattern("HH:mm"),
                DateTimeFormatter.ISO_LOCAL_TIME
        };

        for (DateTimeFormatter formatter : acceptedFormats) {
            try {
                return LocalTime.parse(value, formatter);
            } catch (DateTimeParseException ignored) {
                // Try the next accepted format.
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid reminderTime format. Use hh:mm AM/PM or HH:mm");
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication.getPrincipal();
        if (principal instanceof User user) {
            return user;
        }

        throw new IllegalStateException("User not authenticated");
    }

    public List<HabitWithCompletionDTO> getPresentDayHabits() {
        return getHabitsByDate(LocalDate.now());
    }

    public List<HabitWithCompletionDTO> getHabitsByDate(LocalDate date) {
        User currentUser = getCurrentUser();
        String raw = date.getDayOfWeek().toString().substring(0, 3);
        String dayOfWeek = raw.substring(0, 1) + raw.substring(1).toLowerCase();

        System.out.println(
                "Fetching habits for user: " + currentUser.getId() + " on date: " + date + " (day: " + dayOfWeek + ")");

        List<Habit> habits = habitRepository.findByUserIdAndRepeatDaysContaining(currentUser.getId(), dayOfWeek);

        return habits.stream()
                .map(habit -> {
                    HabitWithCompletionDTO dto = new HabitWithCompletionDTO();
                    dto.setId(habit.getId());
                    dto.setName(habit.getName());
                    dto.setRepeatDays(habit.getRepeatDays().toArray(new String[0]));
                    dto.setReminderTime(habit.getReminderTime());
                    dto.setReminderType(habit.getReminderType());

                    // Check habit status on the specified date
                    habitEntityRepository
                            .findFirstByHabitIdAndUserIdAndEntryDateOrderByIdDesc(
                                    habit.getId(),
                                    currentUser.getId(),
                                    date)
                            .ifPresentOrElse(entity -> {
                                dto.setCompleted(entity.getStatus() == HabitStatus.COMPLETED);
                                dto.setStatus(entity.getStatus().name());
                                dto.setCompletedAt(entity.getCompletionTime());
                                dto.setRescheduledTime(entity.getRescheduledTime());
                            }, () -> {
                                dto.setCompleted(false);
                                dto.setStatus("PENDING");
                            });

                    return dto;
                })
                .toList();
    }

    public void toggleHabit(HabitCompletionDTO habitCompletion) {
        User currentUser = getCurrentUser();
        LocalDate today = LocalDate.now();

        String habitId = habitCompletion.getId();
        if (habitId == null) {
            throw new IllegalArgumentException("Habit ID is required");
        }

        // Get the habit by ID and verify it belongs to the user
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new IllegalArgumentException("Habit not found"));

        if (!habit.getUserId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Habit does not belong to user");
        }

        // Create or update habit entity for today
        HabitEntity habitEntity = habitEntityRepository
            .findFirstByHabitIdAndUserIdAndEntryDateOrderByIdDesc(
                        habit.getId(),
                        currentUser.getId(),
                        today)
                .orElseGet(() -> {
                    HabitEntity newEntity = new HabitEntity();
                    newEntity.setHabitId(habit.getId());
                    newEntity.setUserId(currentUser.getId());
                    newEntity.setEntryDate(today);
                    return newEntity;
                });

        // check current status and toggle
        if (habitEntity.getStatus() == HabitStatus.COMPLETED) {
            habitEntity.setStatus(HabitStatus.PENDING);
            habitEntity.setCompletionTime(null);
            habitEntity.setRescheduledTime(null);
        } else {
            habitEntity.setStatus(HabitStatus.COMPLETED);
            habitEntity.setCompletionTime(java.time.LocalTime.now().toString());
            habitEntity.setRescheduledTime(null);
        }
        habitEntityRepository.save(habitEntity);
    }

    public void deleteHabit(String id) {
        User currentUser = getCurrentUser();

        // Get the habit by ID and verify it belongs to the user
        Habit habit = habitRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Habit not found"));

        if (!habit.getUserId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Habit does not belong to user");
        }

        habitRepository.delete(habit);
    }

    public HabitWithCompletionDTO processVoiceResult(HabitVoiceResultDTO result) {
        User currentUser = getCurrentUser();
        LocalDate today = LocalDate.now();

        log.info("Received habit voice result: userId={}, habitId={}, status={}, rescheduleMinutes={}",
                currentUser.getId(), result.getHabitId(), result.getHabitStatus(), result.getRescheduleMinutes());

        String habitId = result.getHabitId();
        if (habitId == null) {
            throw new IllegalArgumentException("Habit ID is required");
        }

        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new IllegalArgumentException("Habit not found"));

        if (!habit.getUserId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Habit does not belong to user");
        }

        HabitEntity habitEntity = habitEntityRepository
            .findFirstByHabitIdAndUserIdAndEntryDateOrderByIdDesc(
                        habit.getId(),
                        currentUser.getId(),
                        today)
                .orElseGet(() -> {
                    HabitEntity newEntity = new HabitEntity();
                    newEntity.setHabitId(habit.getId());
                    newEntity.setUserId(currentUser.getId());
                    newEntity.setEntryDate(today);
                    return newEntity;
                });

        String status = result.getHabitStatus();
        if ("completed".equals(status)) {
            habitEntity.setStatus(HabitStatus.COMPLETED);
            habitEntity.setCompletionTime(result.getCompletedAt() != null
                    ? result.getCompletedAt()
                    : java.time.LocalTime.now().toString());
            habitEntity.setRescheduledTime(null);
        } else if ("rescheduled".equals(status)) {
            habitEntity.setStatus(HabitStatus.RESCHEDULED);
            habitEntity.setCompletionTime(null);
            if (result.getRescheduleMinutes() != null && result.getRescheduleMinutes() > 0) {
                habitEntity.setRescheduledTime(
                        LocalDateTime.now().plusMinutes(result.getRescheduleMinutes()));
            } else {
                habitEntity.setRescheduledTime(null);
            }
        } else {
            habitEntity.setStatus(HabitStatus.MISSED);
            habitEntity.setCompletionTime(null);
            habitEntity.setRescheduledTime(null);
        }

        habitEntityRepository.save(habitEntity);

        log.info("Saved habit voice result: userId={}, habitId={}, storedStatus={}, rescheduledTime={}",
                currentUser.getId(), habit.getId(), habitEntity.getStatus(), habitEntity.getRescheduledTime());

        // Build response DTO
        HabitWithCompletionDTO dto = new HabitWithCompletionDTO();
        dto.setId(habit.getId());
        dto.setName(habit.getName());
        dto.setRepeatDays(habit.getRepeatDays().toArray(new String[0]));
        dto.setReminderTime(habit.getReminderTime());
        dto.setReminderType(habit.getReminderType());
        dto.setCompleted(habitEntity.getStatus() == HabitStatus.COMPLETED);
        dto.setStatus(habitEntity.getStatus().name());
        dto.setCompletedAt(habitEntity.getCompletionTime());
        dto.setRescheduledTime(habitEntity.getRescheduledTime());

        return dto;
    }

    public HabitVoiceInterpretResponseDTO interpretVoiceTranscript(HabitVoiceInterpretRequestDTO request) {
        HabitVoiceInterpretResponseDTO response = new HabitVoiceInterpretResponseDTO();
        response.setHabitStatus("not_completed");

        if (request == null || request.getTranscriptLines() == null || request.getTranscriptLines().isEmpty()) {
            response.setRationale("No transcript provided");
            return response;
        }

        String transcript = String.join("\n", request.getTranscriptLines());
        String habitName = request.getHabitName() != null ? request.getHabitName() : "Habit";
        String habitTime = request.getHabitTime() != null ? request.getHabitTime() : "";

        String prompt = """
                You are classifying a habit check-in voice transcript.

                Return ONLY a JSON object with this exact shape:
                {
                  "habitStatus": "completed" | "rescheduled" | "not_completed",
                  "rescheduleMinutes": number or null,
                  "rationale": "short explanation"
                }

                Rules:
                1) Choose completed when the user confirms they already did/finished/completed the habit.
                2) Choose rescheduled when the user asks to be called, reminded, pinged, or checked again later.
                   Examples: "call me in 10 minutes", "remind me after 15 mins", "check again in one hour",
                   "not now, later", or the user confirming a later time proposed by the assistant.
                3) A reschedule request means the habit is not missed; it should be followed up later.
                4) If status is rescheduled, provide rescheduleMinutes when inferable from transcript, else null.
                5) If the user only declines without asking for a later call, choose not_completed.
                6) If unsure, choose not_completed.
                7) Never include markdown or extra text.

                Context:
                habitName: %s
                scheduledTime: %s

                Transcript:
                %s
                """.formatted(habitName, habitTime, transcript);

        try {
            String modelText = aiTextService.callRawPrompt(prompt);
            String jsonText = extractJson(modelText);
            JsonNode root = objectMapper.readTree(jsonText);

            String habitStatus = normalizeHabitStatus(root.path("habitStatus").asText(null));
            Integer rescheduleMinutes = root.path("rescheduleMinutes").isNumber()
                    ? root.path("rescheduleMinutes").asInt()
                    : null;
            String rationale = root.path("rationale").asText("classified_by_ai");

            if (rescheduleMinutes != null && rescheduleMinutes <= 0) {
                rescheduleMinutes = null;
            }

            response.setHabitStatus(habitStatus);
            response.setRescheduleMinutes(
                    rescheduleMinutes != null && rescheduleMinutes > 0 ? rescheduleMinutes : null);
            response.setRationale(rationale);

            log.info("Interpreted habit transcript: status={}, rescheduleMinutes={}, rationale={}",
                    response.getHabitStatus(), response.getRescheduleMinutes(), response.getRationale());
            return response;
        } catch (Exception e) {
            log.warn("AI transcript interpretation failed: {}", e.getMessage());
            response.setRationale("ai_interpretation_failed");
            return response;
        }
    }

    private String extractJson(String text) {
        if (text == null) {
            return "{}";
        }

        String cleaned = text.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7).trim();
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3).trim();
        }

        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3).trim();
        }

        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start != -1 && end != -1 && end > start) {
            return cleaned.substring(start, end + 1);
        }

        return cleaned;
    }

    private String normalizeHabitStatus(String raw) {
        if (raw == null) {
            return "not_completed";
        }

        String normalized = raw.trim().toLowerCase();
        if ("completed".equals(normalized)) {
            return "completed";
        }
        if ("rescheduled".equals(normalized)) {
            return "rescheduled";
        }
        return "not_completed";
    }
}
