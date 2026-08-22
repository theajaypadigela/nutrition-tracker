package com.habitbuilder.NutritionTracker.modules.voice.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "voice_meal_sessions")
@Getter
@Setter
@NoArgsConstructor
public class VoiceMealSession {

    @Id
    private String id;

    private String userId;

    private LocalDate logDate;

    private String rawTranscript;

    private String payloadSnapshot;

    private String failureReason;

    private SessionStatus status = SessionStatus.PENDING;

    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    public enum SessionStatus {
        PENDING, COMPLETED, FAILED
    }
}
