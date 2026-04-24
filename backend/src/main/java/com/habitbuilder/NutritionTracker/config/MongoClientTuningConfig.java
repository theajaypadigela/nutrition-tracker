package com.habitbuilder.NutritionTracker.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.mongo.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class MongoClientTuningConfig {

    @Bean
    public MongoClientSettingsBuilderCustomizer mongoClientSettingsBuilderCustomizer(
            @Value("${mongo.connect-timeout-ms:20000}") int connectTimeoutMs,
            @Value("${mongo.socket-read-timeout-ms:20000}") int socketReadTimeoutMs,
            @Value("${mongo.server-selection-timeout-ms:45000}") int serverSelectionTimeoutMs,
            @Value("${mongo.heartbeat-frequency-ms:10000}") int heartbeatFrequencyMs) {

        return builder -> builder
                .applyToSocketSettings(socketSettings -> socketSettings
                        .connectTimeout(connectTimeoutMs, TimeUnit.MILLISECONDS)
                        .readTimeout(socketReadTimeoutMs, TimeUnit.MILLISECONDS))
                .applyToClusterSettings(clusterSettings -> clusterSettings
                        .serverSelectionTimeout(serverSelectionTimeoutMs, TimeUnit.MILLISECONDS))
                .applyToServerSettings(serverSettings -> serverSettings
                        .heartbeatFrequency(heartbeatFrequencyMs, TimeUnit.MILLISECONDS));
    }
}