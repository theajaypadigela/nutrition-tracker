package com.habitbuilder.NutritionTracker.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Driver-level timeouts applied to the Mongo client ({@code mongo.*}).
 *
 * <p>Deliberately not under {@code spring.data.mongodb.*}: these feed a
 * {@code MongoClientSettingsBuilderCustomizer}, not Boot's own Mongo properties, and sharing
 * the prefix would make it look as though Boot were binding them.
 */
@ConfigurationProperties("mongo")
public record MongoTuningProperties(
        @DefaultValue("20000") int connectTimeoutMs,
        @DefaultValue("20000") int socketReadTimeoutMs,
        @DefaultValue("45000") int serverSelectionTimeoutMs,
        @DefaultValue("10000") int heartbeatFrequencyMs) {
}
