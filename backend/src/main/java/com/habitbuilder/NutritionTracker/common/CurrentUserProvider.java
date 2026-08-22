package com.habitbuilder.NutritionTracker.common;

import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;

/**
 * Single access point for the authenticated user. Services and controllers depend on this
 * instead of reading {@link SecurityContextHolder} themselves.
 *
 * <p>Two flavours, because callers legitimately want different things: {@link #currentUser()}
 * for the majority, which treat an unauthenticated request as a 401; and
 * {@link #findCurrentUser()} for the handful of endpoints on {@code permitAll} paths that
 * answer an anonymous caller with their own response shape rather than an error.
 */
@Component
public class CurrentUserProvider {

    public User currentUser() {
        return findCurrentUser()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated"));
    }

    public String currentUserId() {
        return currentUser().getId();
    }

    /**
     * The authenticated user, or empty when the request carried no usable authentication.
     *
     * <p>Presence of a {@link User} principal is the whole test, deliberately: the JWT filter
     * is the only thing that populates the context, and it only ever does so for a validated
     * token. An extra {@code isAuthenticated()} check would add nothing in production and
     * would reject the two-argument authentication token that tests construct.
     */
    public Optional<User> findCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }
}
