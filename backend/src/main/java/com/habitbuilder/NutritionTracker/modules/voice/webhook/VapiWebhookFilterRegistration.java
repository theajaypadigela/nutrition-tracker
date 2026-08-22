package com.habitbuilder.NutritionTracker.modules.voice.webhook;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Scopes {@link VapiWebhookAuthenticationFilter} to the webhook path.
 *
 * <p>The filter is built here rather than annotated as a component so it can never be
 * auto-registered against every request — a Vapi secret check in front of the whole API
 * would reject every authenticated call the app makes.
 */
@Configuration
public class VapiWebhookFilterRegistration {

    static final String WEBHOOK_PATH = "/food/voice-log";

    @Bean
    public FilterRegistrationBean<VapiWebhookAuthenticationFilter> vapiWebhookAuthenticationFilter(
            @Value("${vapi.webhook-secret:}") String webhookSecret) {
        FilterRegistrationBean<VapiWebhookAuthenticationFilter> registration =
                new FilterRegistrationBean<>(new VapiWebhookAuthenticationFilter(webhookSecret));
        registration.addUrlPatterns(WEBHOOK_PATH);
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }
}
