package com.habitbuilder.NutritionTracker.modules.auth.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.springframework.stereotype.Component;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;

@Component
public class UserTimeZone {

    private final Clock clock;

    public UserTimeZone(Clock clock) {
        this.clock = clock;
    }

    public LocalDate today(User user) {
        return LocalDate.ofInstant(clock.instant(), zoneId(user));
    }

    public LocalTime localTime(User user) {
        return LocalTime.ofInstant(clock.instant(), zoneId(user));
    }

    public LocalDateTime localDateTime(User user) {
        return LocalDateTime.ofInstant(clock.instant(), zoneId(user));
    }

    public ZoneId zoneId(User user) {
        String timezone = user != null ? user.getTimezone() : null;
        if (timezone == null || timezone.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(timezone);
        } catch (RuntimeException ignored) {
            return ZoneOffset.UTC;
        }
    }
}
