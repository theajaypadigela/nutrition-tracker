package com.habitbuilder.NutritionTracker.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.time.LocalTime;
import java.util.List;

@Configuration
@EnableMongoAuditing
public class MongoConfig {

    @Bean
    public MongoCustomConversions customConversions() {
        return new MongoCustomConversions(List.of(
                new LocalTimeToStringConverter(),
                new StringToLocalTimeConverter()));
    }

    // LocalTime <-> String converters
    private static class LocalTimeToStringConverter implements Converter<LocalTime, String> {
        @Override
        public String convert(LocalTime source) {
            return source.toString();
        }
    }

    private static class StringToLocalTimeConverter implements Converter<String, LocalTime> {
        @Override
        public LocalTime convert(String source) {
            return LocalTime.parse(source);
        }
    }
}
