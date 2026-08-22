package com.habitbuilder.NutritionTracker.modules.voice;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class VapiWebhookSecretPolicyTest {

    @Test
    void acceptsOnlyTheMatchingSecretWhenConfigured() {
        VapiWebhookSecretPolicy policy = new VapiWebhookSecretPolicy("expected-secret");

        assertThat(policy.accepts("expected-secret")).isTrue();
        assertThat(policy.accepts("wrong-secret")).isFalse();
        assertThat(policy.accepts(null)).isFalse();
    }

    @Test
    void rejectsEveryRequestWhenConfiguredSecretIsEmpty() {
        VapiWebhookSecretPolicy policy = new VapiWebhookSecretPolicy("");

        assertThat(policy.accepts(null)).isFalse();
        assertThat(policy.accepts("any-secret")).isFalse();
    }

    @Test
    void rejectsEveryRequestWhenConfiguredSecretIsNull() {
        VapiWebhookSecretPolicy policy = new VapiWebhookSecretPolicy(null);

        assertThat(policy.accepts(null)).isFalse();
        assertThat(policy.accepts("any-secret")).isFalse();
    }

    @Test
    void treatsWhitespaceAsAnUnconfiguredSecret() {
        VapiWebhookSecretPolicy policy = new VapiWebhookSecretPolicy(" ");

        assertThat(policy.accepts(null)).isFalse();
        assertThat(policy.accepts("")).isFalse();
        assertThat(policy.accepts(" ")).isFalse();
    }
}
