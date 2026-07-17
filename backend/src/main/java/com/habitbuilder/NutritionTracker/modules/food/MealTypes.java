package com.habitbuilder.NutritionTracker.modules.food;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Canonical meal slots and normalization of free-form meal-type labels onto them. */
public final class MealTypes {

    public static final List<String> CANONICAL_ORDER = List.of("breakfast", "lunch", "snack", "dinner");

    private static final Logger logger = LoggerFactory.getLogger(MealTypes.class);

    private MealTypes() {
    }

    /** An insertion-ordered map with one empty list per canonical meal slot. */
    public static <T> Map<String, List<T>> emptyMealMap() {
        Map<String, List<T>> mealMap = new LinkedHashMap<>();
        CANONICAL_ORDER.forEach(mealType -> mealMap.put(mealType, new ArrayList<>()));
        return mealMap;
    }

    /**
     * Normalizes labels such as "Morning meal" or "SNACKS" onto a canonical slot.
     * Unrecognized labels either fall back to "snack" (voice flows, stored data)
     * or reject the request (direct API input).
     */
    public static String normalize(String mealType, boolean fallbackToSnack) {
        String normalized = mealType == null ? ""
                : mealType.trim().toLowerCase(Locale.ROOT).replace('_', ' ').replace('-', ' ').replaceAll("\\s+", " ");

        switch (normalized) {
            case "breakfast":
            case "break fast":
            case "morning meal":
                return "breakfast";
            case "lunch":
            case "midday meal":
                return "lunch";
            case "snack":
            case "snacks":
                return "snack";
            case "dinner":
            case "supper":
            case "evening meal":
                return "dinner";
            default:
                break;
        }

        if (normalized.contains("breakfast") || normalized.contains("break fast")) {
            return "breakfast";
        }
        if (normalized.contains("lunch")) {
            return "lunch";
        }
        if (normalized.contains("snack")) {
            return "snack";
        }
        if (normalized.contains("dinner") || normalized.contains("supper")) {
            return "dinner";
        }

        if (fallbackToSnack) {
            logger.warn("Normalizing unexpected meal type '{}' to snack", mealType);
            return "snack";
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Invalid meal type. Use breakfast, lunch, snack, or dinner");
    }
}
