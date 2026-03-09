package com.habitbuilder.NutritionTracker.modules.voice;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "voice_meal_sessions")
@Getter
@Setter
@NoArgsConstructor
public class VoiceMealSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private LocalDate logDate;

    @Column(columnDefinition = "TEXT")
    private String rawTranscript;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status = SessionStatus.PENDING;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    public enum SessionStatus {
        PENDING, COMPLETED, FAILED
    }
}
