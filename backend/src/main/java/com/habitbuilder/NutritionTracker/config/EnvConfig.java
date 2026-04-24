package com.habitbuilder.NutritionTracker.config;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import io.github.cdimascio.dotenv.Dotenv;

/**
 * EnvironmentPostProcessor that loads .env file variables into Spring's environment.
 * This runs early in the Spring Boot startup process, before beans are created.
 */
public class EnvConfig implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String cwd = System.getProperty("user.dir");
        System.out.println("DEBUG: Current working directory: " + cwd);

        try {
            String[] possiblePaths = buildPossibleEnvPaths(cwd);

            Dotenv dotenv = null;
            String loadedFrom = null;

            for (String path : possiblePaths) {
                File envFile = new File(path);
                if (!envFile.exists()) {
                    continue;
                }

                System.out.println("DEBUG: Found .env file at: " + envFile.getAbsolutePath());
                dotenv = Dotenv.configure()
                        .directory(envFile.getParent() != null ? envFile.getParent() : ".")
                        .filename(".env")
                        .load();
                loadedFrom = envFile.getAbsolutePath();
                break;
            }

            if (dotenv == null) {
                System.err.println("WARNING: .env file not found in any expected location");
                System.err.println("Checked: " + String.join(", ", possiblePaths));
                return;
            }

            Map<String, Object> envMap = new HashMap<>();
            for (String key : getSupportedKeys()) {
                String value = dotenv.get(key);
                if (value == null) {
                    continue;
                }

                envMap.put(key, value);
                System.out.println("DEBUG: Loaded " + key + " = " + maskValue(key, value));
            }

            if (envMap.isEmpty()) {
                System.err.println("WARNING: No environment variables loaded from .env file");
                return;
            }

            environment.getPropertySources().addFirst(new MapPropertySource("dotenv", envMap));

            System.out.println("SUCCESS: Loaded .env file from: " + loadedFrom);
            System.out.println("SUCCESS: Loaded " + envMap.size() + " properties");
            System.out.println("SUCCESS: AI_PROVIDER loaded: " + envMap.containsKey("AI_PROVIDER"));
            System.out.println("SUCCESS: GROQ_API_KEY loaded: " + envMap.containsKey("GROQ_API_KEY"));
            System.out.println("SUCCESS: GEMINI_API_KEY loaded: " + envMap.containsKey("GEMINI_API_KEY"));
        } catch (Exception e) {
            System.err.println("WARNING: Error loading .env file: " + e.getMessage());
            e.printStackTrace();
        }
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

    private String[] getSupportedKeys() {
        return new String[] {
                "AI_PROVIDER",
                "GEMINI_API_KEY",
                "GEMINI_MODEL",
                "GEMINI_API_TIMEOUT",
                "GEMINI_API_RETRY_MAX_ATTEMPTS",
                "GEMINI_API_RETRY_INITIAL_BACKOFF_MS",
                "GEMINI_API_RETRY_MAX_BACKOFF_MS",
                "GROQ_API_KEY",
                "GROQ_API_URL",
                "GROQ_MODEL",
                "GROQ_API_TIMEOUT",
                "GROQ_API_RETRY_MAX_ATTEMPTS",
                "GROQ_API_RETRY_INITIAL_BACKOFF_MS",
                "GROQ_API_RETRY_MAX_BACKOFF_MS",
                "SPOONACULAR_API_KEY",
                "SPOONACULAR_API_TIMEOUT",
                "USDA_API_KEY",
                "JWT_SECRET",
                "JWT_ACCESS_EXPIRATION",
                "VAPI_PRIVATE_KEY",
                "VAPI_PUBLIC_KEY",
                "VAPI_ASSISTANT_ID",
                "VAPI_MEAL_ASSISTANT_ID",
                "VAPI_HABIT_ASSISTANT_ID",
                "VAPI_WEBHOOK_SECRET",
                "MONGODB_URI",
                "SECURITY_LOG_LEVEL"
        };
    }

    private String maskValue(String key, String value) {
        if (value == null) {
            return "<null>";
        }

        String upperKey = key.toUpperCase();
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
