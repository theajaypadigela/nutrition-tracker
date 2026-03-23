package com.habitbuilder.NutritionTracker.modules.food;

import java.time.LocalDate;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;
import com.habitbuilder.NutritionTracker.modules.nutrition.GeminiService;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionDetails;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionDetailsRepository;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionEnrichmentService;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class FoodService {

    private static final Logger logger = LoggerFactory.getLogger(FoodService.class);

    // Cache for AI insights - key: userId_startDate_endDate, value: cached insights
    private final Map<String, CachedInsights> insightsCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MINUTES = 60; // Cache for 1 hour

    private FoodLogRepository foodLogRepository;
    private FoodEntryRepository foodEntryRepository;
    private NutritionDetailsRepository nutritionDetailsRepository;
    private NutritionEnrichmentService nutritionEnrichmentService;
    private GeminiService geminiService;
    private ObjectMapper objectMapper;
    private UserNutrientPreferenceRepository preferenceRepository;

    FoodService(FoodLogRepository foodLogRepository, FoodEntryRepository foodEntryRepository,
            NutritionDetailsRepository nutritionDetailsRepository,
            NutritionEnrichmentService nutritionEnrichmentService,
            GeminiService geminiService,
            ObjectMapper objectMapper,
            UserNutrientPreferenceRepository preferenceRepository) {
        this.foodLogRepository = foodLogRepository;
        this.foodEntryRepository = foodEntryRepository;
        this.nutritionDetailsRepository = nutritionDetailsRepository;
        this.nutritionEnrichmentService = nutritionEnrichmentService;
        this.geminiService = geminiService;
        this.objectMapper = objectMapper;
        this.preferenceRepository = preferenceRepository;
    }

    public List<FoodEntryResponse> addFoodEntries(LocalDate date, String mealType, List<AddFoodEntryRequest> request) {

        String userId = getCurrentUserId();
        FoodLog foodLog = getOrCreateFoodLog(userId, date);

        List<FoodEntryResponse> responses = new ArrayList<>();

        for (AddFoodEntryRequest req : request) {
            FoodEntry entry = new FoodEntry();
            entry.setFoodLogId(foodLog.getId());
            entry.setName(req.getName());
            entry.setQuantity(req.getQuantity());
            entry.setUnit(req.getUnit());
            entry.setMealType(mealType);

            FoodEntry savedEntry = foodEntryRepository.save(entry);

            // Trigger async nutrition enrichment (single API call + DB save)
            nutritionEnrichmentService.enrichFoodEntry(savedEntry);

            FoodEntryResponse res = new FoodEntryResponse();
            res.setId(savedEntry.getId());
            res.setName(savedEntry.getName());
            res.setQuantity(savedEntry.getQuantity());
            res.setUnit(savedEntry.getUnit());
            res.setMealType(savedEntry.getMealType());
            res.setNutritionResponse("Nutrition enrichment in progress");

            responses.add(res);
        }

        return responses;
    }

    /**
     * Add a single food entry for a specific user (bypasses SecurityContext).
     * Used by the voice-log webhook where there is no JWT auth context.
     */
    public void addFoodEntryForUser(String userId, LocalDate date, String mealType,
            String name, double quantity, String unit) {
        FoodLog foodLog = getOrCreateFoodLog(userId, date);

        FoodEntry entry = new FoodEntry();
        entry.setFoodLogId(foodLog.getId());
        entry.setName(name);
        entry.setQuantity(quantity);
        entry.setUnit(unit);
        entry.setMealType(mealType);

        FoodEntry savedEntry = foodEntryRepository.save(entry);
        nutritionEnrichmentService.enrichFoodEntry(savedEntry);
    }

    public MealsResponse getDayLogAsMeals(LocalDate date) {
        String userId = getCurrentUserId();
        Optional<FoodLog> logOpt = foodLogRepository.findByUserIdAndLogDate(userId, date);

        if (logOpt.isEmpty()) {
            return MealsResponse.builder()
                    .meals(new HashMap<>())
                    .totals(new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0))
                    .build();
        }

        FoodLog log = logOpt.get();
        List<FoodEntry> entries = foodEntryRepository.findByFoodLogId(log.getId());
        Map<String, List<FoodItemResponse>> mealsMap = new HashMap<>();
        NutritionTotals totals = new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

        for (FoodEntry entry : entries) {
            FoodItemResponse item = buildFoodItemResponse(entry);

            // Accumulate totals
            if (item.getCalories() != null)
                totals.setCalories(totals.getCalories() + item.getCalories());
            if (item.getProtein() != null)
                totals.setProtein(totals.getProtein() + item.getProtein());
            if (item.getCarbs() != null)
                totals.setCarbs(totals.getCarbs() + item.getCarbs());
            if (item.getFat() != null)
                totals.setFat(totals.getFat() + item.getFat());
            if (item.getFiber() != null)
                totals.setFiber(totals.getFiber() + item.getFiber());
            if (item.getSugar() != null)
                totals.setSugar(totals.getSugar() + item.getSugar());
            if (item.getSodium() != null)
                totals.setSodium(totals.getSodium() + item.getSodium());

            mealsMap.computeIfAbsent(entry.getMealType(), k -> new ArrayList<>()).add(item);
        }

        return MealsResponse.builder()
                .meals(mealsMap)
                .totals(totals)
                .build();
    }

    public List<DayLogResponse> getDayLogs(LocalDate from, LocalDate to) {
        if (from == null || to == null)
            return null;
        String userId = getCurrentUserId();
        List<FoodLog> logs = foodLogRepository.findByUserIdAndLogDateBetweenOrderByLogDateAsc(userId, from, to);

        List<DayLogResponse> response = new ArrayList<>();

        for (FoodLog log : logs) {
            DayLogResponse res = DayLogResponse.builder()
                    .foodLogId(log.getId())
                    .date(log.getLogDate())
                    .meals(groupEntriesByMealType(foodEntryRepository.findByFoodLogId(log.getId())))
                    .build();
            response.add(res);
        }
        return response;
    }

    public MealsResponse updateEntry(LocalDate date, String id, UpdateFoodEntryRequest request) {
        if (id == null)
            return null;

        String userId = getCurrentUserId();
        Optional<FoodEntry> entryOpt = foodEntryRepository.findById(id);

        if (entryOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Food entry not found");
        }

        FoodEntry entry = entryOpt.get();

        FoodLog foodLog = foodLogRepository.findById(entry.getFoodLogId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food log not found"));

        if (!foodLog.getUserId().equals(userId) || !foodLog.getLogDate().equals(date)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Entry does not match the specified date and user");
        }

        if (request.getName() != null) {
            entry.setName(request.getName());
        }
        if (request.getQuantity() != null) {
            entry.setQuantity(request.getQuantity());
        }
        if (request.getUnit() != null) {
            entry.setUnit(request.getUnit());
        }

        FoodEntry savedEntry = foodEntryRepository.save(entry);

        // Re-enrich nutrition data when food entry is updated
        nutritionEnrichmentService.enrichFoodEntry(savedEntry);

        return getDayLogAsMeals(date);
    }

    public MealsResponse deleteEntry(LocalDate date, String id) {
        if (id == null)
            return null;

        String userId = getCurrentUserId();
        Optional<FoodEntry> entryOpt = foodEntryRepository.findById(id);

        if (entryOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Food entry not found");
        }

        FoodEntry entry = entryOpt.get();

        FoodLog foodLog = foodLogRepository.findById(entry.getFoodLogId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food log not found"));

        if (!foodLog.getUserId().equals(userId) || !foodLog.getLogDate().equals(date)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Entry does not match the specified date and user");
        }

        foodEntryRepository.delete(entry);
        return getDayLogAsMeals(date);
    }

    public MealsResponse deleteEntryById(String id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Food entry id is required");
        }

        String userId = getCurrentUserId();
        FoodEntry entry = foodEntryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food entry not found"));

        FoodLog foodLog = foodLogRepository.findById(entry.getFoodLogId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food log not found"));

        if (!foodLog.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot delete another user's entry");
        }

        LocalDate logDate = foodLog.getLogDate();
        foodEntryRepository.delete(entry);
        return getDayLogAsMeals(logDate);
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return user.getId();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return user;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
    }

    private FoodLog getOrCreateFoodLog(String userId, LocalDate date) {
        return foodLogRepository.findByUserIdAndLogDate(userId, date)
                .orElseGet(() -> {
                    FoodLog log = new FoodLog();
                    log.setUserId(userId);
                    log.setLogDate(date);
                    return foodLogRepository.save(log);
                });
    }

    private List<MealEntriesResponse> groupEntriesByMealType(List<FoodEntry> entries) {
        Map<String, List<FoodEntryResponse>> mealMap = new HashMap<>();

        for (FoodEntry entry : entries) {
            FoodEntryResponse res = new FoodEntryResponse();
            res.setId(entry.getId());
            res.setName(entry.getName());
            res.setQuantity(entry.getQuantity());
            res.setUnit(entry.getUnit());
            res.setMealType(entry.getMealType());

            mealMap.computeIfAbsent(entry.getMealType(), k -> new ArrayList<>()).add(res);
        }

        List<MealEntriesResponse> meals = new ArrayList<>();
        for (Map.Entry<String, List<FoodEntryResponse>> meal : mealMap.entrySet()) {
            meals.add(new MealEntriesResponse(meal.getKey(), meal.getValue()));
        }
        return meals;
    }

    private FoodItemResponse buildFoodItemResponse(FoodEntry entry) {
        FoodItemResponse.FoodItemResponseBuilder builder = FoodItemResponse.builder()
                .id(entry.getId())
                .name(entry.getName())
                .quantity(String.valueOf(entry.getQuantity()))
                .servingSize(entry.getUnit());

        // Add nutrition data if available
        Optional<NutritionDetails> ndOpt = nutritionDetailsRepository.findByFoodEntryId(entry.getId());
        if (ndOpt.isPresent()) {
            var nutrition = ndOpt.get();
            logger.debug("Nutrition details found for entry '{}': status={}, calories={}",
                    entry.getName(), nutrition.getEnrichmentStatus(), nutrition.getCalories());

            if (nutrition.getCalories() != null)
                builder.calories(nutrition.getCalories().doubleValue());
            if (nutrition.getProteinG() != null)
                builder.protein(nutrition.getProteinG().doubleValue());
            if (nutrition.getCarbsG() != null)
                builder.carbs(nutrition.getCarbsG().doubleValue());
            if (nutrition.getFatsG() != null)
                builder.fat(nutrition.getFatsG().doubleValue());
            if (nutrition.getFiberG() != null)
                builder.fiber(nutrition.getFiberG().doubleValue());
            if (nutrition.getSugarG() != null)
                builder.sugar(nutrition.getSugarG().doubleValue());
            if (nutrition.getSodiumMg() != null)
                builder.sodium(nutrition.getSodiumMg().doubleValue());
        } else {
            logger.warn("No nutrition details found for food entry: {} (ID: {})",
                    entry.getName(), entry.getId());
        }

        return builder.build();
    }

    public WeeklyNutritionReport getWeeklyNutritionReport(LocalDate startDate, LocalDate endDate) {
        String userId = getCurrentUserId();
        List<FoodLog> logs = foodLogRepository.findByUserIdAndLogDateBetweenOrderByLogDateAsc(userId, startDate,
                endDate);

        // Batch-fetch all entries for all logs
        List<String> logIds = logs.stream().map(FoodLog::getId).collect(Collectors.toList());
        List<FoodEntry> allEntries = new ArrayList<>();
        for (String logId : logIds) {
            allEntries.addAll(foodEntryRepository.findByFoodLogId(logId));
        }

        // Batch-fetch all nutrition details for all entries
        List<String> entryIds = allEntries.stream().map(FoodEntry::getId).collect(Collectors.toList());
        List<NutritionDetails> allNutritionDetails = nutritionDetailsRepository.findByFoodEntryIdIn(entryIds);
        Map<String, NutritionDetails> nutritionMap = allNutritionDetails.stream()
                .collect(Collectors.toMap(NutritionDetails::getFoodEntryId, nd -> nd, (a, b) -> a));

        // Build a map of logId -> entries
        Map<String, List<FoodEntry>> entriesByLogId = allEntries.stream()
                .collect(Collectors.groupingBy(FoodEntry::getFoodLogId));

        List<DailyNutritionSummary> dailySummaries = new ArrayList<>();
        NutritionTotals weeklyTotals = new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        int daysWithData = 0;

        for (FoodLog log : logs) {
            NutritionTotals dayTotals = new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

            List<FoodEntry> logEntries = entriesByLogId.getOrDefault(log.getId(), List.of());
            for (FoodEntry entry : logEntries) {
                NutritionDetails nutrition = nutritionMap.get(entry.getId());
                if (nutrition != null) {
                    if (nutrition.getCalories() != null)
                        dayTotals.setCalories(dayTotals.getCalories() + nutrition.getCalories().doubleValue());
                    if (nutrition.getProteinG() != null)
                        dayTotals.setProtein(dayTotals.getProtein() + nutrition.getProteinG().doubleValue());
                    if (nutrition.getCarbsG() != null)
                        dayTotals.setCarbs(dayTotals.getCarbs() + nutrition.getCarbsG().doubleValue());
                    if (nutrition.getFatsG() != null)
                        dayTotals.setFat(dayTotals.getFat() + nutrition.getFatsG().doubleValue());
                    if (nutrition.getFiberG() != null)
                        dayTotals.setFiber(dayTotals.getFiber() + nutrition.getFiberG().doubleValue());
                    if (nutrition.getSugarG() != null)
                        dayTotals.setSugar(dayTotals.getSugar() + nutrition.getSugarG().doubleValue());
                    if (nutrition.getSodiumMg() != null)
                        dayTotals.setSodium(dayTotals.getSodium() + nutrition.getSodiumMg().doubleValue());
                }
            }

            dailySummaries.add(DailyNutritionSummary.builder()
                    .date(log.getLogDate())
                    .totals(dayTotals)
                    .build());

            // Accumulate weekly totals
            weeklyTotals.setCalories(weeklyTotals.getCalories() + dayTotals.getCalories());
            weeklyTotals.setProtein(weeklyTotals.getProtein() + dayTotals.getProtein());
            weeklyTotals.setCarbs(weeklyTotals.getCarbs() + dayTotals.getCarbs());
            weeklyTotals.setFat(weeklyTotals.getFat() + dayTotals.getFat());
            weeklyTotals.setFiber(weeklyTotals.getFiber() + dayTotals.getFiber());
            weeklyTotals.setSugar(weeklyTotals.getSugar() + dayTotals.getSugar());
            weeklyTotals.setSodium(weeklyTotals.getSodium() + dayTotals.getSodium());

            daysWithData++;
        }

        // Calculate averages
        NutritionTotals weeklyAverage = new NutritionTotals(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        double avgDailyCalories = 0.0;

        if (daysWithData > 0) {
            weeklyAverage.setCalories(weeklyTotals.getCalories() / daysWithData);
            weeklyAverage.setProtein(weeklyTotals.getProtein() / daysWithData);
            weeklyAverage.setCarbs(weeklyTotals.getCarbs() / daysWithData);
            weeklyAverage.setFat(weeklyTotals.getFat() / daysWithData);
            weeklyAverage.setFiber(weeklyTotals.getFiber() / daysWithData);
            weeklyAverage.setSugar(weeklyTotals.getSugar() / daysWithData);
            weeklyAverage.setSodium(weeklyTotals.getSodium() / daysWithData);
            avgDailyCalories = weeklyTotals.getCalories() / daysWithData;
        }

        return WeeklyNutritionReport.builder()
                .avgDailyCalories(avgDailyCalories)
                .weeklyTotals(weeklyTotals)
                .weeklyAverage(weeklyAverage)
                .dailySummaries(dailySummaries)
                .build();
    }

    // -----------------------------------------------------------------------
    // RDI cache (in-memory per JVM session, keyed by userId)
    // -----------------------------------------------------------------------
    private final Map<String, Map<String, Double>> rdiCache = new ConcurrentHashMap<>();

    /**
     * Returns all nutrient summaries for the given date range.
     * Nutrient RDI goals are fetched via AI using the user's age+gender.
     */
    public List<NutrientSummary> getAllNutrientsSummary(LocalDate startDate, LocalDate endDate) {
        User user = getCurrentUser();
        String userId = user.getId();

        List<FoodLog> logs = foodLogRepository.findByUserIdAndLogDateBetweenOrderByLogDateAsc(userId, startDate,
                endDate);

        // Batch-fetch all entries for all logs
        List<String> logIds = logs.stream().map(FoodLog::getId).collect(Collectors.toList());
        List<FoodEntry> allEntries = new ArrayList<>();
        for (String logId : logIds) {
            allEntries.addAll(foodEntryRepository.findByFoodLogId(logId));
        }

        // Batch-fetch all nutrition details for all entries
        List<String> entryIds = allEntries.stream().map(FoodEntry::getId).collect(Collectors.toList());
        List<NutritionDetails> allNutritionDetails = nutritionDetailsRepository.findByFoodEntryIdIn(entryIds);
        Map<String, NutritionDetails> nutritionMap = allNutritionDetails.stream()
                .collect(Collectors.toMap(NutritionDetails::getFoodEntryId, nd -> nd, (a, b) -> a));

        // Build a map of logId -> entries
        Map<String, List<FoodEntry>> entriesByLogId = allEntries.stream()
                .collect(Collectors.groupingBy(FoodEntry::getFoodLogId));

        // Build map: date -> nutrients
        Map<LocalDate, Map<String, Double>> dailyNutrientMap = new LinkedHashMap<>();
        LocalDate cursor = startDate;
        while (!cursor.isAfter(endDate)) {
            dailyNutrientMap.put(cursor, new HashMap<>());
            cursor = cursor.plusDays(1);
        }

        // Accumulate nutrients per day; also accumulate per food-entry contribution
        // Structure: nutrientKey -> { foodName -> total amount }
        Map<String, Map<String, Double>> sourceTotals = new HashMap<>();

        for (FoodLog log : logs) {
            Map<String, Double> dayMap = dailyNutrientMap.getOrDefault(log.getLogDate(), new HashMap<>());
            List<FoodEntry> logEntries = entriesByLogId.getOrDefault(log.getId(), List.of());
            for (FoodEntry entry : logEntries) {
                NutritionDetails nd = nutritionMap.get(entry.getId());
                if (nd == null)
                    continue;
                String foodName = entry.getName();

                Map<String, Double> nutrientValues = buildNutrientValues(nd);
                for (Map.Entry<String, Double> nv : nutrientValues.entrySet()) {
                    String key = nv.getKey();
                    double val = nv.getValue();
                    dayMap.merge(key, val, Double::sum);
                    sourceTotals.computeIfAbsent(key, k -> new HashMap<>())
                            .merge(foodName, val, Double::sum);
                }
            }
            dailyNutrientMap.put(log.getLogDate(), dayMap);
        }

        // Fetch or compute AI-based RDI goals
        Map<String, Double> rdiGoals = rdiCache.computeIfAbsent(userId, id -> fetchRdiGoals(user));

        // Fetch user preferences
        List<UserNutrientPreference> userPrefs = preferenceRepository.findByUserId(userId);
        Map<String, UserNutrientPreference> prefMap = userPrefs.stream()
                .collect(Collectors.toMap(UserNutrientPreference::getNutrientId, p -> p));

        // Nutrient metadata
        List<NutrientMeta> metas = getNutrientMetas();
        List<NutrientSummary> summaries = new ArrayList<>();
        List<LocalDate> dateRange = new ArrayList<>(dailyNutrientMap.keySet());

        for (NutrientMeta meta : metas) {
            String key = meta.key;
            List<Double> trend = dateRange.stream()
                    .map(d -> dailyNutrientMap.getOrDefault(d, Map.of()).getOrDefault(key, 0.0))
                    .collect(Collectors.toList());

            double total = trend.stream().mapToDouble(Double::doubleValue).sum();
            long daysWithData = trend.stream().filter(v -> v > 0).count();
            double average = daysWithData > 0 ? total / daysWithData : 0.0;

            double goal = rdiGoals.getOrDefault(key, meta.defaultGoal);
            // Override with user custom target if set
            if (prefMap.containsKey(key) && prefMap.get(key).getCustomTarget() != null) {
                goal = prefMap.get(key).getCustomTarget();
            }
            int pctDV = goal > 0 ? (int) Math.round((average / goal) * 100) : 0;
            String flag = computeFlag(pctDV);

            // Top sources
            Map<String, Double> sources = sourceTotals.getOrDefault(key, Map.of());
            double sourceTotal = sources.values().stream().mapToDouble(Double::doubleValue).sum();
            List<TopFoodSource> topSources = sources.entrySet().stream()
                    .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                    .limit(3)
                    .map(e -> TopFoodSource.builder()
                            .name(e.getKey())
                            .amount(Math.round(e.getValue() * 10.0) / 10.0)
                            .unit(meta.unit)
                            .contribution(
                                    sourceTotal > 0 ? Math.round((e.getValue() / sourceTotal) * 1000.0) / 10.0 : 0.0)
                            .build())
                    .collect(Collectors.toList());

            boolean pinned = prefMap.containsKey(key) && prefMap.get(key).isPinned();
            String avoidedFoods = prefMap.containsKey(key) ? prefMap.get(key).getAvoidedFoods() : null;

            summaries.add(NutrientSummary.builder()
                    .id(key)
                    .name(meta.displayName)
                    .unit(meta.unit)
                    .category(meta.category)
                    .value(Math.round(average * 10.0) / 10.0)
                    .goal(goal)
                    .pctDV(pctDV)
                    .flag(flag)
                    .weeklyAvg(Math.round(average * 10.0) / 10.0)
                    .trend(trend.stream().map(v -> Math.round(v * 10.0) / 10.0).collect(Collectors.toList()))
                    .topSources(topSources)
                    .pinned(pinned)
                    .avoidedFoods(avoidedFoods)
                    .customTarget(prefMap.containsKey(key) ? prefMap.get(key).getCustomTarget() : null)
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

    /** Build nutrient key->value map from a NutritionDetails record */
    private Map<String, Double> buildNutrientValues(
            com.habitbuilder.NutritionTracker.modules.nutrition.NutritionDetails nd) {
        Map<String, Double> m = new HashMap<>();
        if (nd.getCalories() != null)
            m.put("calories", nd.getCalories().doubleValue());
        if (nd.getProteinG() != null)
            m.put("protein", nd.getProteinG().doubleValue());
        if (nd.getCarbsG() != null)
            m.put("carbs", nd.getCarbsG().doubleValue());
        if (nd.getFatsG() != null)
            m.put("fat", nd.getFatsG().doubleValue());
        if (nd.getFiberG() != null)
            m.put("fiber", nd.getFiberG().doubleValue());
        if (nd.getSugarG() != null)
            m.put("sugar", nd.getSugarG().doubleValue());
        if (nd.getSodiumMg() != null)
            m.put("sodium", nd.getSodiumMg().doubleValue());
        return m;
    }

    /**
     * Call GeminiService to get personalised RDI goals based on user's age and
     * gender.
     */
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
                user.getAge(), user.getGender());

        try {
            String text = callGeminiRaw(prompt);
            // Extract JSON
            int start = text.indexOf('{');
            int end = text.lastIndexOf('}');
            if (start == -1 || end == -1)
                throw new RuntimeException("No JSON in RDI response");
            JsonNode rdiJson = objectMapper.readTree(text.substring(start, end + 1));

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

    private String callGeminiRaw(String prompt) {
        return geminiService.callRawPrompt(prompt);
    }

    /** Static metadata for all tracked nutrients */
    private static List<NutrientMeta> getNutrientMetas() {
        return List.of(
                new NutrientMeta("calories", "Calories", "kcal", "macro", 2000),
                new NutrientMeta("protein", "Protein", "g", "macro", 50),
                new NutrientMeta("carbs", "Carbohydrates", "g", "macro", 300),
                new NutrientMeta("fat", "Total Fat", "g", "macro", 65),
                new NutrientMeta("fiber", "Fiber", "g", "macro", 28),
                new NutrientMeta("sugar", "Sugar", "g", "macro", 50),
                new NutrientMeta("sodium", "Sodium", "mg", "mineral", 2300),
                new NutrientMeta("vitaminA", "Vitamin A", "mcg", "vitamin", 900),
                new NutrientMeta("vitaminC", "Vitamin C", "mg", "vitamin", 90),
                new NutrientMeta("vitaminD", "Vitamin D", "mcg", "vitamin", 20),
                new NutrientMeta("vitaminE", "Vitamin E", "mg", "vitamin", 15),
                new NutrientMeta("vitaminK", "Vitamin K", "mcg", "vitamin", 120),
                new NutrientMeta("calcium", "Calcium", "mg", "mineral", 1000),
                new NutrientMeta("iron", "Iron", "mg", "mineral", 18),
                new NutrientMeta("potassium", "Potassium", "mg", "mineral", 4700),
                new NutrientMeta("magnesium", "Magnesium", "mg", "mineral", 400),
                new NutrientMeta("zinc", "Zinc", "mg", "mineral", 11));
    }

    /** Lightweight metadata record */
    private static class NutrientMeta {
        final String key;
        final String displayName;
        final String unit;
        final String category;
        final double defaultGoal;

        NutrientMeta(String key, String displayName, String unit, String category, double defaultGoal) {
            this.key = key;
            this.displayName = displayName;
            this.unit = unit;
            this.category = category;
            this.defaultGoal = defaultGoal;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Nutrient Preference Methods
    // ═══════════════════════════════════════════════════════════════════════════

    public NutrientPreferenceResponse togglePin(String nutrientId) {
        String userId = getCurrentUserId();
        UserNutrientPreference pref = preferenceRepository
                .findByUserIdAndNutrientId(userId, nutrientId)
                .orElseGet(() -> UserNutrientPreference.builder()
                        .userId(userId)
                        .nutrientId(nutrientId)
                        .pinned(false)
                        .build());
        pref.setPinned(!pref.isPinned());
        preferenceRepository.save(pref);
        return toPreferenceResponse(pref);
    }

    public NutrientPreferenceResponse setCustomTarget(String nutrientId, Double target) {
        String userId = getCurrentUserId();
        UserNutrientPreference pref = preferenceRepository
                .findByUserIdAndNutrientId(userId, nutrientId)
                .orElseGet(() -> UserNutrientPreference.builder()
                        .userId(userId)
                        .nutrientId(nutrientId)
                        .build());
        pref.setCustomTarget(target);
        preferenceRepository.save(pref);
        return toPreferenceResponse(pref);
    }

    public NutrientPreferenceResponse setAvoidedFoods(String nutrientId, List<String> foods) {
        String userId = getCurrentUserId();
        UserNutrientPreference pref = preferenceRepository
                .findByUserIdAndNutrientId(userId, nutrientId)
                .orElseGet(() -> UserNutrientPreference.builder()
                        .userId(userId)
                        .nutrientId(nutrientId)
                        .build());
        pref.setAvoidedFoods(foods != null ? String.join(",", foods) : null);
        preferenceRepository.save(pref);
        return toPreferenceResponse(pref);
    }

    public List<NutrientPreferenceResponse> getPreferences() {
        String userId = getCurrentUserId();
        return preferenceRepository.findByUserId(userId).stream()
                .map(this::toPreferenceResponse)
                .collect(Collectors.toList());
    }

    private NutrientPreferenceResponse toPreferenceResponse(UserNutrientPreference pref) {
        List<String> avoided = pref.getAvoidedFoods() != null && !pref.getAvoidedFoods().isEmpty()
                ? List.of(pref.getAvoidedFoods().split(","))
                : List.of();
        return NutrientPreferenceResponse.builder()
                .nutrientId(pref.getNutrientId())
                .pinned(pref.isPinned())
                .customTarget(pref.getCustomTarget())
                .avoidedFoods(avoided)
                .build();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AI Insights
    // ═══════════════════════════════════════════════════════════════════════════

    public List<InsightResponse> getAiInsights(LocalDate startDate, LocalDate endDate) {
        User user = getCurrentUser();

        // Check cache first
        String cacheKey = user.getId() + "_" + startDate + "_" + endDate;
        CachedInsights cached = insightsCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            logger.info("Returning cached AI insights for user {} (cached at {})", user.getId(), cached.getTimestamp());
            return cached.getInsights();
        }

        // Get weekly report data to feed into AI
        WeeklyNutritionReport report = getWeeklyNutritionReport(startDate, endDate);
        NutritionTotals avg = report.getWeeklyAverage();

        // Get user preferences (avoided foods)
        List<UserNutrientPreference> prefs = preferenceRepository.findByUserId(user.getId());
        StringBuilder avoidedSection = new StringBuilder();
        for (UserNutrientPreference p : prefs) {
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
                user.getAge(), user.getGender(),
                avg.getCalories(), avg.getProtein(), avg.getCarbs(), avg.getFat(),
                avg.getFiber(), avg.getSugar(), avg.getSodium(),
                avoidedSection.length() > 0 ? "Foods to avoid:\n" + avoidedSection : "");

        try {
            String text = callGeminiRaw(prompt);

            // Extract JSON array
            int start = text.indexOf('[');
            int end = text.lastIndexOf(']');
            if (start == -1 || end == -1)
                throw new RuntimeException("No JSON array in insights response");
            String jsonArray = text.substring(start, end + 1);

            JsonNode insightsNode = objectMapper.readTree(jsonArray);
            List<InsightResponse> insights = new ArrayList<>();
            for (JsonNode node : insightsNode) {
                insights.add(InsightResponse.builder()
                        .variant(node.path("variant").asText("neutral"))
                        .message(node.path("message").asText())
                        .build());
            }
            logger.info("AI insights generated for user {}: {} insights", user.getId(), insights.size());

            // Cache the successful result
            insightsCache.put(cacheKey, new CachedInsights(insights, Instant.now()));

            return insights;
        } catch (Exception e) {
            logger.warn("Failed to generate AI insights, using fallback. Error: {}", e.getMessage());
            List<InsightResponse> fallback = getFallbackInsights(avg);

            // Cache fallback for a shorter period (10 minutes) to retry sooner
            insightsCache.put(cacheKey, new CachedInsights(fallback, Instant.now(), 10));

            return fallback;
        }
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

    // Inner class for caching insights
    private static class CachedInsights {
        private final List<InsightResponse> insights;
        private final Instant timestamp;
        private final long ttlMinutes;

        public CachedInsights(List<InsightResponse> insights, Instant timestamp) {
            this(insights, timestamp, CACHE_TTL_MINUTES);
        }

        public CachedInsights(List<InsightResponse> insights, Instant timestamp, long ttlMinutes) {
            this.insights = insights;
            this.timestamp = timestamp;
            this.ttlMinutes = ttlMinutes;
        }

        public boolean isExpired() {
            return Instant.now().isAfter(timestamp.plusSeconds(ttlMinutes * 60));
        }

        public List<InsightResponse> getInsights() {
            return insights;
        }

        public Instant getTimestamp() {
            return timestamp;
        }
    }

}
