package com.habitbuilder.NutritionTracker.modules.voice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.FilterChain;

class VapiWebhookBodyLimitFilterTest {

    @Test
    void rejectsOversizedWebhookBeforeTheFilterChain() throws Exception {
        VapiWebhookBodyLimitFilter filter = new VapiWebhookBodyLimitFilter(8, new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/food/voice-log");
        request.setServletPath("/food/voice-log");
        request.setContent("payload-too-large".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = org.mockito.Mockito.mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(response.getContentAsString())
                .contains("\"code\":\"PAYLOAD_TOO_LARGE\"");
        verify(chain, never()).doFilter(request, response);
    }
}
