package com.habitbuilder.NutritionTracker.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import io.github.cdimascio.dotenv.Dotenv;

import java.io.File;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

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
            // Try multiple possible locations for .env file
            // Priority: backend/.env > .env (in current dir) > ../env, etc.
            String[] possiblePaths = {
                ".env",                                                         // Current directory (backend folder when run from backend)
                "../.env",                                                       // Parent directory (root)
                "../../.env",                                                    // Grandparent directory
                Paths.get(cwd).getParent().toString() + File.separator + ".env" // Parent of cwd
            };
            
            Dotenv dotenv = null;
            String loadedFrom = null;
            
            for (String path : possiblePaths) {
                File envFile = new File(path);
                if (envFile.exists()) {
                    System.out.println("DEBUG: Found .env file at: " + envFile.getAbsolutePath());
                    dotenv = Dotenv.configure()
                            .directory(envFile.getParent() != null ? envFile.getParent() : ".")
                            .filename(".env")
                            .load();
                    loadedFrom = envFile.getAbsolutePath();
                    break;
                }
            }
            
            if (dotenv == null) {
                System.err.println("⚠ WARNING: .env file not found in any expected location");
                System.err.println("  Checked: " + String.join(", ", possiblePaths));
                return;
            }
            
            // Convert dotenv values to a map
            Map<String, Object> envMap = new HashMap<>();
            String[] keys = {
                "GEMINI_API_KEY",
                "JWT_SECRET",
                "JWT_ACCESS_EXPIRATION",
                "VAPI_PRIVATE_KEY",
                "VAPI_PUBLIC_KEY",
                "VAPI_ASSISTANT_ID",
                "VAPI_WEBHOOK_SECRET",
                "MONGODB_URI",
                "SECURITY_LOG_LEVEL"
            };
            
            for (String key : keys) {
                String value = dotenv.get(key);
                if (value != null) {
                    envMap.put(key, value);
                    System.out.println("DEBUG: Loaded " + key + " = " + (key.contains("KEY") ? "***" : value));
                }
            }
            
            if (envMap.isEmpty()) {
                System.err.println("⚠ WARNING: No environment variables loaded from .env file");
                return;
            }
            
            // Add the env variables to Spring's environment (highest priority)
            environment.getPropertySources().addFirst(
                    new MapPropertySource("dotenv", envMap)
            );
            
            System.out.println("✓ Successfully loaded .env file from: " + loadedFrom);
            System.out.println("✓ Loaded " + envMap.size() + " properties");
            System.out.println("✓ GEMINI_API_KEY loaded: " + envMap.containsKey("GEMINI_API_KEY"));
            
        } catch (Exception e) {
            System.err.println("⚠ Error loading .env file: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
