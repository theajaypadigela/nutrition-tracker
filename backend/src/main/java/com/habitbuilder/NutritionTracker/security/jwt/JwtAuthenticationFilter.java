package com.habitbuilder.NutritionTracker.security.jwt;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.lang.NonNull;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.habitbuilder.NutritionTracker.security.CustomUserDetailsService;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

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
        System.out.println("=== JWT Filter === Path: " + request.getServletPath());
        System.out.println("=== JWT Filter === Auth Header: " + (authHeader != null ? "Present" : "Missing"));

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            System.out.println("=== JWT Filter === No valid auth header, continuing without authentication");
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String token = authHeader.substring(7);
            String email = jwtService.extractEmail(token);
            System.out.println("=== JWT Filter === Extracted email: " + email);

            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                var userDetails = userDetailsService.loadUserByUsername(email);
                System.out.println("=== JWT Filter === Loaded user: " + userDetails.getUsername());

                if (jwtService.isValid(token, userDetails.getUsername())) {
                    System.out.println("=== JWT Filter === Token is valid, setting authentication");

                    var authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities());

                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    System.out.println("=== JWT Filter === Authentication set successfully");
                } else {
                    System.out.println("=== JWT Filter === Token validation failed");
                }
            }
        } catch (Exception e) {
            System.err.println("=== JWT Filter === JWT Authentication failed: " + e.getMessage());
            e.printStackTrace();
        }

        filterChain.doFilter(request, response);
    }
}
