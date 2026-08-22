package com.habitbuilder.NutritionTracker.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.modules.auth.entity.User;

class SpringSecurityAuthenticatedUserProviderTest {

    private final SpringSecurityAuthenticatedUserProvider provider =
            new SpringSecurityAuthenticatedUserProvider();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returnsUserPrincipalFromSpringSecurityContext() {
        User user = new User();
        user.setId(41L);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of()));

        assertThat(provider.getAuthenticatedUser()).isSameAs(user);
    }

    @Test
    void rejectsMissingAuthenticationWithExistingUnauthorizedStatus() {
        assertThatThrownBy(provider::getAuthenticatedUser)
                .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                    assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(exception.getReason()).isEqualTo("User not authenticated");
                });
    }

    @Test
    void rejectsNonUserPrincipalWithoutExposingPrincipalDetails() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("private@example.com", null, List.of()));

        assertThatThrownBy(provider::getAuthenticatedUser)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }
}
