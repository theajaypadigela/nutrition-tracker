package com.habitbuilder.NutritionTracker.modules.notification.service;

import java.util.Map;

/** Payload consumed by the native iOS PushKit/CallKit bridge. */
public record VoipCallPayload(
        Map<String, Object> aps,
        String callUUID,
        String type,
        String kind,
        String habitId,
        String habitName,
        String habitTime,
        long intendedFireAt,
        String slotKey) {
}
