package com.habitbuilder.NutritionTracker.modules.nutrition;

public interface AiTextClient {
    String getProviderName();

    String callRawPrompt(String prompt);
}
