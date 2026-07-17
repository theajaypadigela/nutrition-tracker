package com.habitbuilder.NutritionTracker.modules.food;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.food.dto.InsightResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.WeeklyNutritionReport;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiTextService;

/**
 * AI-generated coaching insights over a week of nutrition data, cached
 * per user+range so repeated dashboard loads don't re-hit the LLM.
 */
@Service
public class NutritionInsightsService {

    private static final Logger logger = LoggerFactory.getLogger(NutritionInsightsService.class);
    private static final long CACHE_TTL_MINUTES = 60;
    private static final long FAILURE_CACHE_TTL_MINUTES = 10; // retry sooner after a fallback

    private final NutritionReportService nutritionReportService;
    private final UserNutrientPreferenceRepository preferenceRepository;
    private final AiTextService aiTextService;
    private final ObjectMapper objectMapper;
    private final CurrentUserProvider currentUserProvider;

    private final Map<String, CachedInsights> insightsCache = new ConcurrentHashMap<>();

    public NutritionInsightsService(
            NutritionReportService nutritionReportService,
            UserNutrientPreferenceRepository preferenceRepository,
            AiTextService aiTextService,
            ObjectMapper objectMapper,
            CurrentUserProvider currentUserProvider) {
        this.nutritionReportService = nutritionReportService;
        this.preferenceRepository = preferenceRepository;
        this.aiTextService = aiTextService;
        this.objectMapper = objectMapper;
        this.currentUserProvider = currentUserProvider;
    }

    public List<InsightResponse> getAiInsights(LocalDate startDate, LocalDate endDate) {
        User user = currentUserProvider.currentUser();

        String cacheKey = user.getId() + "_" + startDate + "_" + endDate;
        CachedInsights cached = insightsCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            logger.info("Returning cached AI insights for user {} (cached at {})", user.getId(), cached.timestamp());
            return cached.insights();
        }

        WeeklyNutritionReport report = nutritionReportService.getWeeklyNutritionReport(startDate, endDate);
        NutritionTotals avg = report.getWeeklyAverage();

        try {
            List<InsightResponse> insights = requestInsights(user, avg);
            logger.info("AI insights generated for user {}: {} insights", user.getId(), insights.size());
            insightsCache.put(cacheKey, new CachedInsights(insights, Instant.now(), CACHE_TTL_MINUTES));
            return insights;
        } catch (Exception e) {
            logger.warn("Failed to generate AI insights, using fallback. Error: {}", e.getMessage());
            List<InsightResponse> fallback = getFallbackInsights(avg);
            insightsCache.put(cacheKey, new CachedInsights(fallback, Instant.now(), FAILURE_CACHE_TTL_MINUTES));
            return fallback;
        }
    }

    private List<InsightResponse> requestInsights(User user, NutritionTotals avg) throws Exception {
        StringBuilder avoidedSection = new StringBuilder();
        for (UserNutrientPreference p : preferenceRepository.findByUserId(user.getId())) {
            if (p.getAvoidedFoods() != null && !p.getAvoidedFoods().isEmpty()) {
                avoidedSection.append(String.format("- %s: avoid %s\n", p.getNutrientId(), p.getAvoidedFoods()));
            }
        }

        String prompt = String.format(
                """
                        You are a personal nutrition coach. Analyze the following weekly nutrition data for a %s year old %s.

                        Weekly Averages:
                        - Calories: %.0f kcal
                        - Protein: %.1f g
                        - Carbs: %.1f g
                        - Fat: %.1f g
                        - Fiber: %.1f g
                        - Sugar: %.1f g
                        - Sodium: %.1f mg

                        %s

                        Provide 3-5 concise, actionable insights. Each should be one sentence.
                        Respond ONLY with a JSON array of objects, each with "variant" (one of: "positive", "negative", "neutral") and "message" (string).
                        Example: [{"variant":"positive","message":"Great protein intake!"}]
                        No extra text, just the JSON array.
                        """,
                user.getDerivedAge(), user.getGender(),
                avg.getCalories(), avg.getProtein(), avg.getCarbs(), avg.getFat(),
                avg.getFiber(), avg.getSugar(), avg.getSodium(),
                avoidedSection.length() > 0 ? "Foods to avoid:\n" + avoidedSection : "");

        String text = aiTextService.callRawPrompt(prompt);

        int start = text.indexOf('[');
        int end = text.lastIndexOf(']');
        if (start == -1 || end == -1)
            throw new IllegalStateException("No JSON array in insights response");

        JsonNode insightsNode = objectMapper.readTree(text.substring(start, end + 1));
        List<InsightResponse> insights = new ArrayList<>();
        for (JsonNode node : insightsNode) {
            insights.add(InsightResponse.builder()
                    .variant(node.path("variant").asText("neutral"))
                    .message(node.path("message").asText())
                    .build());
        }
        return insights;
    }

    private List<InsightResponse> getFallbackInsights(NutritionTotals avg) {
        List<InsightResponse> fallback = new ArrayList<>();
        if (avg.getFiber() != null && avg.getFiber() < 25) {
            fallback.add(InsightResponse.builder().variant("negative")
                    .message("Fiber is low this week — add oats, veggies and fruits to your diet.").build());
        }
        if (avg.getSugar() != null && avg.getSugar() > 50) {
            fallback.add(InsightResponse.builder().variant("negative")
                    .message("Sugar is high this week — reduce sugary drinks and desserts.").build());
        }
        if (avg.getProtein() != null && avg.getProtein() >= 150) {
            fallback.add(InsightResponse.builder().variant("positive")
                    .message("Great protein intake! Keep it up.").build());
        } else if (avg.getProtein() != null && avg.getProtein() < 120) {
            fallback.add(InsightResponse.builder().variant("neutral")
                    .message("Consider adding more protein to your diet.").build());
        }
        if (fallback.isEmpty()) {
            fallback.add(InsightResponse.builder().variant("neutral")
                    .message("Start logging your meals to get personalized insights!").build());
        }
        return fallback;
    }

    private record CachedInsights(List<InsightResponse> insights, Instant timestamp, long ttlMinutes) {

        boolean isExpired() {
            return Instant.now().isAfter(timestamp.plusSeconds(ttlMinutes * 60));
        }
    }
}
