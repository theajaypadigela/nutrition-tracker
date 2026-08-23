package com.habitbuilder.NutritionTracker.security.jwt;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.lang.NonNull;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.habitbuilder.NutritionTracker.security.CustomUserDetailsService;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtTokenProvider jwtService;
    private final CustomUserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtTokenProvider jwtService,
            CustomUserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getServletPath();
        return path.equals("/auth/login") || path.equals("/auth/register");
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        log.debug("Filtering {} (Authorization header {})",
                request.getServletPath(), authHeader != null ? "present" : "missing");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.debug("No bearer token, continuing without authentication");
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String token = authHeader.substring(7);
            String email = jwtService.extractEmail(token);
            log.debug("Extracted subject from token");

            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                var userDetails = userDetailsService.loadUserByUsername(email);
                log.debug("Loaded user details for the token subject");

                if (jwtService.isValid(token, userDetails.getUsername())) {
                    log.debug("Token is valid, setting authentication");

                    var authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities());

                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    log.debug("Authentication set successfully");
                } else {
                    log.warn("Token validation failed");
                }
            }
        } catch (Exception e) {
            log.warn("JWT authentication failed: {}", e.getMessage(), e);
        }

        filterChain.doFilter(request, response);
    }
}
