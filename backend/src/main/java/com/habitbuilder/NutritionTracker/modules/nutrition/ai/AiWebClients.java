package com.habitbuilder.NutritionTracker.modules.nutrition.ai;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import reactor.netty.http.client.HttpClient;

/**
 * Builds the {@link WebClient} the AI text clients use. LLM calls are slow and the default
 * connector has no read timeout at all, so every provider needs the same bounded setup:
 * without it a stalled connection hangs a request thread indefinitely instead of failing
 * into {@link AiRetryPolicy}.
 */
public final class AiWebClients {

    private static final int CONNECT_TIMEOUT_MILLIS = 10_000;
    private static final int WRITE_TIMEOUT_MILLIS = 30_000;

    private AiWebClients() {
    }

    /** A client whose connect, read, write and response timeouts are all bounded. */
    public static WebClient timeoutBounded(WebClient.Builder builder, long timeoutMillis) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MILLIS)
                .option(ChannelOption.SO_KEEPALIVE, true)
                .responseTimeout(Duration.ofMillis(timeoutMillis))
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(timeoutMillis, TimeUnit.MILLISECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(WRITE_TIMEOUT_MILLIS, TimeUnit.MILLISECONDS)));

        return builder
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }
}
