package com.habitbuilder.NutritionTracker.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataAccessException;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.index.IndexDefinition;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.IndexResolver;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.mongodb.MongoCommandException;
import com.habitbuilder.NutritionTracker.modules.notification.entity.IosVoipDeviceToken;
import com.habitbuilder.NutritionTracker.modules.notification.entity.VoipCallDispatch;
import com.habitbuilder.NutritionTracker.modules.nutrition.entity.NutritionCache;

import java.time.LocalTime;
import java.util.List;

@Configuration
@EnableMongoAuditing
public class MongoConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(MongoConfig.class);

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes(ApplicationReadyEvent event) {
        MongoTemplate mongoTemplate = event.getApplicationContext().getBean(MongoTemplate.class);
        MongoMappingContext mongoMappingContext = event.getApplicationContext().getBean(MongoMappingContext.class);
        IndexResolver resolver = new MongoPersistentEntityIndexResolver(mongoMappingContext);
        for (Class<?> entity : List.of(
                NutritionCache.class,
                IosVoipDeviceToken.class,
                VoipCallDispatch.class)) {
            IndexOperations indexOps = mongoTemplate.indexOps(entity);
            resolver.resolveIndexFor(entity)
                    .forEach(indexDefinition -> ensureIndexSafely(indexOps, indexDefinition, entity));
        }
    }

    private void ensureIndexSafely(IndexOperations indexOps, IndexDefinition indexDefinition, Class<?> entity) {
        try {
            indexOps.ensureIndex(indexDefinition);
        } catch (DataAccessException ex) {
            if (isExistingIndexNameConflict(ex)) {
                LOGGER.warn("Skipping index creation for {} due to existing index name conflict: {}",
                        entity.getSimpleName(), ex.getMostSpecificCause().getMessage());
                return;
            }
            throw ex;
        }
    }

    private boolean isExistingIndexNameConflict(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof MongoCommandException commandException
                    && commandException.getErrorCode() == 85) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    @Bean
    public MongoCustomConversions customConversions() {
        return new MongoCustomConversions(List.of(
                new LocalTimeToStringConverter(),
                new StringToLocalTimeConverter()));
    }

    // LocalTime <-> String converters
    private static class LocalTimeToStringConverter implements Converter<LocalTime, String> {
        @Override
        public String convert(LocalTime source) {
            return source.toString();
        }
    }

    private static class StringToLocalTimeConverter implements Converter<String, LocalTime> {
        @Override
        public LocalTime convert(String source) {
            return LocalTime.parse(source);
        }
    }
}
