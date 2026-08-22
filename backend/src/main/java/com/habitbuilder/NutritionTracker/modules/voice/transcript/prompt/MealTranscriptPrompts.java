package com.habitbuilder.NutritionTracker.modules.voice.transcript.prompt;

/**
 * The LLM prompt templates for meal voice calls. They live together, away from the code that
 * calls them, because prompt wording is tuned independently of the parsing logic and is far
 * easier to review as prose than as a string literal wedged inside a service.
 */
public final class MealTranscriptPrompts {

    private MealTranscriptPrompts() {
    }

    /** Extraction: transcript in, structured meal entries out. */
    public static String parsing(String transcript) {
        return String.format(
                """
                        You are a nutrition assistant. Analyze the following transcript lines spoken by a user describing the meals they ate today.

                        Extract ALL food items mentioned by the user. For each food item, determine:
                        - name: the food name
                        - quantity: numeric amount as spoken by the user (default 1 if not mentioned)
                        - unit: the unit as spoken by the user (e.g., "serving", "cup", "piece", "bowl", "plate", "g", "ml"). Default to "serving" if not mentioned.
                        - mealType: one of "breakfast", "lunch", "snack", "dinner". Infer from context or time-of-day clues. If unclear, use "snack".
                        - standardQuantity: if the unit is non-standard or vague (e.g., bowl, plate, piece, handful, glass, scoop, serving), estimate the equivalent weight in grams (for solids) or volume in ml (for liquids). Set to null if the unit is already a standard measurement like g, kg, oz, ml, l, tbsp, tsp, cup.
                        - standardUnit: "g" when standardQuantity is a weight, "ml" when it is a volume. Set to null when standardQuantity is null.

                        Examples:
                        - "2 bowls of rice" → quantity=2, unit="bowl", standardQuantity=350, standardUnit="g"
                        - "1 plate of chicken curry" → quantity=1, unit="plate", standardQuantity=400, standardUnit="g"
                        - "3 pieces of bread" → quantity=3, unit="piece", standardQuantity=90, standardUnit="g"
                        - "200g of oats" → quantity=200, unit="g", standardQuantity=null, standardUnit=null
                        - "1 cup of milk" → quantity=1, unit="cup", standardQuantity=240, standardUnit="ml"

                        IMPORTANT: Respond ONLY with valid JSON, no markdown, no explanation:
                        {
                          "meals": [
                            { "name": "food name", "quantity": 1, "unit": "serving", "mealType": "breakfast", "standardQuantity": 150, "standardUnit": "g" }
                          ]
                        }

                        If no food items were mentioned, return: { "meals": [] }

                        User transcript:
                        %s
                        """,
                transcript);
    }

    /** Classification: did the user log a meal now, or ask to be called back later? */
    public static String interpretation(String transcript, String mealSlotId) {
        return String.format(
                """
                        You are classifying a meal voice call transcript.

                        Return ONLY valid JSON in this exact shape:
                        {
                          "shouldLogMeals": true or false,
                          "rescheduleMinutes": number or null,
                          "rationale": "short explanation"
                        }

                        Rules:
                        1) shouldLogMeals = true when user actually provided meal/food details to be logged now.
                        2) shouldLogMeals = false when user asks to do it later, asks to be called/reminded later, or only confirms a later time.
                        3) rescheduleMinutes should be set when user asks for a callback or follow-up call later.
                           Extract the specific minutes when mentioned (e.g., "call me in 5 minutes" → 5,
                           "remind me in an hour" → 60). If user asks to reschedule/call back without specifying
                           a time, default to 30. Return null only when no reschedule was requested.
                        4) If both happened, keep shouldLogMeals=true and also set rescheduleMinutes.
                        5) If uncertain, choose shouldLogMeals=false and rescheduleMinutes=null.
                        6) Never include markdown or extra text.

                        Context meal slot: %s

                        Transcript:
                        %s
                        """,
                mealSlotId != null ? mealSlotId : "unknown",
                transcript);
    }
}
