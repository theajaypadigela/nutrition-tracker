package com.habitbuilder.NutritionTracker.modules.notification.service;

import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;

public interface ApnsVoipSender {

    boolean isAvailable();

    ApnsDeliveryResult send(IosVoipDeviceToken deviceToken, VoipCallPayload payload);
}
