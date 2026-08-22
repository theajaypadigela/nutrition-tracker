package com.habitbuilder.NutritionTracker.security;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;

/**
 * Provides the user associated with the current authenticated request.
 */
public interface AuthenticatedUserProvider {

    User getAuthenticatedUser();
}
