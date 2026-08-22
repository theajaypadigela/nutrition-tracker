package com.habitbuilder.NutritionTracker.modules.voice;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestOperations;

@Component
public class VapiClient {

    private final RestOperations restOperations;
    private final String callWebUrl;
    private final String privateKey;
    private final String assistantId;

    // Two constructors, so Spring needs to be told which one to use — without
    // this it looks for a no-arg constructor and the context fails to start.
    @Autowired
    public VapiClient(
            RestTemplateBuilder restTemplateBuilder,
            @Value("${vapi.api-base-url:https://api.vapi.ai}") String apiBaseUrl,
            @Value("${vapi.private-key}") String privateKey,
            @Value("${vapi.assistant-id}") String assistantId) {
        this(restTemplateBuilder.build(), apiBaseUrl, privateKey, assistantId);
    }

    VapiClient(RestOperations restOperations, String apiBaseUrl, String privateKey, String assistantId) {
        this.restOperations = restOperations;
        this.callWebUrl = stripTrailingSlash(apiBaseUrl) + "/call/web";
        this.privateKey = privateKey;
        this.assistantId = assistantId;
    }

    @SuppressWarnings({ "rawtypes", "unchecked" })
    VapiWebCall createWebCall(Long userId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(privateKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "assistantId", assistantId,
                "assistantOverrides", Map.of(
                        "metadata", Map.of("userId", userId.toString())));

        ResponseEntity<Map> response = restOperations.postForEntity(
                callWebUrl,
                new HttpEntity<>(body, headers),
                Map.class);

        Map responseBody = response.getBody();
        String providerCallId = stringValue(responseBody, "id");
        String token = stringValue(responseBody, "token");
        if (providerCallId == null || token == null) {
            throw new IllegalStateException("Vapi did not return a call id and token");
        }
        return new VapiWebCall(providerCallId, token);
    }

    private String stringValue(Map<?, ?> values, String key) {
        if (values == null || values.get(key) == null) {
            return null;
        }
        String value = values.get(key).toString();
        return value.isBlank() ? null : value;
    }

    private static String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Vapi API base URL must be configured");
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    record VapiWebCall(String id, String token) {
    }
}
