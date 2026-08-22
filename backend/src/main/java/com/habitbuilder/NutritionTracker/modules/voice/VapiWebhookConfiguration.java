package com.habitbuilder.NutritionTracker.modules.voice;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

@Configuration(proxyBeanMethods = false)
public class VapiWebhookConfiguration {

    @Bean
    VapiWebhookSecretPolicy vapiWebhookSecretPolicy(
            @Value("${vapi.webhook-secret:}") String configuredSecret,
            Environment environment) {
        VapiWebhookSecretPolicy policy = new VapiWebhookSecretPolicy(configuredSecret);
        if (!policy.isConfigured() && !environment.acceptsProfiles(Profiles.of("local"))) {
            throw new IllegalStateException(
                    "vapi.webhook-secret must be configured outside the local profile");
        }
        return policy;
    }
}
