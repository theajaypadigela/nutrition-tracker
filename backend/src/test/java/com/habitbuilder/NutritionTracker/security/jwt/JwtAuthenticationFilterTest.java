package com.habitbuilder.NutritionTracker.security.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.same;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitbuilder.NutritionTracker.security.CustomUserDetailsService;
import com.habitbuilder.NutritionTracker.security.RestAuthenticationEntryPoint;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private JwtTokenProvider jwtTokenProvider;
    @Mock
    private CustomUserDetailsService userDetailsService;
    @Mock
    private HttpServletRequest request;
    @Mock
    private HttpServletResponse response;
    @Mock
    private FilterChain filterChain;
    @Mock
    private AuthenticationEntryPoint authenticationEntryPoint;

    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwtTokenProvider, userDetailsService, authenticationEntryPoint);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void failureLogContainsOnlyRedactedRequestAndErrorMetadata() throws Exception {
        String token = "sensitive.jwt.value";
        String email = "private@example.com";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(request.getServletPath()).thenReturn("/food/2026-08-19");
        when(jwtTokenProvider.extractEmail(token)).thenReturn(email);
        when(userDetailsService.loadUserByUsername(email))
                .thenThrow(new IllegalStateException(email + " " + token));
        Logger logger = (Logger) LoggerFactory.getLogger(JwtAuthenticationFilter.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        try {
            filter.doFilterInternal(request, response, filterChain);
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }

        verify(authenticationEntryPoint).commence(same(request), same(response), any());
        verify(filterChain, never()).doFilter(request, response);
        List<String> messages = appender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .toList();
        assertThat(messages).anyMatch(message -> message.contains(
                "JWT authentication failed: path=/food/2026-08-19, errorType=IllegalStateException"));
        assertThat(messages).noneMatch(message -> message.contains(token) || message.contains(email));
    }

    @Test
    void expiredJwtProducesA401ResponseAndDoesNotContinueTheChain() throws Exception {
        JwtTokenProvider realTokenProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(realTokenProvider, "secret",
                "test-only-jwt-secret-that-is-at-least-thirty-two-bytes");
        ReflectionTestUtils.setField(realTokenProvider, "accessExpiration", -1L);
        String expiredToken = realTokenProvider.generateToken("person@example.com");
        JwtAuthenticationFilter realFilter = new JwtAuthenticationFilter(
                realTokenProvider,
                userDetailsService,
                new RestAuthenticationEntryPoint(new ObjectMapper()));
        MockHttpServletRequest expiredRequest = new MockHttpServletRequest("GET", "/food/2026-08-22");
        expiredRequest.setServletPath("/food/2026-08-22");
        expiredRequest.addHeader("Authorization", "Bearer " + expiredToken);
        MockHttpServletResponse expiredResponse = new MockHttpServletResponse();

        realFilter.doFilterInternal(expiredRequest, expiredResponse, filterChain);

        assertThat(expiredResponse.getStatus()).isEqualTo(401);
        assertThat(expiredResponse.getContentAsString()).contains("\"code\":\"UNAUTHENTICATED\"");
        verify(filterChain, never()).doFilter(expiredRequest, expiredResponse);
        verifyNoInteractions(userDetailsService);
    }
}
