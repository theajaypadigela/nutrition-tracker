package com.habitbuilder.NutritionTracker.modules.voice;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class VapiWebhookConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(VapiWebhookConfiguration.class);

    @Test
    void startupFailsWhenSecretIsMissingOutsideLocalProfile() {
        contextRunner.withPropertyValues("vapi.webhook-secret=")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(IllegalStateException.class)
                            .rootCause()
                            .hasMessageContaining("vapi.webhook-secret");
                });
    }

    @Test
    void localProfileMayStartWithoutSecretButPolicyStillRejectsRequests() {
        contextRunner
                .withPropertyValues("spring.profiles.active=local", "vapi.webhook-secret=")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(VapiWebhookSecretPolicy.class).accepts("anything")).isFalse();
                });
    }
}
