package com.habitbuilder.NutritionTracker.modules.habit;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiJsonSupport;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiTextService;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.auth.repository.UserRepository;

@Service
public class HabitService {

    private static final Logger log = LoggerFactory.getLogger(HabitService.class);

    // Fallback delay applied when the model classifies a check-in as "rescheduled" but gives no
    // (or a non-positive) minute value. Without this, a RESCHEDULED entity could be stored with
    // rescheduledTime=null, which the reminder cron's time-window query can never re-surface.
    private static final int DEFAULT_RESCHEDULE_MINUTES = 15;

    private final HabitRepository habitRepository;
    private final HabitEntityRepository habitEntityRepository;
    private final AiTextService aiTextService;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final CurrentUserProvider currentUserProvider;

    HabitService(
            HabitRepository habitRepository,
            HabitEntityRepository habitEntityRepository,
            AiTextService aiTextService,
            ObjectMapper objectMapper,
            UserRepository userRepository,
            CurrentUserProvider currentUserProvider) {
        this.habitRepository = habitRepository;
        this.habitEntityRepository = habitEntityRepository;
        this.aiTextService = aiTextService;
        this.objectMapper = objectMapper;
        this.userRepository = userRepository;
        this.currentUserProvider = currentUserProvider;
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
        return currentUserProvider.currentUser();
    }

    /** The user's timezone, falling back to the server zone when not yet known. */
    private ZoneId zoneFor(User user) {
        String tz = user.getTimezone();
        if (tz != null && !tz.isBlank()) {
            try {
                return ZoneId.of(tz);
            } catch (Exception ignored) {
                // Fall through to the system default on an invalid id.
            }
        }
        return ZoneId.systemDefault();
    }

    public List<HabitWithCompletionDTO> getPresentDayHabits() {
        // Timezone-aware "today": evaluate the current date in the user's zone so client
        // and server agree near midnight / across timezones.
        ZoneId zone = zoneFor(getCurrentUser());
        return getHabitsByDate(LocalDate.now(zone));
    }

    /** All habits for the current user, for the device reconciliation pass. The optional
     *  timezone is captured on every reconciliation so server-side "today" stays correct. */
    public List<Habit> getAllHabitsForCurrentUser(String timezone) {
        User currentUser = getCurrentUser();
        persistTimezone(currentUser, timezone);
        return habitRepository.findByUserId(currentUser.getId());
    }

    private void persistTimezone(User user, String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return;
        }
        if (timezone.equals(user.getTimezone())) {
            return;
        }
        try {
            ZoneId.of(timezone); // validate before storing
            user.setTimezone(timezone);
            userRepository.save(user);
        } catch (Exception ignored) {
            // Ignore an invalid timezone id rather than failing the request.
        }
    }

    /**
     * Records a terminal occurrence status (MISSED/DECLINED) for today. When a habitId is
     * given it targets that habit; otherwise it targets every habit at the given
     * reminderTime (a consolidated call slot). A habit already COMPLETED today is left
     * untouched.
     */
    public void recordOccurrenceStatus(HabitOccurrenceStatusDTO request) {
        User currentUser = getCurrentUser();
        persistTimezone(currentUser, request.getTimezone());
        LocalDate today = LocalDate.now(zoneFor(currentUser));

        HabitStatus status;
        if ("DECLINED".equalsIgnoreCase(request.getStatus())) {
            status = HabitStatus.DECLINED;
        } else {
            status = HabitStatus.MISSED;
        }

        List<Habit> targets;
        if (request.getHabitId() != null && !request.getHabitId().isBlank()) {
            targets = habitRepository.findById(request.getHabitId())
                    .filter(h -> currentUser.getId().equals(h.getUserId()))
                    .map(List::of)
                    .orElse(List.of());
        } else if (request.getReminderTime() != null && !request.getReminderTime().isBlank()) {
            LocalTime time = parseReminderTime(request.getReminderTime());
            targets = habitRepository.findByUserIdAndReminderTime(currentUser.getId(), time);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "habitId or reminderTime is required");
        }

        for (Habit habit : targets) {
            HabitEntity entity = habitEntityRepository
                    .findFirstByHabitIdAndUserIdAndEntryDateOrderByIdDesc(
                            habit.getId(), currentUser.getId(), today)
                    .orElseGet(() -> {
                        HabitEntity fresh = new HabitEntity();
                        fresh.setHabitId(habit.getId());
                        fresh.setUserId(currentUser.getId());
                        fresh.setEntryDate(today);
                        return fresh;
                    });

            // Don't overwrite a completed or rescheduled habit with a miss/decline.
            if (entity.getStatus() == HabitStatus.COMPLETED
                    || entity.getStatus() == HabitStatus.RESCHEDULED) {
                continue;
            }

            entity.setStatus(status);
            entity.setCompletionTime(null);
            entity.setRescheduledTime(null);
            habitEntityRepository.save(entity);
        }

        log.info("Recorded habit occurrence status={} for {} habit(s), user={}",
                status, targets.size(), currentUser.getId());
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
        LocalDate today = LocalDate.now(zoneFor(currentUser));

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
        LocalDate today = LocalDate.now(zoneFor(currentUser));

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
            // Always store a concrete rescheduledTime. A RESCHEDULED entity with a null time is
            // never re-surfaced by HabitReminderScheduler's window query and shows no time in the
            // Habits list, so fall back to a default delay when minutes are missing/non-positive.
            int rescheduleMinutes =
                    (result.getRescheduleMinutes() != null && result.getRescheduleMinutes() > 0)
                            ? result.getRescheduleMinutes()
                            : DEFAULT_RESCHEDULE_MINUTES;
            habitEntity.setRescheduledTime(LocalDateTime.now().plusMinutes(rescheduleMinutes));
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
            response.setRationale(AiJsonSupport.RATIONALE_NO_TRANSCRIPT);
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
                4) If status is rescheduled, extract rescheduleMinutes from the transcript (e.g., "call me in 5
                   minutes" → 5, "remind me in an hour" → 60). If the user asks to reschedule but does not
                   mention a specific time, return 30 as the default. Only return null when status is NOT
                   rescheduled.
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
            String jsonText = AiJsonSupport.extractJson(modelText);
            JsonNode root = objectMapper.readTree(jsonText);

            String habitStatus = normalizeHabitStatus(root.path("habitStatus").asText(null));
            Integer rescheduleMinutes = root.path("rescheduleMinutes").isNumber()
                    ? root.path("rescheduleMinutes").asInt()
                    : null;
            String rationale = root.path("rationale").asText(AiJsonSupport.RATIONALE_CLASSIFIED);

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
            response.setRationale(AiJsonSupport.RATIONALE_FAILED);
            return response;
        }
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
