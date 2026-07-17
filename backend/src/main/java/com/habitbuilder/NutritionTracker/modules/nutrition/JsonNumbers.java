package com.habitbuilder.NutritionTracker.modules.nutrition;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;

/** Lenient numeric extraction from JSON nodes returned by external nutrition sources. */
public final class JsonNumbers {

    private JsonNumbers() {
    }

    public static BigDecimal decimalAt(JsonNode node, String field) {
        return asDecimal(node.path(field));
    }

    public static BigDecimal asDecimal(JsonNode valueNode) {
        if (valueNode == null || valueNode.isMissingNode() || valueNode.isNull()) {
            return BigDecimal.ZERO;
        }
        if (valueNode.isNumber()) {
            return valueNode.decimalValue();
        }

        String text = valueNode.asText("").trim();
        if (text.isBlank()) {
            return BigDecimal.ZERO;
        }

        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }
}
