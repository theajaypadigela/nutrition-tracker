package com.habitbuilder.NutritionTracker.config;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import org.apache.commons.logging.Log;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.logging.DeferredLogFactory;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import io.github.cdimascio.dotenv.Dotenv;
import io.github.cdimascio.dotenv.DotenvEntry;

/**
 * Loads {@code .env} values into Spring's environment. Runs as an
 * {@link EnvironmentPostProcessor}, i.e. before any bean exists.
 *
 * <p>Each supported setting is named <b>once</b>, by its Spring property name, in
 * {@link #SUPPORTED_PROPERTIES}. The {@code .env} key is derived from it by the same rule
 * Spring itself uses for environment variables — uppercase, with {@code .} and {@code -}
 * becoming {@code _} — so {@code gemini.api.retry.max-attempts} is fed by
 * {@code GEMINI_API_RETRY_MAX_ATTEMPTS}. Only settings whose historical {@code .env} name
 * predates that convention need an entry in {@link #LEGACY_KEY_OVERRIDES}; there are three.
 *
 * <p>Both spellings are published: the derived {@code .env} key and the Spring property name,
 * as before, so nothing that reads either form changes.
 */
public class EnvConfig implements EnvironmentPostProcessor {

    /** Every setting this loader supports, named by its Spring property. Add one line here. */
    private static final List<String> SUPPORTED_PROPERTIES = List.of(
            "server.port",
            "ai.provider",
            "gemini.api.key",
            "gemini.api.model",
            "gemini.api.timeout",
            "gemini.api.retry.max-attempts",
            "gemini.api.retry.initial-backoff-ms",
            "gemini.api.retry.max-backoff-ms",
            "groq.api.key",
            "groq.api.url",
            "groq.api.model",
            "groq.api.timeout",
            "groq.api.retry.max-attempts",
            "groq.api.retry.initial-backoff-ms",
            "groq.api.retry.max-backoff-ms",
            "spoonacular.api.key",
            "spoonacular.api.timeout",
            "usda.api.key",
            "jwt.secret",
            "jwt.access-expiration",
            "vapi.private-key",
            "vapi.public-key",
            "vapi.assistant-id",
            "vapi.meal-assistant-id",
            "vapi.habit-assistant-id",
            "vapi.webhook-secret",
            "spring.data.mongodb.uri",
            "security.log.level");

    /**
     * The three settings whose {@code .env} key does not follow the derivation rule. Each is
     * kept for compatibility with existing {@code .env} files, not because it is preferable.
     */
    private static final Map<String, String> LEGACY_KEY_OVERRIDES = Map.of(
            "gemini.api.model", "GEMINI_MODEL",
            "groq.api.model", "GROQ_MODEL",
            "spring.data.mongodb.uri", "MONGODB_URI");

    private final Log logger;

    /**
     * @param logFactory Boot hands this in because logging is not initialised this early; the
     *                   lines are buffered and replayed once it is.
     */
    public EnvConfig(DeferredLogFactory logFactory) {
        this.logger = logFactory.getLog(EnvConfig.class);
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String cwd = System.getProperty("user.dir");
        logger.debug("Current working directory: " + cwd);

        try {
            String[] possiblePaths = buildPossibleEnvPaths(cwd);

            Dotenv dotenv = null;
            String loadedFrom = null;

            for (String path : possiblePaths) {
                File envFile = new File(path);
                if (!envFile.exists()) {
                    continue;
                }

                logger.debug("Found .env file at: " + envFile.getAbsolutePath());
                dotenv = Dotenv.configure()
                        .directory(envFile.getParent() != null ? envFile.getParent() : ".")
                        .filename(".env")
                        .load();
                loadedFrom = envFile.getAbsolutePath();
                break;
            }

            if (dotenv == null) {
                logger.warn(".env file not found in any expected location. Checked: "
                        + String.join(", ", possiblePaths));
                return;
            }

            Map<String, Object> envMap = new HashMap<>();
            Set<String> consumedKeys = new LinkedHashSet<>();

            for (String property : SUPPORTED_PROPERTIES) {
                String envKey = envKeyFor(property);
                String value = dotenv.get(envKey);
                if (value == null) {
                    continue;
                }

                consumedKeys.add(envKey);
                envMap.put(envKey, value);
                envMap.put(property, value);
                logger.debug("Loaded " + envKey + " -> " + property + " = " + maskValue(envKey, value));
            }

            if (envMap.isEmpty()) {
                logger.warn("No supported environment variables found in .env file: " + loadedFrom);
                return;
            }

            environment.getPropertySources().addFirst(new MapPropertySource("dotenv", envMap));

            logger.info("Loaded " + consumedKeys.size() + " settings from .env at " + loadedFrom);
            warnAboutUnsupportedKeys(dotenv, consumedKeys);
        } catch (Exception e) {
            logger.warn("Error loading .env file: " + e.getMessage(), e);
        }
    }

    /**
     * Warns about keys the {@code .env} declares that this loader ignores. Without this a
     * typo, or a setting that simply is not wired up, is silently dropped — which is the
     * failure mode the single-list design above exists to prevent.
     */
    private void warnAboutUnsupportedKeys(Dotenv dotenv, Set<String> consumedKeys) {
        Set<String> ignored = new TreeSet<>();
        for (DotenvEntry entry : dotenv.entries(Dotenv.Filter.DECLARED_IN_ENV_FILE)) {
            if (!consumedKeys.contains(entry.getKey())) {
                ignored.add(entry.getKey());
            }
        }

        if (!ignored.isEmpty()) {
            logger.warn("Ignoring " + ignored.size() + " .env key(s) with no supported property: "
                    + String.join(", ", ignored));
        }
    }

    /** {@code gemini.api.retry.max-attempts} -> {@code GEMINI_API_RETRY_MAX_ATTEMPTS}. */
    static String envKeyFor(String property) {
        String override = LEGACY_KEY_OVERRIDES.get(property);
        if (override != null) {
            return override;
        }
        return property.toUpperCase(Locale.ROOT).replace('.', '_').replace('-', '_');
    }

    private String[] buildPossibleEnvPaths(String cwd) {
        Path cwdPath = Paths.get(cwd).toAbsolutePath().normalize();
        Path parentPath = cwdPath.getParent();
        return new String[] {
                ".env",
                "../.env",
                "../../.env",
                parentPath != null ? parentPath.resolve(".env").toString() : ".env"
        };
    }

    private String maskValue(String key, String value) {
        if (value == null) {
            return "<null>";
        }

        String upperKey = key.toUpperCase(Locale.ROOT);
        if (upperKey.contains("KEY")
                || upperKey.contains("SECRET")
                || upperKey.contains("TOKEN")
                || upperKey.contains("URI")
                || upperKey.contains("PASSWORD")) {
            return "***";
        }
        return value;
    }
}
