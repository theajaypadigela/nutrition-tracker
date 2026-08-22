-- Stage A data corrections. This migration is deliberately safe for legacy
-- rows: it backfills before constraining, keeps the newest habit state, and
-- deletes only cache objects whose complete seven-value nutrient payload is
-- explicitly numeric zero.

ALTER TABLE users
    ADD COLUMN timezone varchar(64);

UPDATE users
SET timezone = 'UTC'
WHERE timezone IS NULL OR btrim(timezone) = '';

ALTER TABLE users
    ALTER COLUMN timezone SET DEFAULT 'UTC',
    ALTER COLUMN timezone SET NOT NULL;

ALTER TABLE voice_meal_sessions
    ADD COLUMN provider_call_id varchar(255),
    ADD CONSTRAINT uk_voice_meal_sessions_provider_call_id UNIQUE (provider_call_id);

WITH ranked_habit_entries AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY habit_id, user_id, entry_date
               ORDER BY id DESC
           ) AS duplicate_rank
    FROM habit_entity
)
DELETE FROM habit_entity AS habit_entry
USING ranked_habit_entries AS ranked
WHERE habit_entry.id = ranked.id
  AND ranked.duplicate_rank > 1;

ALTER TABLE habit_entity
    ADD CONSTRAINT uk_habit_entity_habit_user_date
    UNIQUE (habit_id, user_id, entry_date);

DELETE FROM nutrition_cache
WHERE jsonb_typeof(payload) = 'object'
  AND jsonb_typeof(payload -> 'calories') = 'number'
  AND jsonb_typeof(payload -> 'proteinG') = 'number'
  AND jsonb_typeof(payload -> 'carbsG') = 'number'
  AND jsonb_typeof(payload -> 'fatsG') = 'number'
  AND jsonb_typeof(payload -> 'fiberG') = 'number'
  AND jsonb_typeof(payload -> 'sugarG') = 'number'
  AND jsonb_typeof(payload -> 'sodiumMg') = 'number'
  AND (payload ->> 'calories')::numeric = 0
  AND (payload ->> 'proteinG')::numeric = 0
  AND (payload ->> 'carbsG')::numeric = 0
  AND (payload ->> 'fatsG')::numeric = 0
  AND (payload ->> 'fiberG')::numeric = 0
  AND (payload ->> 'sugarG')::numeric = 0
  AND (payload ->> 'sodiumMg')::numeric = 0;
