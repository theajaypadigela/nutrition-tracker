package com.habitbuilder.NutritionTracker.modules.voice.webhook;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates the Vapi webhook by its shared secret.
 *
 * <p>The webhook is the one endpoint reachable without a JWT, so this is the only thing
 * standing between the internet and "log these meals for this user id". It runs as a filter
 * rather than a check inside the handler for two reasons: authenticating a caller is not the
 * controller's job, and an unauthenticated request is now rejected before its body is
 * deserialised instead of after.
 *
 * <p>An unset secret disables the check, exactly as before — local development posts webhook
 * payloads by hand.
 *
 * <p>Deliberately not a {@code @Component}: Spring Boot auto-registers every Filter bean
 * against all requests, which would put a Vapi secret check in front of the whole API.
 * {@link VapiWebhookFilterRegistration} constructs it and scopes it to the one path.
 */
public class VapiWebhookAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(VapiWebhookAuthenticationFilter.class);
    private static final String SECRET_HEADER = "X-Vapi-Secret";

    private final String expectedSecret;

    public VapiWebhookAuthenticationFilter(String expectedSecret) {
        this.expectedSecret = expectedSecret;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        if (isConfigured() && !expectedSecret.equals(request.getHeader(SECRET_HEADER))) {
            logger.warn("Vapi webhook request rejected — invalid secret");
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isConfigured() {
        return expectedSecret != null && !expectedSecret.isEmpty();
    }
}
