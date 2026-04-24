# Food Name Nutrition Cache Flow

This document explains the current nutrition caching and scaling flow.

## 1) Cache lookup key

Nutrition cache lookup is now based on the food name, not on a hash.

The backend normalizes the food name like this:

```text
foodName.trim().toLowerCase().replaceAll("\\s+", " ")
```

That normalized value is stored in `nutrition_cache.normalizedFoodName`.

The service looks up cache in this order:

1. `findByNormalizedFoodName(normalizedFoodName)`
2. `findByFoodNameIgnoreCase(foodName)`

So caching depends directly on the food name.

## 2) 3-layer nutrition lookup

`NutritionEnrichmentService.getNutritionData(foodName)` works in this order:

### Layer 1: cache

- Search Mongo by food name
- If found, return immediately with lookup source `cache-hit`

### Layer 2: USDA

- Call USDA FoodData Central search API
- Read the first result
- Extract:
  - calories
  - protein
  - carbohydrates
  - fat
  - fiber
  - sodium
- Save the result in `nutrition_cache` with:
  - `foodName`
  - `normalizedFoodName`
  - `baseUnit`
  - `baseQuantity`
  - nutrient values
  - `source = "USDA"`
  - `cachedAt`
- Return with lookup source `usda-hit`

### Layer 3: AI fallback

- Ask AI for the strict JSON nutrition object
- Save the parsed result in `nutrition_cache` with:
  - `foodName`
  - `normalizedFoodName`
  - `baseUnit`
  - `baseQuantity`
  - nutrient values
  - `source = "AI"`
  - `cachedAt`
- Return with lookup source `ai-hit`

## 3) What is stored in cache

Mongo collection:

- `nutrition_cache`

Stored fields:

- `id`
- `foodName`
- `normalizedFoodName`
- `baseUnit`
- `baseQuantity`
- `calories`
- `proteinG`
- `carbsG`
- `fatsG`
- `fiberG`
- `sugarG`
- `sodiumMg`
- `source`
- `cachedAt`

## 4) How nutrition is recalculated for the current entry

The cache stores nutrition relative to the stored base unit.

Examples:

- `100g`
- `100ml`
- `1 piece`
- `1 cup`

When a user logs the same food with a different unit, the backend first tries to convert the current unit into the stored base unit.

Supported conversion groups:

- mass: `mg`, `g`, `kg`, `oz`, `lb`
- volume: `ml`, `l`, `cup`, `tbsp`, `tsp`, `fl oz`
- count: `piece`, `pc`, `item`, `unit`, `serving`

If the stored unit and current unit are compatible, the scale factor is:

```text
scaleFactor = currentQuantityInComparableUnit / storedBaseQuantityInComparableUnit
```

Then each nutrient is scaled with:

```text
actualNutrient = storedNutrient * scaleFactor
```

If units are not safely convertible, the backend falls back to a plain quantity ratio and logs a warning.

## 5) What is stored per food entry

Each food entry still gets one `nutrition_details` record.

That record stores:

- scaled nutrient values for the current entry
- `baseUnit`
- `baseQuantity`
- `source`
- `lookupSource`
- `cachedAt`
- `apiResponse`
- enrichment status fields

So read APIs still use `nutrition_details`, but the values are derived from the food-name cache plus unit-aware scaling.
