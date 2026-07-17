package com.habitbuilder.NutritionTracker.common;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;

/**
 * Single access point for the authenticated user. Services should depend on
 * this instead of reading {@link SecurityContextHolder} themselves.
 */
@Component
public class CurrentUserProvider {

    public User currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User user) {
            return user;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
    }

    public String currentUserId() {
        return currentUser().getId();
    }
}
