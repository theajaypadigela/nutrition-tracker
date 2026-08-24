package com.habitbuilder.NutritionTracker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.util.TestPropertyValues;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.habitbuilder.NutritionTracker.config.properties.AiProperties;
import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;
import com.habitbuilder.NutritionTracker.config.properties.CorsProperties;
import com.habitbuilder.NutritionTracker.config.properties.GeminiProperties;
import com.habitbuilder.NutritionTracker.config.properties.GroqProperties;
import com.habitbuilder.NutritionTracker.config.properties.MongoTuningProperties;
import com.habitbuilder.NutritionTracker.config.properties.NutritionProviderProperties;
import com.habitbuilder.NutritionTracker.config.properties.SpoonacularProperties;
import com.habitbuilder.NutritionTracker.config.properties.UsdaProperties;
import com.habitbuilder.NutritionTracker.config.properties.VapiProperties;
import com.habitbuilder.NutritionTracker.support.OfflineMongo;

/**
 * The other half of plan task 0.3: the app also has to come up on the <em>minimum</em>
 * configuration, and every {@code @DefaultValue} has to be the value the code assumed before
 * it was a default.
 *
 * <p>Only the four genuinely required settings are supplied — a Mongo URI, the two
 * {@code @NotNull} JWT values, and {@code gemini.api.key}, which is {@code @NotNull} because
 * the application has always refused to start without {@code GEMINI_API_KEY} present. An
 * empty value satisfies it, which is itself the documented behaviour and is pinned here.
 */
@SpringBootTest
@ContextConfiguration(initializers = ApplicationPropertyDefaultsTest.MinimalEnvironment.class)
@Import(OfflineMongo.class)
class ApplicationPropertyDefaultsTest {

    /** See {@code ApplicationContextSmokeTest.RepresentativeEnvironment} for why this exists. */
    static class MinimalEnvironment
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {

        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            var environment = applicationContext.getEnvironment();
            environment.getPropertySources().remove("dotenv");

            TestPropertyValues.of(
                    "spring.data.mongodb.uri=mongodb://localhost:27017/nutrition_tracker_test",
                    "jwt.secret=smoke-test-signing-secret-long-enough-for-hs256",
                    "jwt.access-expiration=90000000",
                    "gemini.api.key=")
                    .applyTo(environment);
        }
    }

    @Autowired
    private ApplicationContext context;

    @Test
    void theAppStartsOnTheMinimumConfiguration() {
        assertTrue(context.containsBean("authController"));
    }

    @Test
    void aiProviderDefaultsToGroq() {
        assertEquals("groq", context.getBean(AiProperties.class).provider());
    }

    @Test
    void geminiDefaults() {
        GeminiProperties properties = context.getBean(GeminiProperties.class);

        assertEquals("", properties.key());
        assertEquals("gemini-2.0-flash", properties.model());
        assertEquals(55000L, properties.timeout());
        assertEquals(3, properties.retry().maxAttempts());
        assertEquals(700L, properties.retry().initialBackoffMs());
        assertEquals(3000L, properties.retry().maxBackoffMs());
    }

    @Test
    void groqDefaults() {
        GroqProperties properties = context.getBean(GroqProperties.class);

        assertEquals("", properties.key());
        assertEquals("https://api.groq.com/openai/v1/chat/completions", properties.url());
        assertEquals("llama-3.1-8b-instant", properties.model());
        assertEquals(55000L, properties.timeout());
        assertEquals(3, properties.retry().maxAttempts());
        assertEquals(700L, properties.retry().initialBackoffMs());
        assertEquals(3000L, properties.retry().maxBackoffMs());
    }

    @Test
    void nutritionProviderDefaults() {
        assertEquals("spoonacular,ai",
                context.getBean(NutritionProviderProperties.class).providerChain());

        // An unset key means "not configured", which is how a provider opts itself out.
        assertEquals("", context.getBean(SpoonacularProperties.class).key());
        assertEquals(20000L, context.getBean(SpoonacularProperties.class).timeout());
        assertEquals("", context.getBean(UsdaProperties.class).key());
        assertEquals(20000L, context.getBean(UsdaProperties.class).timeout());
    }

    @Test
    void mongoTuningDefaults() {
        MongoTuningProperties properties = context.getBean(MongoTuningProperties.class);

        assertEquals(20000, properties.connectTimeoutMs());
        assertEquals(20000, properties.socketReadTimeoutMs());
        assertEquals(45000, properties.serverSelectionTimeoutMs());
        assertEquals(10000, properties.heartbeatFrequencyMs());
    }

    @Test
    void corsDefaultsToAnyOrigin() {
        assertEquals("*", context.getBean(CorsProperties.class).allowedOrigins());

        var source = (UrlBasedCorsConfigurationSource) context.getBean("corsConfigurationSource", CorsConfigurationSource.class);
        var configuration = source.getCorsConfigurations().get("/**");
        assertEquals(List.of("*"), configuration.getAllowedOrigins());
    }

    @Test
    void vapiAssistantIdsStayNullSoTheSharedFallbackCanTell() {
        VapiProperties properties = context.getBean(VapiProperties.class);

        assertEquals("", properties.publicKey());
        assertEquals("", properties.webhookSecret());
        // Unset (null) is distinguishable from explicitly empty, which is what makes the
        // shared-assistant fallback work; with nothing set at all everything resolves empty.
        assertEquals("", properties.resolvedMealAssistantId());
        assertEquals("", properties.resolvedHabitAssistantId());
        assertFalse(properties.dedicatedMealAssistantId().length() > 0);
    }

    @Test
    void apnsVoipDeliveryDefaultsToSafelyDisabled() {
        ApnsVoipProperties properties = context.getBean(ApnsVoipProperties.class);

        assertFalse(properties.enabled());
        assertFalse(properties.hasRequiredMetadata());
        assertEquals("production", properties.normalizedEnvironment());
        assertEquals(10000, properties.connectTimeoutMs());
        assertEquals(10000, properties.requestTimeoutMs());
        assertEquals(120L, properties.dueWindowSeconds());
        assertEquals(30L, properties.retryBackoffSeconds());
        assertEquals(3, properties.maxAttempts());
    }
}
