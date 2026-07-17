package com.habitbuilder.NutritionTracker.modules.food;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.common.CurrentUserProvider;
import com.habitbuilder.NutritionTracker.modules.food.dto.AddFoodEntryRequest;
import com.habitbuilder.NutritionTracker.modules.food.dto.DayLogResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.FoodEntryResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.MealEntriesResponse;
import com.habitbuilder.NutritionTracker.modules.food.dto.UpdateFoodEntryRequest;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionDetails;
import com.habitbuilder.NutritionTracker.modules.nutrition.NutritionEnrichmentService;
import com.habitbuilder.NutritionTracker.modules.nutrition.Nutrients;

/**
 * Day-to-day food logging: creating, reading, updating, and deleting the
 * entries of a user's daily food log. Reporting/analytics live in
 * {@link NutritionReportService}.
 */
@Service
public class FoodLogService {

    private static final Logger logger = LoggerFactory.getLogger(FoodLogService.class);

    private final FoodLogRepository foodLogRepository;
    private final FoodEntryRepository foodEntryRepository;
    private final FoodLogQueries foodLogQueries;
    private final NutritionEnrichmentService nutritionEnrichmentService;
    private final CurrentUserProvider currentUserProvider;

    public FoodLogService(
            FoodLogRepository foodLogRepository,
            FoodEntryRepository foodEntryRepository,
            FoodLogQueries foodLogQueries,
            NutritionEnrichmentService nutritionEnrichmentService,
            CurrentUserProvider currentUserProvider) {
        this.foodLogRepository = foodLogRepository;
        this.foodEntryRepository = foodEntryRepository;
        this.foodLogQueries = foodLogQueries;
        this.nutritionEnrichmentService = nutritionEnrichmentService;
        this.currentUserProvider = currentUserProvider;
    }

    public List<FoodEntryResponse> addFoodEntries(LocalDate date, String mealType, List<AddFoodEntryRequest> request) {
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date is required");
        }
        if (request == null || request.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one food entry is required");
        }

        String normalizedMealType = MealTypes.normalize(mealType, false);
        String userId = currentUserProvider.currentUserId();
        FoodLog foodLog = getOrCreateFoodLog(userId, date);

        List<FoodEntryResponse> responses = new ArrayList<>();

        for (AddFoodEntryRequest req : request) {
            if (req == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Food entry payload cannot be null");
            }

            ValidatedFoodInput input = validateFoodInput(req.getName(), req.getQuantity(), req.getUnit());
            FoodEntry savedEntry = saveFoodEntry(foodLog.getId(), normalizedMealType, input, null, null);
            responses.add(toFoodEntryResponse(savedEntry));
        }

        return responses;
    }

    /**
     * Add a single food entry for a specific user (bypasses SecurityContext).
     * Used by the voice-log webhook where there is no JWT auth context.
     */
    public void addFoodEntryForUser(String userId, LocalDate date, String mealType,
            String name, double quantity, String unit) {
        addFoodEntryForUser(userId, date, mealType, name, quantity, unit, null, null);
    }

    /**
     * Add a single food entry with an optional standard weight/volume equivalent.
     * When standardQuantity/standardUnit are provided (e.g. 350g for "2 bowls"),
     * nutrition enrichment uses those values for accurate scaling.
     */
    public void addFoodEntryForUser(String userId, LocalDate date, String mealType,
            String name, double quantity, String unit, Double standardQuantity, String standardUnit) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User id is required");
        }
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date is required");
        }

        String normalizedMealType = MealTypes.normalize(mealType, true);
        ValidatedFoodInput input = validateFoodInput(name, quantity, unit);
        FoodLog foodLog = getOrCreateFoodLog(userId, date);
        saveFoodEntry(foodLog.getId(), normalizedMealType, input, standardQuantity, standardUnit);
    }

    public MealsResponse getDayLogAsMeals(LocalDate date) {
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date is required");
        }

        String userId = currentUserProvider.currentUserId();
        Optional<FoodLog> logOpt = foodLogRepository.findByUserIdAndLogDate(userId, date);

        if (logOpt.isEmpty()) {
            return MealsResponse.builder()
                    .meals(MealTypes.emptyMealMap())
                    .totals(NutritionTotals.zero())
                    .build();
        }

        List<FoodEntry> entries = foodEntryRepository.findByFoodLogId(logOpt.get().getId());
        Map<String, List<FoodItemResponse>> mealsMap = MealTypes.emptyMealMap();
        NutritionTotals totals = NutritionTotals.zero();
        Map<String, NutritionDetails> nutritionLookup = foodLogQueries.nutritionByEntryId(entries);

        for (FoodEntry entry : entries) {
            FoodItemResponse item = buildFoodItemResponse(entry, nutritionLookup.get(entry.getId()));
            totals.add(toTotals(item));
            mealsMap.get(MealTypes.normalize(entry.getMealType(), true)).add(item);
        }

        return MealsResponse.builder()
                .meals(mealsMap)
                .totals(totals)
                .build();
    }

    public List<DayLogResponse> getDayLogs(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "From and to dates are required");
        }
        if (from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "From date must be on or before to date");
        }

        String userId = currentUserProvider.currentUserId();
        List<FoodLog> logs = foodLogQueries.findLogsInDateRange(userId, from, to);

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
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date is required");
        }
        if (id == null || id.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Food entry id is required");
        }
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update payload is required");
        }

        String userId = currentUserProvider.currentUserId();
        FoodEntry entry = foodEntryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food entry not found"));

        FoodLog foodLog = foodLogRepository.findById(entry.getFoodLogId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food log not found"));

        if (!foodLog.getUserId().equals(userId) || !foodLog.getLogDate().equals(date)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Entry does not match the specified date and user");
        }

        ValidatedFoodInput validatedInput = validateFoodInput(
                request.getName() != null ? request.getName() : entry.getName(),
                request.getQuantity() != null ? request.getQuantity() : entry.getQuantity(),
                request.getUnit() != null ? request.getUnit() : entry.getUnit());

        entry.setName(validatedInput.name());
        entry.setQuantity(validatedInput.quantity());
        entry.setUnit(validatedInput.unit());

        FoodEntry savedEntry = foodEntryRepository.save(entry);

        nutritionEnrichmentService.enrichFoodEntry(savedEntry);

        return getDayLogAsMeals(date);
    }

    public MealsResponse deleteEntry(LocalDate date, String id) {
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date is required");
        }
        if (id == null || id.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Food entry id is required");
        }

        String userId = currentUserProvider.currentUserId();
        FoodEntry entry = foodEntryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food entry not found"));

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

        String userId = currentUserProvider.currentUserId();
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

    private FoodLog getOrCreateFoodLog(String userId, LocalDate date) {
        return foodLogRepository.findByUserIdAndLogDate(userId, date)
                .orElseGet(() -> {
                    FoodLog log = new FoodLog();
                    log.setUserId(userId);
                    log.setLogDate(date);
                    return foodLogRepository.save(log);
                });
    }

    private FoodEntry saveFoodEntry(String foodLogId, String mealType, ValidatedFoodInput input,
            Double standardQuantity, String standardUnit) {
        FoodEntry entry = new FoodEntry();
        entry.setFoodLogId(foodLogId);
        entry.setName(input.name());
        entry.setQuantity(input.quantity());
        entry.setUnit(input.unit());
        entry.setMealType(mealType);
        if (standardQuantity != null && standardQuantity > 0
                && standardUnit != null && !standardUnit.isBlank()) {
            entry.setStandardQuantity(standardQuantity);
            entry.setStandardUnit(standardUnit.trim().toLowerCase(Locale.ROOT));
        }

        FoodEntry savedEntry = foodEntryRepository.save(entry);
        nutritionEnrichmentService.enrichFoodEntry(savedEntry);
        return savedEntry;
    }

    private FoodEntryResponse toFoodEntryResponse(FoodEntry entry) {
        FoodEntryResponse res = new FoodEntryResponse();
        res.setId(entry.getId());
        res.setName(entry.getName());
        res.setQuantity(entry.getQuantity());
        res.setUnit(entry.getUnit());
        res.setMealType(entry.getMealType());
        res.setNutritionResponse("Nutrition enrichment in progress");
        return res;
    }

    private ValidatedFoodInput validateFoodInput(String name, Double quantity, String unit) {
        String normalizedName = name == null ? "" : name.trim();
        if (normalizedName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Food name is required");
        }

        if (quantity == null || !Double.isFinite(quantity) || quantity <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be a positive number");
        }

        String normalizedUnit = unit == null ? "" : unit.trim();
        if (normalizedUnit.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit is required");
        }

        return new ValidatedFoodInput(normalizedName, quantity, normalizedUnit);
    }

    private List<MealEntriesResponse> groupEntriesByMealType(List<FoodEntry> entries) {
        Map<String, List<FoodEntryResponse>> mealMap = MealTypes.emptyMealMap();

        for (FoodEntry entry : entries) {
            FoodEntryResponse res = new FoodEntryResponse();
            res.setId(entry.getId());
            res.setName(entry.getName());
            res.setQuantity(entry.getQuantity());
            res.setUnit(entry.getUnit());
            res.setMealType(MealTypes.normalize(entry.getMealType(), true));

            mealMap.get(res.getMealType()).add(res);
        }

        List<MealEntriesResponse> meals = new ArrayList<>();
        MealTypes.CANONICAL_ORDER.forEach(mealType -> meals.add(new MealEntriesResponse(mealType, mealMap.get(mealType))));
        return meals;
    }

    private FoodItemResponse buildFoodItemResponse(FoodEntry entry, NutritionDetails nutrition) {
        FoodItemResponse.FoodItemResponseBuilder builder = FoodItemResponse.builder()
                .id(entry.getId())
                .name(entry.getName())
                .quantity(String.valueOf(entry.getQuantity()))
                .servingSize(entry.getUnit());

        if (nutrition != null) {
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
            builder.nutrients(Nutrients.resolveStored(nutrition));
        } else {
            logger.debug("Nutrition details not available yet for food entry: {} (ID: {})",
                    entry.getName(), entry.getId());
        }

        return builder.build();
    }

    private NutritionTotals toTotals(FoodItemResponse item) {
        return new NutritionTotals(
                item.getCalories(),
                item.getProtein(),
                item.getCarbs(),
                item.getFat(),
                item.getFiber(),
                item.getSugar(),
                item.getSodium());
    }

    private record ValidatedFoodInput(String name, double quantity, String unit) {
    }
}
