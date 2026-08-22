package com.habitbuilder.NutritionTracker.modules.nutrition.ai;

public interface AiTextClient {
    String getProviderName();

    String callRawPrompt(String prompt);
}
