package com.habitbuilder.NutritionTracker.modules.nutrition.ai;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.habitbuilder.NutritionTracker.config.properties.AiProperties;

@Service
public class AiTextService {

    private static final Logger logger = LoggerFactory.getLogger(AiTextService.class);
    /**
     * Fallback for a provider name that is present but blank. The binding default lives on
     * {@link AiProperties}; this one covers an explicitly empty value reaching the service.
     */
    private static final String DEFAULT_PROVIDER = "groq";

    private final Map<String, AiTextClient> clientsByProvider;
    private final String activeProvider;

    public AiTextService(List<AiTextClient> clients, AiProperties properties) {
        String configuredProvider = properties.provider();
        this.clientsByProvider = clients.stream()
                .collect(Collectors.toMap(
                        client -> normalizeProviderName(client.getProviderName()),
                        Function.identity(),
                        (existing, replacement) -> existing,
                        LinkedHashMap::new));
        this.activeProvider = normalizeProviderName(configuredProvider);
        resolveActiveClient();

        logger.info("AI text provider configured as '{}' (available providers: {})",
                this.activeProvider,
                this.clientsByProvider.keySet());
    }

    public String callRawPrompt(String prompt) {
        return resolveActiveClient().callRawPrompt(prompt);
    }

    public String getActiveProvider() {
        return activeProvider;
    }

    private AiTextClient resolveActiveClient() {
        AiTextClient client = clientsByProvider.get(activeProvider);
        if (client != null) {
            return client;
        }

        throw new IllegalStateException(
                "Unsupported ai.provider '" + activeProvider + "'. Available providers: " + clientsByProvider.keySet());
    }

    private String normalizeProviderName(String rawProvider) {
        if (rawProvider == null || rawProvider.trim().isBlank()) {
            return DEFAULT_PROVIDER;
        }
        return rawProvider.trim().toLowerCase(Locale.ROOT);
    }
}
