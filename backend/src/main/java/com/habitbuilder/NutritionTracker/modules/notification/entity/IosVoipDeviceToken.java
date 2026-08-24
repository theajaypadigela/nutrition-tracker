package com.habitbuilder.NutritionTracker.modules.notification.entity;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Getter;
import lombok.Setter;

@Document(collection = "ios_voip_device_tokens")
@CompoundIndex(
        name = "ios_voip_environment_token_hash_unique",
        def = "{'environment': 1, 'tokenHash': 1}",
        unique = true)
@Getter
@Setter
public class IosVoipDeviceToken {

    @Id
    private String id;

    @Indexed
    private String userId;

    /** Hex-encoded PushKit token. Never include this field in logs or API responses. */
    private String token;

    /** SHA-256 lookup fingerprint so routine Mongo query logs never contain the token. */
    private String tokenHash;

    /** {@code sandbox} and {@code production} tokens are not interchangeable. */
    private String environment;

    private boolean enabled = true;

    private Instant createdAt;

    private Instant updatedAt;
}
