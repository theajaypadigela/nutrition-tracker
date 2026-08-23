package com.habitbuilder.NutritionTracker.config;

import org.springframework.boot.autoconfigure.mongo.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.habitbuilder.NutritionTracker.config.properties.MongoTuningProperties;

import java.util.concurrent.TimeUnit;

@Configuration
public class MongoClientTuningConfig {

    @Bean
    public MongoClientSettingsBuilderCustomizer mongoClientSettingsBuilderCustomizer(
            MongoTuningProperties properties) {

        return builder -> builder
                .applyToSocketSettings(socketSettings -> socketSettings
                        .connectTimeout(properties.connectTimeoutMs(), TimeUnit.MILLISECONDS)
                        .readTimeout(properties.socketReadTimeoutMs(), TimeUnit.MILLISECONDS))
                .applyToClusterSettings(clusterSettings -> clusterSettings
                        .serverSelectionTimeout(properties.serverSelectionTimeoutMs(), TimeUnit.MILLISECONDS))
                .applyToServerSettings(serverSettings -> serverSettings
                        .heartbeatFrequency(properties.heartbeatFrequencyMs(), TimeUnit.MILLISECONDS));
    }
}