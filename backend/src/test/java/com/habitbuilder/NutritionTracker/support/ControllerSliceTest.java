package com.habitbuilder.NutritionTracker.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.core.annotation.AliasFor;

import com.habitbuilder.NutritionTracker.security.jwt.JwtAuthenticationFilter;

/**
 * A {@link WebMvcTest} slice for one controller, wired the way every controller in this
 * codebase needs.
 *
 * <p>Two adjustments, both here rather than repeated ten times:
 *
 * <ul>
 * <li>{@code JwtAuthenticationFilter} is excluded from the slice's scan. {@code @WebMvcTest}
 * includes {@code Filter} beans by design, and that one needs a {@code JwtTokenProvider} and
 * a {@code CustomUserDetailsService} no controller test cares about.</li>
 * <li>{@code addFilters = false} runs the handler without the security chain.
 * {@code spring-security-test} is not a dependency (C4), so authenticating a request is not
 * available; the endpoints that answer an anonymous caller with their own body still assert
 * that path through a mocked {@code CurrentUserProvider}.</li>
 * </ul>
 *
 * <p>What these slices pin is the HTTP contract — route, method, status, and the JSON shape
 * the client parses. Service behaviour belongs in the service's own unit test.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@WebMvcTest(excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
public @interface ControllerSliceTest {

    /** The controller under test. */
    @AliasFor(annotation = WebMvcTest.class, attribute = "controllers")
    Class<?>[] value() default {};
}
