package com.habitbuilder.NutritionTracker.modules.voice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class VapiWebhookRequest {

    private String type;
    private CallData call;
    private Message message;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CallData {
        private String id;
        private List<TranscriptEntry> transcript;
        private Map<String, Object> analysis;
        private Map<String, Object> metadata;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Message {
        private String type;
        private FunctionCall functionCall;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FunctionCall {
        private String name;
        private Map<String, Object> parameters;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TranscriptEntry {
        private String role;
        private String message;
        private double time;
    }
}
