package com.habitbuilder.NutritionTracker.modules.voice.session;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.modules.voice.VoiceMealSession;
import com.habitbuilder.NutritionTracker.modules.voice.VoiceMealSessionRepository;

/**
 * Owns the {@link VoiceMealSession} audit trail. Every voice log — webhook or transcript —
 * opens a PENDING record before doing any work and closes it as COMPLETED or FAILED, so a
 * call that vanishes mid-flight still leaves a row explaining how far it got.
 *
 * <p>Callers no longer touch the repository or the status enum; that is the point. The
 * session is deliberately saved at each transition rather than once at the end, because a
 * crash between transitions is exactly the case the audit trail exists for.
 */
@Component
public class VoiceSessionRecorder {

    private final VoiceMealSessionRepository sessionRepository;

    public VoiceSessionRecorder(VoiceMealSessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    /** Opens a session for a Vapi webhook, whose user and date are not yet known. */
    public VoiceMealSession startWebhookSession(String rawTranscript, String payloadSnapshot) {
        VoiceMealSession session = new VoiceMealSession();
        session.setStatus(VoiceMealSession.SessionStatus.PENDING);
        session.setCreatedAt(LocalDateTime.now());
        session.setRawTranscript(rawTranscript);
        session.setPayloadSnapshot(payloadSnapshot);
        return sessionRepository.save(session);
    }

    /** Opens a session for an authenticated transcript parse, where user and date are known. */
    public VoiceMealSession startTranscriptSession(String userId, LocalDate logDate, String rawTranscript) {
        VoiceMealSession session = new VoiceMealSession();
        session.setUserId(userId);
        session.setLogDate(logDate);
        session.setRawTranscript(rawTranscript);
        session.setStatus(VoiceMealSession.SessionStatus.PENDING);
        session.setCreatedAt(LocalDateTime.now());
        return sessionRepository.save(session);
    }

    /** Persists fields the caller filled in after the session was opened. */
    public void save(VoiceMealSession session) {
        sessionRepository.save(session);
    }

    public void complete(VoiceMealSession session) {
        session.setStatus(VoiceMealSession.SessionStatus.COMPLETED);
        session.setCompletedAt(LocalDateTime.now());
        session.setFailureReason(null);
        sessionRepository.save(session);
    }

    public void fail(VoiceMealSession session, Exception cause) {
        session.setStatus(VoiceMealSession.SessionStatus.FAILED);
        session.setFailureReason(failureReasonOf(cause));
        sessionRepository.save(session);
    }

    /**
     * The recorded reason. {@link ResponseStatusException#getMessage()} prefixes the status
     * ({@code 422 UNPROCESSABLE_ENTITY "..."}); the bare reason is what belongs in the audit
     * field, and is what was stored before these failures carried a status at all.
     */
    private static String failureReasonOf(Exception cause) {
        if (cause instanceof ResponseStatusException statusException && statusException.getReason() != null) {
            return statusException.getReason();
        }
        return cause.getMessage();
    }
}
