package com.habitbuilder.NutritionTracker.modules.food;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.food.dto.DailyNutritionSummary;
import com.habitbuilder.NutritionTracker.modules.food.dto.NutrientSummary;
import com.habitbuilder.NutritionTracker.modules.food.dto.TopFoodSource;
import com.habitbuilder.NutritionTracker.modules.food.dto.WeeklyNutritionReport;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiJsonSupport;
import com.habitbuilder.NutritionTracker.modules.nutrition.AiTextService;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionDetails;
import com.habitbuilder.NutritionTracker.modules.nutrition.Nutrients;

/**
 * Aggregated nutrition analytics over a date range: weekly totals/averages and
 * the per-nutrient summary (trend, goal vs. intake, top food sources). Goals
 * come from AI-personalised RDIs with static defaults as fallback.
 */
@Service
public class NutritionReportService {

    private static final Logger logger = LoggerFactory.getLogger(NutritionReportService.class);

    private final FoodLogQueries foodLogQueries;
    private final UserNutrientPreferenceRepository preferenceRepository;
    private final AiTextService aiTextService;
    private final ObjectMapper objectMapper;
    private final CurrentUserProvider currentUserProvider;

    /** AI-derived RDI goals per user, kept for the lifetime of the JVM. */
    private final Map<String, Map<String, Double>> rdiCache = new ConcurrentHashMap<>();

    public NutritionReportService(
            FoodLogQueries foodLogQueries,
            UserNutrientPreferenceRepository preferenceRepository,
            AiTextService aiTextService,
            ObjectMapper objectMapper,
            CurrentUserProvider currentUserProvider) {
        this.foodLogQueries = foodLogQueries;
        this.preferenceRepository = preferenceRepository;
        this.aiTextService = aiTextService;
        this.objectMapper = objectMapper;
        this.currentUserProvider = currentUserProvider;
    }

    public WeeklyNutritionReport getWeeklyNutritionReport(LocalDate startDate, LocalDate endDate) {
        String userId = currentUserProvider.currentUserId();
        List<FoodLog> logs = foodLogQueries.findLogsInDateRange(userId, startDate, endDate);
        Map<String, List<FoodEntry>> entriesByLogId = foodLogQueries.entriesByLogId(logs);
        Map<String, NutritionDetails> nutritionMap = foodLogQueries.nutritionByEntryId(
                entriesByLogId.values().stream().flatMap(List::stream).collect(Collectors.toList()));

        List<DailyNutritionSummary> dailySummaries = new ArrayList<>();
        NutritionTotals weeklyTotals = NutritionTotals.zero();

        for (FoodLog log : logs) {
            NutritionTotals dayTotals = NutritionTotals.zero();

            for (FoodEntry entry : entriesByLogId.getOrDefault(log.getId(), List.of())) {
                NutritionDetails nutrition = nutritionMap.get(entry.getId());
                if (nutrition != null) {
                    dayTotals.add(toTotals(nutrition));
                }
            }

            dailySummaries.add(DailyNutritionSummary.builder()
                    .date(log.getLogDate())
                    .totals(dayTotals)
                    .build());

            weeklyTotals.add(dayTotals);
        }

        int daysWithData = logs.size();
        NutritionTotals weeklyAverage = daysWithData > 0
                ? weeklyTotals.dividedBy(daysWithData)
                : NutritionTotals.zero();

        return WeeklyNutritionReport.builder()
                .avgDailyCalories(weeklyAverage.getCalories())
                .weeklyTotals(weeklyTotals)
                .weeklyAverage(weeklyAverage)
                .dailySummaries(dailySummaries)
                .build();
    }

    /**
     * Returns all nutrient summaries for the given date range.
     * Nutrient RDI goals are fetched via AI using the user's age+gender.
     */
    public List<NutrientSummary> getAllNutrientsSummary(LocalDate startDate, LocalDate endDate) {
        User user = currentUserProvider.currentUser();
        String userId = user.getId();

        List<FoodLog> logs = foodLogQueries.findLogsInDateRange(userId, startDate, endDate);
        Map<String, List<FoodEntry>> entriesByLogId = foodLogQueries.entriesByLogId(logs);
        Map<String, NutritionDetails> nutritionMap = foodLogQueries.nutritionByEntryId(
                entriesByLogId.values().stream().flatMap(List::stream).collect(Collectors.toList()));

        // date -> (nutrientKey -> total for that day)
        Map<LocalDate, Map<String, Double>> dailyNutrientMap = new LinkedHashMap<>();
        LocalDate cursor = startDate;
        while (!cursor.isAfter(endDate)) {
            dailyNutrientMap.put(cursor, new HashMap<>());
            cursor = cursor.plusDays(1);
        }

        // nutrientKey -> (foodName -> total contribution over the range)
        Map<String, Map<String, Double>> sourceTotals = new HashMap<>();

        for (FoodLog log : logs) {
            Map<String, Double> dayMap = dailyNutrientMap.getOrDefault(log.getLogDate(), new HashMap<>());
            for (FoodEntry entry : entriesByLogId.getOrDefault(log.getId(), List.of())) {
                NutritionDetails nd = nutritionMap.get(entry.getId());
                if (nd == null)
                    continue;
                String foodName = entry.getName();

                for (Map.Entry<String, Double> nv : buildNutrientValues(nd).entrySet()) {
                    String key = nv.getKey();
                    double val = nv.getValue();
                    dayMap.merge(key, val, Double::sum);
                    sourceTotals.computeIfAbsent(key, k -> new HashMap<>())
                            .merge(foodName, val, Double::sum);
                }
            }
            dailyNutrientMap.put(log.getLogDate(), dayMap);
        }

        Map<String, Double> rdiGoals = rdiCache.computeIfAbsent(userId, id -> fetchRdiGoals(user));

        Map<String, UserNutrientPreference> prefMap = preferenceRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(UserNutrientPreference::getNutrientId, p -> p));

        List<NutrientSummary> summaries = new ArrayList<>();
        List<LocalDate> dateRange = new ArrayList<>(dailyNutrientMap.keySet());

        for (NutrientCatalog.NutrientMeta meta : NutrientCatalog.all()) {
            String key = meta.key();
            List<Double> trend = dateRange.stream()
                    .map(d -> dailyNutrientMap.getOrDefault(d, Map.of()).getOrDefault(key, 0.0))
                    .collect(Collectors.toList());

            double total = trend.stream().mapToDouble(Double::doubleValue).sum();
            long daysWithData = trend.stream().filter(v -> v > 0).count();
            double average = daysWithData > 0 ? total / daysWithData : 0.0;

            double goal = rdiGoals.getOrDefault(key, meta.defaultGoal());
            UserNutrientPreference pref = prefMap.get(key);
            if (pref != null && pref.getCustomTarget() != null) {
                goal = pref.getCustomTarget();
            }
            int pctDV = goal > 0 ? (int) Math.round((average / goal) * 100) : 0;

            Map<String, Double> sources = sourceTotals.getOrDefault(key, Map.of());
            double sourceTotal = sources.values().stream().mapToDouble(Double::doubleValue).sum();
            List<TopFoodSource> topSources = sources.entrySet().stream()
                    .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                    .limit(3)
                    .map(e -> TopFoodSource.builder()
                            .name(e.getKey())
                            .amount(Math.round(e.getValue() * 10.0) / 10.0)
                            .unit(meta.unit())
                            .contribution(
                                    sourceTotal > 0 ? Math.round((e.getValue() / sourceTotal) * 1000.0) / 10.0 : 0.0)
                            .build())
                    .collect(Collectors.toList());

            summaries.add(NutrientSummary.builder()
                    .id(key)
                    .name(meta.displayName())
                    .unit(meta.unit())
                    .category(meta.category())
                    .value(Math.round(average * 10.0) / 10.0)
                    .goal(goal)
                    .pctDV(pctDV)
                    .flag(computeFlag(pctDV))
                    .weeklyAvg(Math.round(average * 10.0) / 10.0)
                    .trend(trend.stream().map(v -> Math.round(v * 10.0) / 10.0).collect(Collectors.toList()))
                    .topSources(topSources)
                    .pinned(pref != null && pref.isPinned())
                    .avoidedFoods(pref != null ? pref.getAvoidedFoods() : null)
                    .customTarget(pref != null ? pref.getCustomTarget() : null)
                    .build());
        }

        return summaries;
    }

    private String computeFlag(int pctDV) {
        if (pctDV <= 0)
            return "none";
        if (pctDV < 80)
            return "low";
        if (pctDV > 120)
            return "high";
        return "ok";
    }

    private NutritionTotals toTotals(NutritionDetails nutrition) {
        return new NutritionTotals(
                nutrition.getCalories() != null ? nutrition.getCalories().doubleValue() : null,
                nutrition.getProteinG() != null ? nutrition.getProteinG().doubleValue() : null,
                nutrition.getCarbsG() != null ? nutrition.getCarbsG().doubleValue() : null,
                nutrition.getFatsG() != null ? nutrition.getFatsG().doubleValue() : null,
                nutrition.getFiberG() != null ? nutrition.getFiberG().doubleValue() : null,
                nutrition.getSugarG() != null ? nutrition.getSugarG().doubleValue() : null,
                nutrition.getSodiumMg() != null ? nutrition.getSodiumMg().doubleValue() : null);
    }

    /** Nutrient key -> value map from an enrichment record, legacy macros included. */
    private Map<String, Double> buildNutrientValues(NutritionDetails nd) {
        Map<String, Double> nutrientValues = new HashMap<>();
        Nutrients.resolveStored(nd).forEach((key, nutrient) -> {
            if (key == null || key.isBlank() || nutrient == null || nutrient.getAmount() == null) {
                return;
            }
            nutrientValues.put(key, nutrient.getAmount().doubleValue());
        });
        return nutrientValues;
    }

    /** Asks the configured AI service for personalised RDI goals based on the user's age and gender. */
    private Map<String, Double> fetchRdiGoals(User user) {
        String prompt = String.format(
                """
                        You are a nutrition expert. The user is %s years old and %s.
                        Return the recommended daily intake (RDI) for each nutrient listed below.
                        Respond ONLY with a valid JSON object with these exact keys and numeric values (no strings, no units, no extra text):
                        {
                          "calories": <number>,
                          "protein": <number>,
                          "carbs": <number>,
                          "fat": <number>,
                          "fiber": <number>,
                          "sugar": <number>,
                          "sodium": <number>,
                          "vitaminA": <number>,
                          "vitaminC": <number>,
                          "vitaminD": <number>,
                          "vitaminE": <number>,
                          "vitaminK": <number>,
                          "calcium": <number>,
                          "iron": <number>,
                          "potassium": <number>,
                          "magnesium": <number>,
                          "zinc": <number>
                        }
                        Units: calories=kcal, protein/carbs/fat/fiber/sugar=g, sodium/calcium/potassium/magnesium/zinc/iron=mg, vitamins A/D/E=mcg, vitamin C/K=mg.
                        """,
                user.getDerivedAge(), user.getGender());

        try {
            String text = aiTextService.callRawPrompt(prompt);
            JsonNode rdiJson = objectMapper.readTree(AiJsonSupport.extractJson(text));

            Map<String, Double> goals = new HashMap<>();
            rdiJson.fields().forEachRemaining(e -> {
                if (e.getValue().isNumber())
                    goals.put(e.getKey(), e.getValue().asDouble());
            });
            logger.info("AI-based RDI goals computed for user {}: {}", user.getId(), goals);
            return goals;
        } catch (Exception e) {
            logger.warn("Failed to fetch AI-based RDI goals, using defaults. Error: {}", e.getMessage());
            return Map.of(); // fall back to defaults
        }
    }
}
