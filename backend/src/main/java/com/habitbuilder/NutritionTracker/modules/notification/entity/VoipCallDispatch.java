package com.habitbuilder.NutritionTracker.modules.notification.entity;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Getter;
import lombok.Setter;

/** Per-occurrence, per-installation APNs delivery ledger. */
@Document(collection = "ios_voip_call_dispatches")
@Getter
@Setter
public class VoipCallDispatch {

    public enum Status {
        CLAIMED,
        ACCEPTED,
        RETRYABLE_FAILURE,
        TERMINAL_FAILURE
    }

    @Id
    private String id;

    /** SHA-256 occurrence/device fingerprint; unique insertion is the send claim. */
    @Indexed(unique = true)
    private String dispatchKey;

    @Indexed
    private String occurrenceKey;

    private String userId;

    private String habitId;

    private Instant intendedFireAt;

    private String deviceTokenId;

    private Status status;

    private int attemptCount;

    private Instant claimedAt;

    private Instant acceptedAt;

    private Instant nextAttemptAt;

    /** Sanitized APNs reason code only; never a token, key, payload, or exception message. */
    private String lastReason;
}
