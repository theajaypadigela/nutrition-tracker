package com.habitbuilder.NutritionTracker.modules.notification.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;
import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;
import com.habitbuilder.NutritionTracker.modules.notification.entity.VoipCallDispatch;
import com.habitbuilder.NutritionTracker.modules.notification.repository.VoipCallDispatchRepository;

@Service
public class VoipDispatchLedgerService {

    public record Claim(String dispatchKey, int attemptCount) {
    }

    private final VoipCallDispatchRepository repository;
    private final MongoTemplate mongoTemplate;
    private final ApnsVoipProperties properties;
    private final Clock clock;

    public VoipDispatchLedgerService(
            VoipCallDispatchRepository repository,
            MongoTemplate mongoTemplate,
            ApnsVoipProperties properties,
            Clock clock) {
        this.repository = repository;
        this.mongoTemplate = mongoTemplate;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Atomically claims a device delivery. A unique insert wins the first attempt; only an
     * explicitly retryable response can be claimed again. A process crash leaves CLAIMED in place
     * (at-most-once) rather than risking a duplicate system call after an ambiguous APNs response.
     */
    public Optional<Claim> tryClaim(
            String occurrenceKey,
            IosVoipDeviceToken deviceToken,
            String userId,
            String habitId,
            Instant intendedFireAt) {
        String dispatchKey = dispatchKey(occurrenceKey, deviceToken.getToken());
        Instant now = clock.instant();

        VoipCallDispatch first = new VoipCallDispatch();
        first.setDispatchKey(dispatchKey);
        first.setOccurrenceKey(occurrenceKey);
        first.setUserId(userId);
        first.setHabitId(habitId);
        first.setIntendedFireAt(intendedFireAt);
        first.setDeviceTokenId(deviceToken.getId());
        first.setStatus(VoipCallDispatch.Status.CLAIMED);
        first.setAttemptCount(1);
        first.setClaimedAt(now);

        try {
            repository.insert(first);
            return Optional.of(new Claim(dispatchKey, 1));
        } catch (DuplicateKeyException alreadyClaimed) {
            // A prior attempt may be retried only after a concrete retryable APNs/network result.
            Query query = Query.query(Criteria.where("dispatchKey").is(dispatchKey)
                    .and("status").is(VoipCallDispatch.Status.RETRYABLE_FAILURE)
                    .and("nextAttemptAt").lte(now)
                    .and("attemptCount").lt(properties.effectiveMaxAttempts()));
            Update update = new Update()
                    .set("status", VoipCallDispatch.Status.CLAIMED)
                    .set("claimedAt", now)
                    .unset("nextAttemptAt")
                    .inc("attemptCount", 1);
            VoipCallDispatch retried = mongoTemplate.findAndModify(
                    query,
                    update,
                    FindAndModifyOptions.options().returnNew(true),
                    VoipCallDispatch.class);
            return retried == null
                    ? Optional.empty()
                    : Optional.of(new Claim(dispatchKey, retried.getAttemptCount()));
        }
    }

    public void recordAccepted(Claim claim) {
        updateClaim(claim, new Update()
                .set("status", VoipCallDispatch.Status.ACCEPTED)
                .set("acceptedAt", clock.instant())
                .set("lastReason", "Success")
                .unset("nextAttemptAt"));
    }

    public void recordFailure(Claim claim, ApnsDeliveryResult result) {
        boolean retryable = result.outcome() == ApnsDeliveryResult.Outcome.RETRYABLE_FAILURE
                && claim.attemptCount() < properties.effectiveMaxAttempts();
        Update update = new Update()
                .set("status", retryable
                        ? VoipCallDispatch.Status.RETRYABLE_FAILURE
                        : VoipCallDispatch.Status.TERMINAL_FAILURE)
                .set("lastReason", sanitizeReason(result.reason()));
        if (retryable) {
            update.set("nextAttemptAt", clock.instant()
                    .plusSeconds(properties.effectiveRetryBackoffSeconds()));
        } else {
            update.unset("nextAttemptAt");
        }
        updateClaim(claim, update);
    }

    private void updateClaim(Claim claim, Update update) {
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("dispatchKey").is(claim.dispatchKey())
                        .and("status").is(VoipCallDispatch.Status.CLAIMED)
                        .and("attemptCount").is(claim.attemptCount())),
                update,
                VoipCallDispatch.class);
    }

    static String dispatchKey(String occurrenceKey, String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((occurrenceKey + "\u0000" + token)
                    .getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static String sanitizeReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return "Unknown";
        }
        String safe = reason.replaceAll("[^A-Za-z0-9_.-]", "_");
        return safe.substring(0, Math.min(safe.length(), 128));
    }
}
