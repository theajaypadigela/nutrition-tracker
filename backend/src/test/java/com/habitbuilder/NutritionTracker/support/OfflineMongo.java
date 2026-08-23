package com.habitbuilder.NutritionTracker.support;

import org.mockito.Mockito;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.index.IndexOperations;

/**
 * Lets a full {@code @SpringBootTest} context start without a reachable MongoDB.
 *
 * <p>Only one thing in this application actually talks to Mongo during startup:
 * {@code MongoConfig.ensureIndexes} listens for {@code ApplicationReadyEvent} and calls
 * {@code indexOps(...).ensureIndex(...)}, rethrowing any {@code DataAccessException} that is
 * not an index-name conflict. Everything else — the client, the database factory, the
 * repository proxies — is created without connecting. So a context-load test does not need a
 * database; it needs that one call to be inert.
 *
 * <p>This overrides exactly that. The template, its converter and the whole mapping context
 * stay real, because Spring Data builds repository metadata from them and a mocked
 * {@code MongoTemplate} fails at repository creation with a {@code ClassCastException} on
 * {@code MongoPersistentEntity}. Only {@code indexOps} is replaced.
 *
 * <p>Worth stating plainly, since the test now hides it: <b>the application as written cannot
 * finish starting if Mongo is unreachable at boot</b>, because that listener's throw
 * propagates out of {@code SpringApplication.run}.
 */
@TestConfiguration(proxyBeanMethods = false)
public class OfflineMongo {

    @Bean
    public MongoTemplate mongoTemplate(MongoDatabaseFactory databaseFactory, MongoConverter converter) {
        return new MongoTemplate(databaseFactory, converter) {

            @Override
            public IndexOperations indexOps(String collectionName) {
                return Mockito.mock(IndexOperations.class);
            }

            @Override
            public IndexOperations indexOps(Class<?> entityClass) {
                return Mockito.mock(IndexOperations.class);
            }
        };
    }
}
