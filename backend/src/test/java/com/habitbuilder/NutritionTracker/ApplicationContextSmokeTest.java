package com.habitbuilder.NutritionTracker;

import static java.util.concurrent.TimeUnit.MILLISECONDS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.mongo.MongoClientSettingsBuilderCustomizer;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.util.TestPropertyValues;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.habitbuilder.NutritionTracker.config.properties.AiProperties;
import com.habitbuilder.NutritionTracker.config.properties.ApnsVoipProperties;
import com.habitbuilder.NutritionTracker.config.properties.CorsProperties;
import com.habitbuilder.NutritionTracker.config.properties.GeminiProperties;
import com.habitbuilder.NutritionTracker.config.properties.GroqProperties;
import com.habitbuilder.NutritionTracker.config.properties.JwtProperties;
import com.habitbuilder.NutritionTracker.config.properties.MongoTuningProperties;
import com.habitbuilder.NutritionTracker.config.properties.NutritionProviderProperties;
import com.habitbuilder.NutritionTracker.config.properties.SpoonacularProperties;
import com.habitbuilder.NutritionTracker.config.properties.UsdaProperties;
import com.habitbuilder.NutritionTracker.config.properties.VapiProperties;
import com.habitbuilder.NutritionTracker.modules.nutrition.ai.AiTextService;
import com.habitbuilder.NutritionTracker.support.OfflineMongo;
import com.mongodb.MongoClientSettings;

/**
 * Plan task 0.3: the whole application context comes up against a representative property
 * set, and every {@code @ConfigurationProperties} record binds to the value it was given.
 *
 * <p>This also stands in for §6 item 3 ("boot with a full {@code .env} and confirm every
 * property resolves"): the property set below is every entry in
 * {@code EnvConfig.SUPPORTED_PROPERTIES} plus the {@code mongo.*} and {@code cors.*} settings
 * that only reach the app through a properties file, so a setting that stops resolving fails
 * here rather than on someone's device.
 *
 * <p>Binding alone would not prove much, so the last three tests check that the bound values
 * actually reach the things that consume them — the Mongo client customizer, the CORS source
 * and the AI provider selection.
 */
@SpringBootTest
@ContextConfiguration(initializers = ApplicationContextSmokeTest.RepresentativeEnvironment.class)
@Import(OfflineMongo.class)
class ApplicationContextSmokeTest {

    /**
     * Makes this test hermetic, which takes more than {@code @SpringBootTest(properties=…)}.
     *
     * <p>{@code EnvConfig} publishes {@code .env} with
     * {@code getPropertySources().addFirst(…)}, so on any machine that has a {@code .env} it
     * outranks the inlined test properties, the OS environment and the command line alike.
     * Without this the test would pick up a developer's real {@code MONGODB_URI} and depend
     * on a DNS SRV lookup against their live cluster.
     *
     * <p>An {@link ApplicationContextInitializer} is the hook that can win: it runs after
     * every {@code EnvironmentPostProcessor}. It drops the {@code dotenv} source outright and
     * installs the fixed set below.
     */
    static class RepresentativeEnvironment
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {

        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            var environment = applicationContext.getEnvironment();
            environment.getPropertySources().remove("dotenv");

            TestPropertyValues.of(
                    // A plain host, deliberately: a mongodb+srv:// URI would make client
                    // creation do a DNS TXT lookup. Nothing here connects.
                    "spring.data.mongodb.uri=mongodb://localhost:27017/nutrition_tracker_test",
                    "mongo.connect-timeout-ms=1111",
                    "mongo.socket-read-timeout-ms=2222",
                    "mongo.server-selection-timeout-ms=3333",
                    "mongo.heartbeat-frequency-ms=4444",
                    "cors.allowed-origins=https://a.example, https://b.example",
                    "jwt.secret=smoke-test-signing-secret-long-enough-for-hs256",
                    "jwt.access-expiration=90000000",
                    "ai.provider=gemini",
                    "gemini.api.key=test-gemini-key",
                    "gemini.api.model=gemini-test-model",
                    "gemini.api.timeout=12345",
                    "gemini.api.retry.max-attempts=5",
                    "gemini.api.retry.initial-backoff-ms=250",
                    "gemini.api.retry.max-backoff-ms=9000",
                    "groq.api.key=test-groq-key",
                    "groq.api.url=https://groq.test/v1/chat",
                    "groq.api.model=groq-test-model",
                    "groq.api.timeout=23456",
                    "groq.api.retry.max-attempts=4",
                    "groq.api.retry.initial-backoff-ms=300",
                    "groq.api.retry.max-backoff-ms=8000",
                    "spoonacular.api.key=test-spoonacular-key",
                    "spoonacular.api.timeout=34567",
                    "usda.api.key=test-usda-key",
                    "usda.api.timeout=45678",
                    "nutrition.provider-chain=usda,spoonacular,ai",
                    "vapi.public-key=test-public-key",
                    "vapi.webhook-secret=test-webhook-secret",
                    "vapi.assistant-id=shared-assistant",
                    "vapi.meal-assistant-id=meal-assistant",
                    "vapi.habit-assistant-id=habit-assistant",
                    "apns.voip.enabled=false",
                    "apns.voip.team-id=test-team-id",
                    "apns.voip.key-id=test-key-id",
                    "apns.voip.private-key-base64=test-private-key-base64",
                    "apns.voip.bundle-id=com.example.habitbuilder",
                    "apns.voip.environment=sandbox",
                    "apns.voip.connect-timeout-ms=5555",
                    "apns.voip.request-timeout-ms=6666",
                    "apns.voip.due-window-seconds=180",
                    "apns.voip.retry-backoff-seconds=45",
                    "apns.voip.max-attempts=4",
                    "security.log.level=WARN",
                    "server.port=0")
                    .applyTo(environment);
        }
    }

    @Autowired
    private ApplicationContext context;

    @Test
    void contextLoads() {
        assertNotNull(context);
    }

    @Test
    void everyControllerIsInTheContext() {
        List<String> controllers = List.of(
                "authController",
                "profileController",
                "dashboardController",
                "foodEntryController",
                "nutrientPreferenceController",
                "nutritionInsightsController",
                "nutritionReportController",
                "habitController",
                "iosVoipTokenController",
                "mealScheduleController",
                "voiceLogController");

        for (String controller : controllers) {
            assertTrue(context.containsBean(controller), "missing controller bean: " + controller);
        }
    }

    @Test
    void geminiPropertiesBind() {
        GeminiProperties properties = context.getBean(GeminiProperties.class);

        assertEquals("test-gemini-key", properties.key());
        assertEquals("gemini-test-model", properties.model());
        assertEquals(12345L, properties.timeout());
        assertEquals(5, properties.retry().maxAttempts());
        assertEquals(250L, properties.retry().initialBackoffMs());
        assertEquals(9000L, properties.retry().maxBackoffMs());
    }

    @Test
    void groqPropertiesBind() {
        GroqProperties properties = context.getBean(GroqProperties.class);

        assertEquals("test-groq-key", properties.key());
        assertEquals("https://groq.test/v1/chat", properties.url());
        assertEquals("groq-test-model", properties.model());
        assertEquals(23456L, properties.timeout());
        assertEquals(4, properties.retry().maxAttempts());
        assertEquals(300L, properties.retry().initialBackoffMs());
        assertEquals(8000L, properties.retry().maxBackoffMs());
    }

    @Test
    void jwtPropertiesBind() {
        JwtProperties properties = context.getBean(JwtProperties.class);

        assertEquals("smoke-test-signing-secret-long-enough-for-hs256", properties.secret());
        assertEquals(90000000L, properties.accessExpiration());
    }

    @Test
    void vapiPropertiesBindAndResolveTheirFallbacks() {
        VapiProperties properties = context.getBean(VapiProperties.class);

        assertEquals("test-public-key", properties.publicKey());
        assertEquals("test-webhook-secret", properties.webhookSecret());
        assertEquals("meal-assistant", properties.resolvedMealAssistantId());
        assertEquals("habit-assistant", properties.resolvedHabitAssistantId());
        assertEquals("meal-assistant", properties.dedicatedMealAssistantId());
    }

    @Test
    void apnsVoipPropertiesBindWithoutEnablingAnInvalidProvider() {
        ApnsVoipProperties properties = context.getBean(ApnsVoipProperties.class);

        assertEquals(false, properties.enabled());
        assertEquals("test-team-id", properties.teamId());
        assertEquals("test-key-id", properties.keyId());
        assertEquals("test-private-key-base64", properties.privateKeyBase64());
        assertEquals("com.example.habitbuilder", properties.bundleId());
        assertEquals("sandbox", properties.normalizedEnvironment());
        assertEquals(5555, properties.connectTimeoutMs());
        assertEquals(6666, properties.requestTimeoutMs());
        assertEquals(180L, properties.dueWindowSeconds());
        assertEquals(45L, properties.retryBackoffSeconds());
        assertEquals(4, properties.maxAttempts());
    }

    @Test
    void nutritionSpoonacularUsdaAndAiPropertiesBind() {
        assertEquals("usda,spoonacular,ai",
                context.getBean(NutritionProviderProperties.class).providerChain());
        assertEquals("test-spoonacular-key", context.getBean(SpoonacularProperties.class).key());
        assertEquals(34567L, context.getBean(SpoonacularProperties.class).timeout());
        assertEquals("test-usda-key", context.getBean(UsdaProperties.class).key());
        assertEquals(45678L, context.getBean(UsdaProperties.class).timeout());
        assertEquals("gemini", context.getBean(AiProperties.class).provider());
    }

    @Test
    void mongoTuningPropertiesBindAndReachTheClientSettings() {
        MongoTuningProperties properties = context.getBean(MongoTuningProperties.class);
        assertEquals(1111, properties.connectTimeoutMs());
        assertEquals(2222, properties.socketReadTimeoutMs());
        assertEquals(3333, properties.serverSelectionTimeoutMs());
        assertEquals(4444, properties.heartbeatFrequencyMs());

        // Binding is only half of it — check the customizer actually applies them.
        // By name: Boot registers its own standardMongoSettingsCustomizer alongside ours.
        MongoClientSettings.Builder builder = MongoClientSettings.builder();
        context.getBean("mongoClientSettingsBuilderCustomizer", MongoClientSettingsBuilderCustomizer.class)
                .customize(builder);
        MongoClientSettings settings = builder.build();

        assertEquals(1111, settings.getSocketSettings().getConnectTimeout(MILLISECONDS));
        assertEquals(2222, settings.getSocketSettings().getReadTimeout(MILLISECONDS));
        assertEquals(3333, settings.getClusterSettings().getServerSelectionTimeout(MILLISECONDS));
        assertEquals(4444, settings.getServerSettings().getHeartbeatFrequency(MILLISECONDS));
    }

    @Test
    void corsPropertiesBindAndReachTheCorsConfiguration() {
        assertEquals("https://a.example, https://b.example",
                context.getBean(CorsProperties.class).allowedOrigins());

        // SecurityConfig splits and trims the raw value; that normalisation is the contract.
        // By name: Spring Security registers its own CorsConfigurationSource too.
        var source = (UrlBasedCorsConfigurationSource) context.getBean("corsConfigurationSource", CorsConfigurationSource.class);
        var configuration = source.getCorsConfigurations().get("/**");

        assertNotNull(configuration);
        assertEquals(List.of("https://a.example", "https://b.example"),
                configuration.getAllowedOrigins());
    }

    @Test
    void theConfiguredAiProviderIsTheActiveOne() {
        assertEquals("gemini", context.getBean(AiTextService.class).getActiveProvider());
    }
}
