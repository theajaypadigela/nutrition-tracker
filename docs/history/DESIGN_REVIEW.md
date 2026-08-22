# Software Design & Best-Practices Review

**Project:** Nutrition Tracker (Spring Boot 3.4 + MongoDB backend, React Native 0.83 frontend)
**Date:** 2026-07-13
**Scope:** Entire application — 112 Java files (~7.9k LOC), 220 TS/TSX files (~23k LOC excluding generated UI primitives), configuration, tests, and repository hygiene. Every backend module and every non-generated frontend module was read; all findings cited below were verified against the current working tree.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Critical Issues (fix before anything else)](#3-critical-issues)
4. [Backend Findings](#4-backend-findings)
5. [Frontend Findings](#5-frontend-findings)
6. [Repository Hygiene](#6-repository-hygiene)
7. [Test Coverage](#7-test-coverage)
8. [Prioritized Remediation Roadmap](#8-prioritized-remediation-roadmap)
9. [Principle-by-Principle Summary](#9-principle-by-principle-summary)

---

## 1. Executive Summary

The application has a fundamentally sound shape: the backend is a modular monolith with consistent `controller → service → repository` layering and constructor injection throughout; the frontend has a deliberate `screen → hook → service → API client` flow, a dependency-injected typed API layer, and an exemplary pure-core/side-effect-shell notifications subsystem. Prior refactoring effort is visible and much of it is good.

However, the review found **~90 distinct issues**, including several critical ones:

| # | Issue | Severity |
|---|-------|----------|
| 1 | Live production secrets (Mongo Atlas credentials, 4 AI/data API keys, Vapi keys) in plaintext `application.properties`; README instructs baking them into the JAR; an old commit contains a DB password | Critical |
| 2 | The Vapi voice webhook (`/food/voice-log`) is effectively unauthenticated and writes meals for **any user ID supplied by the caller** | Critical |
| 3 | JWT signing secret is a hardcoded, guessable string (`verylongsecretkey…`) — tokens are forgeable | Critical |
| 4 | Property-key mismatch (`gemini.api-key` vs `${gemini.api.key}`): all pasted API keys and the Mongo URI are silently **dead config**; Mongo falls back to `localhost`, the provider chain degenerates to AI-only, and the missing-default Gemini key can fail startup | Critical |
| 5 | Declared Mongo indexes (including the unique indexes the code's get-or-create logic relies on) are **never created** — auto-index-creation is off and the manual ensure loop covers one collection | Critical |
| 6 | Micronutrient status labels on the live report screen are **hardcoded** (`'Good ✓'`, `'Moderate'`, `'High'`) — fabricated health information regardless of actual intake | Critical |
| 7 | Frontend talks to a hardcoded `http://` EC2 URL — Bearer tokens transit plaintext HTTP | High |
| 8 | Any network failure during app cold-start deletes the auth token and logs the user out | High |

Beyond these, the dominant systemic themes are:

- **Configuration drift** — config exists in three layers (properties, `EnvConfig` whitelist, `@Value` defaults) that disagree with each other and with the docs.
- **Duplication** — ~200 lines copied between the two AI clients; the same retry/sanitize/backoff logic in three classes; on the frontend, 6 color palettes, 7 nutrient-status implementations, 6 bottom-sheet implementations, 5 macro-row renderings, and 2 complete meal-reminder features on one screen.
- **Dead code** — ~150 lines of orphaned nutrition parsing in `GeminiService`; ~2,000 lines of unreachable frontend components; dead hooks, dead config keys, zero-byte files.
- **Inconsistent error handling** — three dialects on the backend (`ResponseStatusException`, `IllegalArgumentException`→500, controller-local try/catch), and widespread swallow-and-log-to-console on the frontend.
- **Type-safety opt-outs** — `strict: false`, the auth-critical HTTP client in untyped JS, ten `as any`/`as never` navigation casts.
- **Test gaps concentrated exactly where risk is highest** — the food module (largest, most algorithmic) has zero backend tests; the reminder reconciliation orchestrator and call lifecycle have none on the frontend.

---

## 2. Architecture Overview

### Backend (as-built)

```
com.habitbuilder.NutritionTracker
├── common/          CurrentUserProvider, GlobalExceptionHandler
├── config/          SecurityConfig, MongoConfig, EnvConfig (dotenv post-processor)
├── security/jwt/    JwtTokenProvider, JwtAuthenticationFilter
└── modules/
    ├── auth/        controller / dto / entity / repository / service
    ├── food/        FoodLogService, NutritionReportService, NutrientPreferenceService,
    │                NutritionInsightsService, FoodLogQueries (batch reads), dto/, seed/
    ├── dashboard/   thin composer over food + habit
    ├── habit/       HabitService (470 lines), HabitReminderScheduler
    ├── mealschedule/ textbook mini-module
    ├── nutrition/   NutritionEnrichmentService, cache, providers (Spoonacular/USDA/AI),
    │                GeminiService, GroqService, units/
    └── voice/       VoiceLogController, VoiceLogService (482 lines), dto/
```

**Module graph:** `dashboard → {food, habit}` (clean), `voice → food` (deliberate), but **`food ↔ nutrition` is a genuine dependency cycle** — `NutritionEnrichmentService` imports `food.FoodEntry` and `food.FoodEntryRepository` while food services depend on nutrition. Generic AI-text infrastructure (`AiTextService`, `AiJsonSupport`, `VoiceInterpretResult`) is misfiled under `nutrition/` and consumed by `habit` and `voice`.

**Nutrition enrichment chain (as configured):** cache → provider chain (`spoonacular,ai` default; USDA opt-in) → scale to logged quantity → persist per-entry. In practice, because the Spoonacular key binds to the wrong property name (see BE-4), **the chain degenerates to AI-only today**.

### Frontend (as-built)

```
src/
├── api/client.js            single axios instance (token interceptor, 401 handler) — untyped JS
├── services/api/            typed domain APIs (authApi, foodLogApi, …), injectable HttpClient (good DIP)
├── services/notifications/  26 modules — pure cores + side-effect shells (strongest layer)
├── context/AuthContext.tsx  the only context; owns user/auth lifecycle
├── hooks/                   controller hooks per screen (useDashboard, useFoodLog, …)
├── navigation/              typed param lists + routeNames (partially bypassed with casts)
├── screens/                 auth / main / onboarding
└── components/              feature components + generated gluestack ui/
```

The two API directories are **not** accidental duplication: `services/api` is the canonical typed layer; `api/client.js` is the shared axios instance underneath it. The problem is the *bypasses* (five modules call `apiClient` with raw endpoint strings) and that the auth-critical client is plain JavaScript.

**What is notably good and should be treated as the house pattern:**
- Backend: constructor injection everywhere, `CurrentUserProvider` abstraction, `FoodLogQueries` batch read-side helper, the food module's four-way service split.
- Frontend: `services/api` injectable-client design; `services/notifications` pure-core/shell split with versioned AsyncStorage keys and a structured logger; screen-logic extraction into controller hooks; `theme/tokens.ts` + `authTheme.ts` as the token pipeline; `voiceSessionCopy.ts` as a copy module.

The recommendations below repeatedly amount to: *apply the codebase's own best pattern to the places that don't use it yet.*

---

## 3. Critical Issues

### CR-1. Rotate and externalize every secret — `backend/src/main/resources/application.properties:9-33`

Real credentials sit in plaintext: Mongo Atlas URI with username/password, Gemini/Groq/USDA/Spoonacular API keys, Vapi private key, and the JWT secret. The file is currently gitignored, but:

- `backend/README.md` instructs the operator to "set these values before packaging", which **bakes secrets into the distributed JAR**;
- git history contains an older committed version with a Postgres password (commit `8ed39f1`);
- the JWT secret is the dictionary string `verylongsecretkeyverylongsecretkey` — anyone who has seen it can forge tokens for any user (`JwtTokenProvider.java:14-21`).

**Actions:**
1. Rotate every credential listed above (Mongo user, all four API keys, Vapi keys). Treat them as compromised.
2. Generate a random ≥256-bit JWT secret per environment; fail startup if it equals a known default.
3. Move all secrets to `.env` / real environment variables (the `EnvConfig` post-processor already supports this); commit `application.properties.example` with placeholders instead.
4. Delete the dead Postgres block (`spring.datasource.*`, `spring.jpa.*` — there is no JPA dependency in `pom.xml`).

### CR-2. Secure the voice webhook — `VoiceLogController.java:50-54`, `SecurityConfig.java:64`, `VoiceLogService.java:239-244`

`/food/voice-log` is `permitAll()`. Secret validation is **skipped entirely when the configured secret is blank**, the committed value is the guessable string `vapi-secret`, and the target user is read from attacker-controllable webhook metadata:

```java
if (callMetadata != null && callMetadata.containsKey("userId")) {
    return callMetadata.get("userId").toString();
```

Anyone who can reach the server can inject food logs for any user.

**Actions:** make the webhook secret mandatory (fail startup if blank), rotate it to a long random value, compare with `MessageDigest.isEqual(...)` (constant-time), move the check into a filter, and prefer verifying Vapi's signed webhook payloads over a static header.

### CR-3. Fix the property-key mismatch — `application.properties:26-33` vs `@Value` bindings

The properties file uses dash-form keys; the code binds dot-form keys. `@Value` does **not** apply relaxed binding to property files:

| Written in properties | Bound by code | Effect today |
|---|---|---|
| `gemini.api-key` | `${gemini.api.key}` (no default) | dead; app **fails to boot** unless the env var exists elsewhere |
| `groq.api-key` | `${groq.api.key:}` | dead; Groq reports "not configured" |
| `usda.api-key`, `spoonacular.api-key` | `${usda.api.key:}`, `${spoonacular.api.key:}` | dead; provider chain degenerates to AI-only |
| `mongodb.uri` | `spring.data.mongodb.uri` (Spring's key) | dead; **Mongo silently falls back to `localhost:27017`** |

**Actions:** rename the properties to the exact dotted keys, give `gemini.api.key` an empty default plus an `isConfigured()` guard (like the other providers), and delete the dead `copilot.bridge.*` block (grep confirms no code reads it — the in-file comment claiming otherwise is stale).

### CR-4. Actually create the Mongo indexes — `config/MongoConfig.java:37`

`spring.data.mongodb.auto-index-creation` is unset (default `false` in Boot 3) and the manual ensure loop covers **only `NutritionCache`**:

```java
for (Class<?> entity : List.of(NutritionCache.class)) {
```

So the unique indexes on `food_logs{userId,logDate}`, `user_nutrient_preferences{userId,nutrientId}`, `meal_schedules.userId` — and every query index — do not exist. This converts the get-or-create races (BE-10) from "benign duplicate-key exception" into **real silent data duplication**, and every date-range query is a collection scan.

**Actions:** add `FoodLog, FoodEntry, UserNutrientPreference, MealSchedule, Habit, HabitEntity, NutritionDetails, User` to the ensure loop; add the missing annotations: `@Indexed` on `FoodEntry.foodLogId` and `Habit.userId`, unique `@CompoundIndex` on `HabitEntity{habitId,userId,entryDate}`, and an index supporting the scheduler's `{status, rescheduledTime}` query.

### CR-5. Compute the micronutrient statuses — `frontend/src/components/nutrition-report/constants.tsx:79,93,107`

On the live Nutrition Report screen, sugar always shows **"Good ✓"**, fiber always **"Moderate"**, sodium always **"High"** — the labels are static constants; `current`/`goal` are ignored. This is fabricated health information shown to users.

**Action:** compute status from `current/goal` through a single shared `nutrientStatus(value, target, direction)` utility (see FE-20 — the weekly-summary `statusOf` is the best existing candidate) and map to label/colors.

### CR-6. Serve the API over HTTPS and remove the hardcoded URL — `frontend/src/config/env.ts:9-10`

```ts
export const API_BASE_URL =
  'http://ec2-3-109-239-9.ap-south-1.compute.amazonaws.com:5000/';
```

Bearer tokens currently transit plaintext HTTP to a hardcoded host committed in source, while `react-native-dotenv` is already installed and `.env.example` falsely claims the app is pinned to localhost. **Actions:** put TLS in front of the API (the EC2 host runs behind Nginx per the backend README — terminate TLS there), wire the URL through `react-native-dotenv` or build flavors, and update `.env.example`.

---

## 4. Backend Findings

### 4.1 Security & auth

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| BE-1 | High | Every request prints 4-8 `System.out` lines from the JWT filter, including the token's email (PII); all JWT failures are caught as `Exception`, `printStackTrace()`'d, and silently downgraded to anonymous | `security/jwt/JwtAuthenticationFilter.java:44-79` |
| BE-2 | High | No request validation anywhere despite `spring-boot-starter-validation` on the classpath: no DTO carries `@NotBlank`/`@Email`/`@Size`; only `FoodController` uses `@Valid`. Registration accepts null/empty email and password | `modules/auth/dto/AuthRequest.java`, all controllers |
| BE-3 | Medium | CORS defaults to `*` for all paths/methods/headers, and the fallback re-adds `*` even when the operator sets an empty value; `CORS_ALLOWED_ORIGINS` is missing from `EnvConfig`'s whitelist so it can't be set via `.env` | `config/SecurityConfig.java:32-41,73-81` |
| BE-4 | Medium | `permitAll("/auth/**")` is broader than the two endpoints that need it — any future `/auth/*` endpoint is public by default; `/auth/me` then re-implements its own 401 logic | `config/SecurityConfig.java:64` |
| BE-5 | Medium | No `AuthenticationEntryPoint`/`AccessDeniedHandler`: unauthenticated requests get a bodyless 403 instead of a JSON 401 matching the `GlobalExceptionHandler` contract | `config/SecurityConfig.java:56-70` |
| BE-6 | Medium | `JwtTokenProvider.isValid` is a tautology (compares the token's email to the email extracted from the same token) and its expiry check is unreachable (parsing throws first); tokens live 25 h with no refresh story; jjwt 0.11.5 is outdated | `security/jwt/JwtTokenProvider.java:37-43` |
| BE-7 | Low | No login rate limiting / account lockout — unlimited BCrypt attempts | `AuthController.java:52-66` |
| BE-8 | Low | `User.getAuthorities()` produces `ROLE_null` for legacy documents without a role; `dob`/`age` stored as `String` with parse exceptions swallowed | `modules/auth/entity/User.java:36-41,78` |

**Recommended pattern:** replace the filter's `System.out` with SLF4J at `debug`, catch only `JwtException | UsernameNotFoundException`; add `@Valid` + constraint annotations to every request DTO; narrow `permitAll` to `/auth/login`, `/auth/register`, `/food/voice-log`, `/error`.

### 4.2 Error handling consistency

Three dialects coexist:

1. **The documented convention** — services throw `ResponseStatusException`, `GlobalExceptionHandler` renders JSON (food, mealschedule). ✅
2. **Habit module** — throws `IllegalArgumentException` for "Habit not found" / "not yours", which the catch-all maps to **500 "An unexpected error occurred"** with a full stack trace logged (`HabitService.java:252-262,295-300,313-322`). **High.**
3. **Auth controllers** — catch `RuntimeException` broadly and hand-map statuses, so *any* failure during register (Mongo down, encoder NPE) returns **409 CONFLICT** with the raw exception message; `ProfileController` returns raw `e.getMessage()` in 500 bodies (`AuthController.java:46-49,62-65`). **High.**

Additional gaps:

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| BE-9 | Medium | `GlobalExceptionHandler` turns routine client errors (malformed JSON, 405, missing params, unknown paths, type mismatches) into 500s — only two exception types are explicitly handled | `common/GlobalExceptionHandler.java:41-45` |
| BE-10 | Medium | Ownership failures answer inconsistently: `updateEntry`/`deleteEntry` → 400, `deleteEntryById` → 403 for the same condition; both leak the existence of other users' entry IDs | `FoodLogService.java:185-187,221-223,242-243` |
| BE-11 | Medium | `List<@Valid …>` bodies produce a message-less `400 "400 BAD_REQUEST"` (Spring 6.1 `HandlerMethodValidationException` has `reason == null`), while single-object bodies get proper field messages | `FoodController.java:53-57` + handler |
| BE-12 | Medium | Webhook failure semantics self-contradict: the comment says "Vapi will retry on non-2xx" but the failure path returns `202 ACCEPTED` with a meaningless `"recoverable": true` — failed meal logs are acknowledged and never retried | `VoiceLogController.java:73-80` |

**Actions:** convert the habit module to `ResponseStatusException` (use 404 for both not-found and not-yours to avoid existence leaks); delete all try/catch from auth controllers and let the advice render; extend `GlobalExceptionHandler` with handlers for `HttpMessageNotReadableException`, `MethodArgumentTypeMismatchException`, `HttpRequestMethodNotSupportedException`, `NoResourceFoundException`, `HandlerMethodValidationException`; introduce a single "load-owned-entity-or-404" helper.

### 4.3 Data consistency & persistence

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| BE-13 | High | Batch add is not atomic: entries validate-and-save one at a time, so an invalid entry N leaves entries 1..N-1 persisted while the client gets a 400 | `FoodLogService.java:69-77` |
| BE-14 | High | Get-or-create race on the day's `FoodLog`: two concurrent adds both insert; without the unique index (CR-4) the user's day silently splits across two documents | `FoodLogService.java:251-259` |
| BE-15 | High | JVM-lifetime RDI cache: unbounded `ConcurrentHashMap` keyed by userId, stale on DOB/gender change, wrong under multi-instance, and `computeIfAbsent` **permanently caches the empty map returned when the AI call fails** | `NutritionReportService.java:46,145,279-282` |
| BE-16 | Medium | Second hand-rolled cache (`insightsCache`) checks expiry but never evicts — unbounded growth | `NutritionInsightsService.java:39,70-76` |
| BE-17 | Medium | Enrichment records crash-stranded: `in_progress` is persisted before work, but the scheduled retry only queries `"pending"`; also `retryPendingEnrichments()` self-invokes `enrichFoodEntry`, bypassing the `@Async` proxy (retries run synchronously) | `NutritionEnrichmentService.java:61-80` |
| BE-18 | Medium | Voice transcript idempotency lives in a process-local `ConcurrentHashMap` — restarts or a second instance re-log duplicate meals | `VoiceLogService.java:47,292-303` |
| BE-19 | Medium | Avoided foods stored as a CSV string in a document DB — corrupts names containing commas; the same concept is a `String` in one DTO and `List<String>` in another | `UserNutrientPreference.java:30`, `NutrientPreferenceService.java:41,63-66` |
| BE-20 | Medium | Timezone handling half-migrated: user-zone-aware `today` exists, but completion time is a server-zone `LocalTime` string, reschedule time is server-zone `LocalDateTime`, and the reminder scheduler compares in server zone | `HabitService.java:285,340-342,354`, `HabitReminderScheduler.java` |
| BE-21 | Medium | Two modules (`habit`, `mealschedule`) write `User.timezone` through `UserRepository` with divergent validation — mealschedule saves it **unvalidated**, poisoning later `zoneFor()` parsing | `MealScheduleService.java:53-56` vs `HabitService.java:131-145` |
| BE-22 | Low | `MealSchedule` sets `updatedAt` manually while sibling entities use `@LastModifiedDate` (auditing is enabled) | `MealSchedule.java:37` |
| BE-23 | Low | Out-of-range schedule input silently clamped (`hour=25` → `23`) instead of rejected with 400 | `MealScheduleService.java:45-46,61-67` |

**Actions:** two-phase validate-then-`saveAll` for batch adds; atomic `findAndModify(..., upsert(true))` for get-or-create; replace both hand-rolled caches with Spring Cache + Caffeine (`expireAfterWrite`, `maximumSize`, and **never cache failures**); persist voice idempotency keys with a unique Mongo index; store `Instant`s for completion/reschedule moments; extract a shared `UserTimezoneService.persistIfValid(...)`.

### 4.4 Performance

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| BE-24 | High | Habit N+1 on the hot path (today view + dashboard): one `findFirstByHabitIdAndUserIdAndEntryDate…` query per habit inside a stream | `HabitService.java:226-231` |
| BE-25 | High | Unbounded date-range on the three report endpoints: `endDate=9999-12-31` yields ~2.9M loop iterations and 17 trend lists of that length — a DoS vector. (`getDayLogs` validates; the reports don't) | `NutritionReportService.java:106-121` |
| BE-26 | Medium | Food day-range N+1 despite an existing batch helper: `findByFoodLogId` per day while `FoodLogQueries.entriesByLogId` batch-loads | `FoodLogService.java:156-163` |
| BE-27 | Low | Redundant second un-indexed cache-lookup query per miss (exact-name fallback can only match when the normalized lookup already would have) | `NutritionCacheService.java:37-43` |

**Actions:** batch habit-entry lookup with `findByUserIdAndEntryDateAndHabitIdIn` + group-by; add a shared `DateRanges.validate(start, end, MAX_DAYS=366)` guard used by all three report endpoints; use `entriesByLogId` in `getDayLogs`.

### 4.5 External-API integration (AI providers)

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| BE-28 | High | ~200 lines duplicated between `GeminiService` and `GroqService`: retry loop, backoff computation, retryable-classification, key sanitization, Netty timeout wiring — near byte-for-byte | `GeminiService.java:122-255,417-439` vs `GroqService.java:99-139,217-314` |
| BE-29 | High | ~150 lines of **dead** nutrition-parsing code in `GeminiService` (`getNutritionInfo`, `parseNutritionResponse`, `buildPrompt`, `extractJson`, `getBigDecimal` — zero callers; two of them duplicate `AiJsonSupport`/`JsonNumbers`) | `GeminiService.java:257-415` |
| BE-30 | High | Blocking `.block()` + `Thread.sleep` retries on a reactive WebClient inside a servlet app: up to 3 attempts × 55 s timeout + backoff ≈ 3 minutes of a blocked thread per LLM call, on user-facing requests | `GeminiService.java:184,248-255`, `GroqService.java:173,280-287`, both providers |
| BE-31 | Medium | Provider priority defined twice and can contradict: configurable chain order vs a hardcoded `SOURCE_PRIORITY` map governing cache upgrades | `NutritionCacheService.java:24-27` vs `NutritionEnrichmentService.java:50` |
| BE-32 | Medium | Provider API keys leak into logs: keys ride as query params and `e.getMessage()` (which includes the full request URI) is logged on every 4xx/5xx | `UsdaNutritionProvider.java:83,104`, `SpoonacularNutritionProvider.java:73,93` |
| BE-33 | Medium | Spoonacular per-*serving* data stored as if per-100g — every downstream scaling computation is built on a false premise | `SpoonacularNutritionProvider.java:30-31,104-105` |
| BE-34 | Medium | Retryability inferred by substring-matching lowercase response bodies (`"high demand"`, `"unavailable"`) — brittle and can misclassify 400s as retryable | `GeminiService.java:195-208`, `GroqService.java:225-239` |
| BE-35 | Medium | Raw LLM responses logged at INFO on every call; complete webhook payloads and voice transcripts (user PII) persisted unbounded with no retention policy | `GeminiService.java:266-351`, `VoiceLogService.java:109-110` |
| BE-36 | Low | Asymmetric exception hierarchy: Gemini has a bespoke `GeminiApiException`, Groq throws `AiProviderException` directly | `modules/nutrition/GeminiApiException.java` |
| BE-37 | Low | Per-service Netty `HttpClient` construction in constructors; USDA/Spoonacular have **no connect timeout** at all | `GeminiService.java:60-70`, `GroqService.java:63-73` |

**Actions:** extract a shared `RetryingAiHttpClient` (or `AiRetryPolicy` + `WebClient` factory bean) — both AI services shrink to ~60 lines; delete the dead Gemini parsing block; either move to synchronous `RestClient` + Spring Retry (and drop the WebFlux starter) or go reactive end-to-end with `retryWhen(Retry.backoff(...))`; derive cache priority from chain position; send Spoonacular's key via the `x-api-key` header and sanitize logged errors; store Spoonacular results as `1 serving`.

### 4.6 SRP / module structure

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| BE-38 | Medium | `VoiceLogService` (482 lines) owns five responsibilities: webhook ingestion + session audit, Vapi session/token config, LLM transcript→meals parsing (embedded 30-line prompt), LLM transcript classification (second prompt), and an idempotency cache — plus the **third** copy of `sanitizeApiKey` | `modules/voice/VoiceLogService.java` |
| BE-39 | Medium | `HabitService` (470 lines) mixes CRUD, occurrence status, timezone persistence, voice-result processing, and AI transcript interpretation with its own embedded prompt — while the food module demonstrates the four-way split | `modules/habit/HabitService.java:305-454` |
| BE-40 | Medium | `food ↔ nutrition` package cycle: nutrition imports food's entity and repository | `NutritionEnrichmentService.java` imports |
| BE-41 | Medium | Duplicate endpoints: `/auth/me` vs `GET /profile` return the same data with different shapes (one from the possibly-stale principal, one re-fetched); two delete-entry routes do the same job | `AuthController.java:68-90` vs `ProfileController.java:32-57`; `FoodController.java:82-92` |
| BE-42 | Medium | Six endpoints hand-roll `SecurityContextHolder → instanceof User` while the purpose-built `CurrentUserProvider` (whose Javadoc mandates its use) sits unused by auth/voice controllers; `ageString` copy-pasted between two controllers | `AuthController.java:71-83`, `ProfileController.java`, `VoiceLogController.java` |
| BE-43 | Medium | Misleading names: `HabitEntity` is actually a per-day occurrence (collection `habit_entries`); `HabitEntityRepository` next to `HabitRepository` invites wrong-repo bugs | `modules/habit/HabitEntity.java` |
| BE-44 | Medium | Nutrient key list duplicated between `NutrientCatalog` and the hand-written RDI prompt — adding a nutrient silently desynchronizes AI goals | `NutritionReportService.java:240-265` vs `NutrientCatalog.java:11-28` |
| BE-45 | Medium | Weekday short-name formatting copy-pasted between `HabitService` and `HabitReminderScheduler`; matching depends on exact `"Mon"` casing from the client | `HabitService.java:209-210`, `HabitReminderScheduler.java:31-32` |
| BE-46 | Medium | `HabitReminderScheduler` runs every minute in server timezone for all users and **only logs** — no notification is ever sent (dead behavior) | `HabitReminderScheduler.java:27-58` |
| BE-47 | Low | `GET /habit?tz=...` persists the timezone — a write side effect on a safe method | `HabitController.java:35-38` |
| BE-48 | Low | Habit endpoints serialize the Mongo entity directly (leaks `userId`; presentation `@JsonFormat` forced onto the entity) | `HabitController.java:25-27,36-38` |
| BE-49 | Low | Pure-domain `MealTypes` static utility throws web-layer `ResponseStatusException` | `MealTypes.java:77-78` |
| BE-50 | Low | `VoiceInterpretResult` (a voice contract) lives in the `nutrition` package | `modules/nutrition/VoiceInterpretResult.java` |

**Actions:** split `VoiceLogService` into `VapiSessionConfigService` / `VoiceMealIngestionService` / `TranscriptInterpreter`; extract `HabitVoiceService`; break the food↔nutrition cycle by having enrichment consume an `(entryId, name, quantity, unit)` value object; move `AiTextService`/`AiJsonSupport`/`VoiceInterpretResult` to a `common/ai` package; rename `HabitEntity → HabitEntry`; build the RDI prompt from `NutrientCatalog.all()`; delete or implement the reminder scheduler behind a `ReminderNotifier` port.

### 4.7 Configuration management

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| BE-51 | Medium | `EnvConfig` requires editing a hand-rolled 28-key whitelist plus a parallel alias map for every new setting (OCP violation) — and has already drifted (`cors.allowed-origins`, `nutrition.provider-chain` can't be set via `.env`); it searches `../.env` and `../../.env` (a stray file two directories up silently configures the app); `addFirst` makes `.env` override real OS env vars; contains dead aliases (`vapi.private-key`, `security.log.level` read by nothing) | `config/EnvConfig.java:90-164` |
| BE-52 | Medium | `EnvConfig` prints working directory, every loaded key, and which secrets are present via `System.out`/`printStackTrace` on startup | `config/EnvConfig.java:26-86` |
| BE-53 | Low | Stale/contradictory docs: `ENTRY_HASH_NUTRITION_FLOW.md` describes a cache→USDA→AI chain; the code default is `spoonacular,ai`; properties comments reference a `copilot.bridge` integration that doesn't exist | `backend/ENTRY_HASH_NUTRITION_FLOW.md:24-66` |

**Actions:** load *all* `.env` keys (dotenv already parses the file) and rely on Spring's relaxed binding via `@ConfigurationProperties` instead of the whitelist+alias maps; restrict the search to the working directory; use `addAfter(SYSTEM_ENVIRONMENT…)`; replace the prints with `DeferredLog`; update the docs.

### 4.8 API contract quality (food module)

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| BE-54 | Medium | Update flow returns stale nutrition with no pending indicator (enrichment is async but the response re-reads immediately), unlike the add flow | `FoodLogService.java:199-203` |
| BE-55 | Medium | Preference endpoints accept unknown nutrient ids (`POST /food/nutrient/banana/pin` creates a document) and unvalidated payloads (null/negative targets) | `NutrientPreferenceService.java:25-44`, `FoodController.java:118-130` |
| BE-56 | Low | Human-readable status sentence stuffed into a field named `nutritionResponse`; `createdAt`/`updatedAt` exist on the response DTO but are never populated (always null) | `FoodLogService.java:287`, `FoodEntryResponse.java:21-23` |
| BE-57 | Low | Sibling DTOs disagree: `FoodItemResponse.quantity` is a `String` + `servingSize`, `FoodEntryResponse` uses `double quantity` + `unit` | `FoodItemResponse.java:19-20` |
| BE-58 | Low | `avgDailyCalories` duplicates `weeklyAverage.calories`; two different denominators for "daily average" (days-with-logs vs days-with-value>0) | `NutritionReportService.java:89-99,160-161` |
| BE-59 | Low | Hardcoded coaching thresholds disagree with the catalog defaults (fiber < 25 vs catalog goal 28) and ignore personalization | `NutritionInsightsService.java:131-147` |
| BE-60 | Low | Null-unsafe personalization prompt: missing age/gender produces "The user is null years old and null" sent to the LLM | `NutritionReportService.java:240-266` |
| BE-61 | Low | Unrecognized occurrence status silently coerced to `MISSED` (typos, even "COMPLETED") | `HabitService.java:158-163` |
| BE-62 | Low | Controller manufactures a one-field DTO to satisfy `toggleHabit`; non-final injected field; `getpresentDayHabits` casing | `HabitController.java:18,30,46-51` |

---

## 5. Frontend Findings

### 5.1 Foundations

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| FE-1 | High | TypeScript `strict: false` — the entire codebase compiles without null checks or implicit-any errors, which is why the `any` patterns below accumulated silently | `frontend/tsconfig.json:11` |
| FE-2 | Medium | The auth-critical HTTP client (axios instance, token interceptor, 401 handler) is untyped JavaScript in a TS codebase | `src/api/client.js` |
| FE-3 | Medium | AsyncStorage token key `'token'` is a magic string across six call sites in two layers; no single token-storage module; auth token in plain AsyncStorage rather than Keychain/EncryptedSharedPreferences — every other store in the app uses centralized, versioned keys | `api/client.js:20,32`, `AuthContext.tsx:66-110` |

**Actions:** enable `strict` (or minimally `noImplicitAny` + `strictNullChecks`) and burn down incrementally; convert `client.js → client.ts`; extract `services/tokenStorage.ts` and consider `react-native-keychain`.

### 5.2 State management & error handling

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| FE-4 | **High** | Cold-start auth treats **any** `/auth/me` failure as an invalid token: the catch unconditionally removes the stored token — a transient network failure logs the user out. The codebase's own `mealScheduleStore` three-state fetch exists precisely to distinguish "unreachable" from "absent" | `context/AuthContext.tsx:91-94` |
| FE-5 | Medium | `AuthContext` provider value is a fresh object literal (plus fresh closures) every render — all consumers re-render whenever the provider does | `AuthContext.tsx:166-184` |
| FE-6 | Medium | Five hooks swallow fetch errors with `console.error` and expose no error state — screens render empty dashboards/logs/reports with no retry affordance | `useDashboard.ts:38-41`, `useFoodLog.ts:43-45`, `useWeeklyNutrientSummary.ts:64-66`, `useWeeklyNutritionReport.ts:64-80`, `useProfileForm.ts:57-60` |
| FE-7 | Medium | Optimistic goal update never rolled back: override applied + success toast shown *before* the API call; on failure only `console.error` (contrast `useHabitList.toggleHabit`, which rolls back correctly) | `useWeeklyNutrientSummary.ts:130-146` |
| FE-8 | Medium | `try/finally` without `catch` in onboarding save — rejections escape as unhandled and the user stays stranded with no feedback | `OnboardingMealScheduleScreen.tsx:61-83` |
| FE-9 | Medium | No shared "axios error → user message" helper: a failed login shows raw `"Request failed with status code 401"`; the correct extraction logic exists twice (once in a private hook helper, once in dead code) | `LoginScreen.tsx:70-76`, `RegisterScreen.tsx:115-121`, `useHabitCreationForm.ts:21-24` |
| FE-10 | Medium | Server state lives in per-hook `useState` with refetch-on-focus everywhere — no caching/dedup layer (acceptable at this size, but the cause of the polling/snapshot machinery in the voice screens) | all controller hooks |

**Actions:** only clear the token on 401/403; memoize the context value (`useMemo`/`useCallback`, or split state/actions contexts); add `error` state + retry banners to the five hooks (the `submitError` pattern already exists); export one `getApiErrorMessage(err)` from `services/api`; consider TanStack Query when the screens count grows.

### 5.3 Screens: separation of concerns

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| FE-11 | **High** | `VoiceMealLogScreen` embeds a ~125-line business pipeline in the component: transcript dedup refs, a food-log snapshot differ, a 12×1.5 s enrichment polling loop, interpretation/parse API calls, reschedule arming — none presentational, none unit-testable | `screens/main/VoiceMealLogScreen.tsx:81-274` |
| FE-12 | **High** | `VoiceHabitScreen`: same violation, plus `parseTimeToMinutes`/`timesMatch` reimplement `services/notifications/clockTime` utilities, and hand-built fallback `Habit` objects are duplicated twice within the file | `screens/main/VoiceHabitScreen.tsx:15-71,127-180,208-309` |
| FE-13 | Medium | Date-sanitization block copy-pasted verbatim into three screens (validate `route.params.selectedDate` against a regex and clamp to today) | `FoodLogScreen.tsx:51-61`, `ManualFoodLogScreen.tsx:60-72`, `VoiceMealLogScreen.tsx:23-35` |
| FE-14 | Medium | Nutrition goals hardcoded and duplicated: `{protein:180, carbs:250, fat:70, sugar:40}` + 2500 kcal declared independently in a screen and a hook — and every user gets the same goals while the backend serves per-user targets | `FoodLogScreen.tsx:34-35`, `useWeeklyNutritionReport.ts:12-20` |
| FE-15 | Medium | Two conflicting week conventions in one utils file: Sunday-start used by the report screen, Monday-start by the weekly-summary screen it links to — totals for "this week" can silently disagree | `utils/weekRange.ts:16-29` vs `:35-49` |
| FE-16 | Low | Meals header always reads "Today's meals" even for past dates; local date formatter duplicates `utils/date.parseLocalDateString` | `FoodLogScreen.tsx:37-45,144` |
| FE-17 | Low | `HabitCreationScreen` (451 lines) repeats three near-identical selectable-card JSX blocks that a config-driven `OptionCard` would collapse by ~150 lines | `HabitCreationScreen.tsx:157-215,270-382` |
| FE-18 | Low | Insights fallback thresholds (`fiber<25`, `sugar>50`) hardcoded in a hook, drifting from both the backend catalog and the goals constant above them in the same file | `useWeeklyNutritionReport.ts:100-120` |

**Actions:** extract `useVoiceMealParsing(...)` and `useVoiceHabitCheckin(...)` hooks (the codebase's own controller-hook pattern); replace `timesMatch` with `canonicalSlotKey(a) === canonicalSlotKey(b)`; add `clampToToday()` to `utils/date.ts`; create one `config/nutritionGoals.ts` — or better, fetch the user's goals from the API the report screens already use; unify the week convention.

### 5.4 Navigation

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| FE-19 | **High** | Ten call sites cast navigation to `any`/`as never`. Root cause: `MainTabParamList` declares `Food: undefined` instead of `NavigatorScreenParams<FoodStackParamList>`, so nested navigation can't type-check — the typed infra (`paramTypes.ts`, `navigationUtils.ts`, whose docstring forbids these casts) already exists | `DashBoardScreen.tsx:76,213-216,303`, `ProfileScreen.tsx:35`, `VoiceMealLogScreen.tsx:313`, `VoiceHabitScreen.tsx:205`, `NutritionReportScreen.tsx:56`, `AppBar.tsx:66`, onboarding screens |
| FE-20 | Medium | `CustomTabBar(props: any)` and `getDeepestRouteName(route: any)` discard `BottomTabBarProps`; `TAB_BAR_HIDDEN_ROUTES` repeats route-name strings that `routeNames.ts` centralizes, including two entries that can never appear in tab state | `MainTabNavigator.tsx:20-47` |
| FE-21 | Low | A full-screen form (`HabitCreation`) is registered as a bottom **tab**, then hidden via the tab-bar hack — move it to the root stack and the machinery disappears | `MainTabNavigator.tsx:73-77` |
| FE-22 | Low | Login/Register screens type their nav prop as `NativeStackNavigationProp` while registered in a `createStackNavigator`; the app depends on both stack packages but uses one | `LoginScreen.tsx:14`, `RegisterScreen.tsx:16` vs `AuthNavigator.tsx:2` |
| FE-23 | Low | `if (isInitializing) return null;` — blank white screen for the duration of AsyncStorage read + `/auth/me` on every cold start | `AppNavigator.tsx:103-105` |
| FE-24 | Medium | Dead context API: `onboardingCallTime` is only ever set to `null`, making a navigator initial-route branch unreachable — the real value flows via route params, a second parallel mechanism | `AuthContext.tsx:32-58`, `AppNavigator.tsx:41-45` |

### 5.5 Layering & API discipline

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| FE-25 | Medium | Five modules bypass the typed `services/api` layer with raw endpoint strings (`'/habit'`, `'/meal-schedule'`, …), so the same backend endpoints are addressed from two layers with different validation styles | `notifications/habitStore.ts:117`, `mealScheduleStore.ts:75,94`, `habitOccurrenceApi.ts:22`, `vapiSessionService.ts:38` |
| FE-26 | Medium | `any[]` at the nutrition API boundary (`getAllNutrients`, `getInsights`) even though the response types already exist in `types/nutrition.ts`; a hook re-declares one locally | `services/api/nutritionApi.ts:27,33` |
| FE-27 | Medium | `hooks/useIncomingCall.ts` is not a hook (plain functions, zero React imports) and is imported **by the services layer** — inverting the screen→hook→service direction the codebase elsewhere explicitly fixed | `hooks/useIncomingCall.ts`, imported by `notifications/nativeIncomingCall.ts:19`, `callMarkers.ts:21` |
| FE-28 | Low | Stringly-typed `Habit.status` (union lives in a comment); dual food-item models (`FoodItem.quantity: string` vs `FoodEntry.quantity: number`) force conversions at the UI boundary — mirrors backend BE-57 | `types/types.ts:28,90-102` |
| FE-29 | Low | 31 raw `console.log` calls in the voice path, including per-event volume logging during active calls, while `services/notifications/logger.ts` demonstrates the correct structured pattern | `useVapiSession.ts:174-180` and the two voice screens |

### 5.6 Components: decomposition & duplication

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| FE-30 | **High** | Two complete meal-reminder features rendered back-to-back on one screen: `CheckinCard` and `MealReminderSettings` both load/save the **same** `mealScheduler` schedule with independent local state — change the time in one and the other shows stale data; they use different pickers and different greens | `FoodLogScreen.tsx:126-129`, `CheckinCard.tsx`, `MealReminderSettings.tsx` |
| FE-31 | High | `AllNutritionsCard` (621 lines) is a screen-sized god component named "Card": API fetching, error mapping, date-range math, filtering, three mutation flows, DTO mapping, and layout in one file — currently dead (see FE-38) but the pattern matters if revived | `AllNutritionsCard.tsx` |
| FE-32 | Medium | Nutrient-status math implemented **seven times** with disagreeing thresholds (90/60 vs 80/40 vs 100/80) — the same intake can read "GOOD" on one card and "Moderate" on another; this is also the root cause of CR-5 | `MacrosCard.tsx:21-35`, `NutritionCard.tsx`, `NutritionDetailDrawer.tsx:346`, `weekly-summary/tokens.ts:50-115`, `MacroProgressBar.tsx`, `CircularProgress.tsx`, `constants.tsx` |
| FE-33 | Medium | Bottom-sheet/modal shells implemented six ways (hand-rolled Modal+Animated ×3, gluestack Drawer/Actionsheet/Modal) — same grabber/title/close anatomy, three themes | `WheelPickers.tsx:29-110`, `CheckinCard.tsx:159-229`, `GoalSheet.tsx:150-263`, + gluestack variants |
| FE-34 | Medium | The "calories + protein/carbs/fat" macro summary row re-implemented five times with different rounding, casing, and styling; plus four hand-rolled thin progress bars and three SVG progress rings | `DayDetailDrawer.tsx:95-125`, `MealSlotSection.tsx:58-74,108-129`, `MealBreakdown.tsx:27-37`, `MacrosCard.tsx`, et al. |
| FE-35 | Medium | `CheckinCard` mixes ETA date-math, schedule persistence, and an inline bottom sheet; its `toggleEnabled` keeps optimistic state when the save throws (silent divergence) | `CheckinCard.tsx:41-101,159-229` |
| FE-36 | Medium | Meal metadata forked: `MEAL_TINTS`/`MEAL_ICONS` with duplicate `snacks`/`snack` keys in `MealGroup` while tested `utils/mealSlots.ts` owns the canonical slot list; `fmtG` duplicated verbatim in two files while `utils/numberFormatter.ts` exists | `MealGroup.tsx:7-36,187-191`, `MacrosCard.tsx:37-41` |
| FE-37 | Medium | 15-prop pre-chewed prop bags: the dashboard screen must pre-compute label strings and booleans for `MealSlotSection` (15 props) — which *still* computes macros internally, splitting the derivation across both sides | `MealSlotSection.tsx:14-29`, `HabitList.tsx:10-21` |
| FE-38 | Medium | Transcript "You:"/"Assistant:" protocol parsed in the presentation layer with regexes; `callSeconds` never resets on a new call within the same mount | `components/voice/VoiceSessionScreen.tsx:46-70` |
| FE-39 | Low | Food-entry validation inline in `EditFoodDrawer` while the tested `utils/authValidation.ts` demonstrates the extraction pattern; `Alert.prompt` (iOS-only) used for the avoid-foods flow — silently does nothing on Android | `EditFoodDrawer.tsx:63-101`, `AllNutritionsCard.tsx:352` |
| FE-40 | Low | Misplaced files: `VoiceSessionScreen` (576 lines, named *Screen*) lives under `components/`; `NutrientDetail.tsx` is a full-screen layout in a components folder; mixed default/named exports and stale barrels across sibling folders | `components/voice/`, `weekly-summary/` |

### 5.7 Dead code (frontend)

All verified by import-graph greps — zero importers outside their own cluster:

| ID | Severity | What | Lines |
|----|----------|------|-------|
| FE-41 | **High** | The entire "All Nutrients" feature cluster: `AllNutritionsCard.tsx` (621) + `NutritionCard.tsx` (141) + `NutritionDetailDrawer.tsx` (513) + `SetDailyTarget.tsx` (146) — no screen or navigator imports the root | ~1,420 |
| FE-42 | High | Dead macro-display chain: `NutritionDisplay.tsx`, `ui/MacroProgressBar.tsx`, `ui/CircularProgress.tsx`, `components/FoodItem.tsx` — duplicate the live `MacrosCard`/`MealGroup` UIs | ~620 |
| FE-43 | Medium | Four zero-byte stubs committed under `ui/`: `CalorieRing.tsx`, `MacroRings.tsx`, `QuickAddFAB.tsx`, `StreakCounter.tsx` (crash at import time if ever imported) | 0 |
| FE-44 | Medium | Dead hook `useApi.tsx` (106 lines, uses axios `CancelToken` deprecated since 0.22); dead `useFoodForm.ts` (100 lines); dead shim `services/authService.js` | ~250 |
| FE-45 | Low | ~15 unused public exports across the notifications/services layer; inert no-op `PanResponder` attached in `GoalSheet`; three `Pressable`s with no `onPress` in the (dead) drawer; `test.skip`'d root App test | — |

**Action:** delete all of the above (~2,400 lines total) and add `knip` or `eslint-plugin-import/no-unused-modules` to CI to prevent recurrence.

### 5.8 Styling & theming

Six distinct styling approaches coexist (census excludes generated `ui/`):

1. `StyleSheet` + theme module mapped from `theme/tokens.ts` (auth/, weekly-summary/, voice/) — **the best-behaved dialect**
2. `StyleSheet` + file-local hardcoded palette (food-log/, AppBar, BottomNavigation)
3. NativeWind `className` + gluestack primitives (dashboard/, most of nutrition-report/)
4. **Interpolated** className from data (`bg-${badge.bg}`) — extractor-unsafe
5. Raw inline `style={{…}}` objects as primary styling
6. gluestack variant props (generated code, unmodified)

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| FE-46 | High | Runtime-interpolated Tailwind classes (`` className={`bg-${COLORS.bg.primary}`} ``) are invisible to NativeWind's static extractor — these styles resolve only if the same literal happens to exist elsewhere and are one refactor away from silently disappearing | `NutritionDetailDrawer.tsx:105,113,123,141+`, `constants.tsx:28-60` |
| FE-47 | High | Three food-log files declare module-level palettes that **drift from** the canonical tokens: `GREEN_DEEP='#0a5226'` vs token `#0a4d27`, `ink:'#16241c'` vs `#0d1f16`, `line:'#e7ede9'` vs `#e3eae5` — "the same" colors render differently across cards on one screen. `tokens.ts`'s own header declares it the single source of truth | `CheckinCard.tsx:21-30`, `MealGroup.tsx:7-20`, `MacrosCard.tsx:7-17` |
| FE-48 | High | `MealReminderSettings` uses an unrelated Material-green palette (`#2e7d32`, `#81C784`) rendered directly next to the brand green on the same screen | `MealReminderSettings.tsx:144-235` |
| FE-49 | Medium | Fourth variant of the brand gradient hardcoded in the food-log header; six local palettes for one brand overall; four different modal-scrim colors; Tailwind-palette hexes copy-pasted with name comments in three files | `FoodLogHeader.tsx:33`, `AppBar.tsx:134-210`, `BottomNavigation.tsx`, etc. |
| FE-50 | Low | `TouchableOpacity` vs `Pressable` interchangeably; `space-y-2` (web-only utility, no-op on native); `width: '…%' as any` casts where `DimensionValue` suffices | various |

**Actions:** declare the target dialect (StyleSheet + tokens is the most consistent and theme-compliant) in a CONTRIBUTING/UI doc; route the food-log palettes through `theme/tokens.ts` (the pipeline already exists — food-log simply never adopted it); export a `brandGradient` and an `overlay` token; replace every interpolated class with complete literals selected from a map; add an ESLint `no-color-literals` rule for `components/`.

### 5.9 Content, i18n, accessibility

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| FE-51 | Medium | No i18n layer; user-facing copy scattered as literals with inconsistent voice/casing; only the voice lane got a copy module (`voiceSessionCopy.ts` — the right pattern, used nowhere else) | app-wide |
| FE-52 | Medium | Accessibility is systematically absent outside `auth/`: icon-only edit/delete buttons without roles/labels (and below the 44 pt target), a hand-rolled slider without `accessibilityRole="adjustable"`, unlabeled switches and back buttons — while `auth/` consistently does this right | `CheckinCard.tsx:124-134`, `MealGroup.tsx:68,148-161`, `GoalSheet.tsx:193-218`, `FoodLogHeader.tsx:43` |
| FE-53 | Low | Locale pinned to `en-US` in three places; time-slot labels pre-rendered as English strings; `formatLocaleTimeFromParts` exists but is unused for them | `CheckinCard.tsx:32-39`, `FoodLogScreen.tsx:41`, `weekly-summary/tokens.ts:161` |

---

## 6. Repository Hygiene

| ID | Severity | Finding |
|----|----------|---------|
| RH-1 | High | `frontend/app.json:3` — the shipping app display name is misspelled: **"Nutritoin Tracker"** |
| RH-2 | Medium | `frontend/rnconfig.json` (39 KB) — committed machine-generated CLI output containing absolute **Windows** paths (`C:\Nutrition Tracker\…`); useless on any other machine. Delete + gitignore |
| RH-3 | Medium | `frontend/patch.js` — the entire file is a quoted string literal (not executable JS) containing a one-off hack referencing `C:/…`; not referenced by `package.json`. Delete |
| RH-4 | Medium | `Photos/` (7 JPEGs, ~404 KB) committed at repo root, referenced by nothing |
| RH-5 | Medium | `.gitignore` inconsistencies: root ignores `.vscode/` yet `frontend/.vscode/settings.json` is tracked; `application.properties` ignored *by bare name* at the bottom (secrets once lived in git — see CR-1); frontend gitignore doesn't cover `rnconfig.json` |
| RH-6 | Low | Orphan root `package-lock.json` (empty lockfile, no root `package.json`) from an accidental `npm install`. Delete |
| RH-7 | Low | Doc sprawl: LLM prompt artifacts (`NOTIFICATION_RELIABILITY_PROMPT.md` — literally a 20 KB task prompt) and design notes at repo root; five more loose docs in `frontend/`. Move to `docs/`; prompts arguably don't belong in the repo |
| RH-8 | Low | `frontend/tailwind.config.js`: content globs point at directories that don't exist (`./app/**` etc. — code is under `src/`); web-only options (`important: 'html'`, env-based `darkMode`) are starter leftovers; the broad safelist regex masks dead styles and enabled the FE-46 habit |
| RH-9 | Low | Zero-byte committed files: `backend/scripts/seed-fake-food-logs.{sh,cmd}`, `modules/food/seed/FakeFoodLogBackfillRunner.java` (plus the four frontend stubs in FE-43); stale `metro-react-native-babel-preset ^0.77` devDependency; app depends on both `@react-navigation/stack` and `native-stack` while using one |

---

## 7. Test Coverage

**Backend — 4 test classes total.** The food module — the largest and most algorithmic — has **zero** tests: nothing covers `FoodLogService` (validation, ownership, meal grouping), `NutritionReportService` (aggregation math, flag bands), `NutrientPreferenceService`, `NutritionInsightsService` (cache TTL, fallback), `DashboardService`, or the pure functions `MealTypes.normalize` and `NutritionTotals`. Nothing covers auth, the JWT filter/provider, security rules, `EnvConfig`, `GlobalExceptionHandler`, the retry logic, or the provider chain. `HabitServiceTest` constructs the service with `null` collaborators (`new HabitService(null, null, …)`), so only 3 of ~10 public methods are exercisable.

**Priority order:**
1. Pure units first — `MealTypes`, `NutritionTotals`, `computeFlag` boundary values (79/80/120/121).
2. `FoodLogService` with mocked repositories, following the existing `MealScheduleServiceTest` pattern (SecurityContext + Mockito are already set up).
3. `@WebMvcTest` security-rule tests + a `JwtTokenProvider` unit test.
4. Provider-chain tests with a mocked `NutritionProvider` list.

**Frontend — pure leaves are tested; orchestration cores are not.** `clockTime`, `scheduleIntent`, `reconcileDiff`, `scheduler`, `staleness`, `habitStore` and nine hooks have tests. But the flows this app's own design notes obsess over have **none**: `reconciliation.ts` (261 lines — the arm/prune/missed-sweep orchestrator, with an ordering constraint a comment calls double-count-critical), `callLifecycle.ts` (219 lines — the ringing→accepted/declined/missed state machine), `mealScheduleStore`'s three-state sync, `useVapiSession` (256 lines), and `useDashboard`. The jest setup already mocks notifee/AsyncStorage fully, so these are testable today. Component test coverage is zero (the only component test is `test.skip`'d) — logic trapped in components (FE-11/12/35) is exactly the logic that never got tested.

---

## 8. Prioritized Remediation Roadmap

### Phase 0 — Security triage (do immediately; ~1-2 days)
1. **Rotate every credential** (Mongo, Gemini, Groq, USDA, Spoonacular, Vapi, JWT secret, webhook secret) — CR-1, CR-2, CR-3.
2. Fix the property-key mismatch so config actually applies; verify the app connects to Atlas, not localhost — CR-3.
3. Make the Vapi webhook secret mandatory + constant-time compared — CR-2.
4. Put TLS in front of the API; move the frontend base URL out of source — CR-6.
5. Remove `System.out` JWT logging of PII — BE-1.

### Phase 1 — Correctness (~1 week)
6. Create the Mongo indexes (CR-4); then fix the get-or-create race and batch-add atomicity (BE-13/14).
7. Compute micronutrient statuses from real data (CR-5) via one shared `nutrientStatus` util (FE-32).
8. Stop logging users out on network failure at cold start (FE-4).
9. Habit module: `IllegalArgumentException` → `ResponseStatusException`; auth controllers: delete try/catch and use the advice (§4.2).
10. Bound report date ranges (BE-25); fix the habit N+1 (BE-24).
11. Replace both hand-rolled backend caches with Caffeine; never cache failures (BE-15/16).
12. Add `@Valid` + constraints to every request DTO (BE-2).
13. Merge `CheckinCard`/`MealReminderSettings` into one source of truth (FE-30).
14. Fix "Nutritoin Tracker" (RH-1).

### Phase 2 — Architecture (~2 weeks)
15. Extract the shared AI retry client; delete GeminiService's dead 150 lines; resolve the blocking-WebFlux mismatch (BE-28/29/30).
16. Split `VoiceLogService` and `HabitService`; break the food↔nutrition cycle; move AI infra to `common/ai` (BE-38/39/40).
17. Extract `useVoiceMealParsing`/`useVoiceHabitCheckin` hooks from the voice screens (FE-11/12).
18. Fix navigation typing at the root (`NavigatorScreenParams`) and delete all ten casts (FE-19).
19. Enable TypeScript `strict`; convert `client.js` to TS; centralize token storage (FE-1/2/3).
20. Replace the `EnvConfig` whitelist with `@ConfigurationProperties` relaxed binding (BE-51).
21. Route the five API-layer bypasses through `services/api` (FE-25); durable webhook idempotency (BE-18).

### Phase 3 — Consistency & quality (~2 weeks, parallelizable)
22. Delete ~2,400 lines of dead frontend code + dead backend config/files; add `knip` to CI (§5.7, RH-*).
23. Declare one styling dialect; route food-log palettes through tokens; eliminate interpolated Tailwind classes (FE-46/47/48).
24. Extract the shared primitives: `AppBottomSheet`, `MacroSummaryRow`, `nutrientStatus`, `fmtGrams`, `getApiErrorMessage`, `clampToToday` (FE-9/13/32/33/34/36).
25. Unify week conventions, goals config, error states in hooks (FE-6/14/15).
26. API contract cleanups: DTO field types/names, duplicate endpoints, enrichment status surfacing (BE-41/54/56/57).
27. Naming: `HabitEntity→HabitEntry`, `DashBoardScreen→DashboardScreen`, `getpresentDayHabits` (BE-43, FE-30).
28. Accessibility sweep of non-auth pressables; per-feature copy modules following `voiceSessionCopy.ts` (FE-51/52).

### Phase 4 — Testing & guardrails (ongoing)
29. Backend: food-module pure-unit + service tests; security-rule `@WebMvcTest`s; fix `HabitServiceTest`'s null collaborators.
30. Frontend: `runReconciliation` + `callLifecycle` tests (highest-risk untested logic); `useVapiSession`, `useDashboard`.
31. CI guards: ESLint rules (`no-color-literals` for components, `react-native-a11y`, import hygiene), `knip`, and a secret scanner (gitleaks) to prevent CR-1 recurring.

---

## 9. Principle-by-Principle Summary

| Principle | Grade | Dominant violations |
|---|---|---|
| **S**ingle Responsibility | C | `VoiceLogService` (5 jobs), `HabitService` (CRUD+voice+LLM), voice screens with embedded pipelines, `AllNutritionsCard`; the food module's service split shows the team knows the target |
| **O**pen/Closed | C | `EnvConfig` whitelist + alias map require edits for every key; hardcoded `SOURCE_PRIORITY` vs configurable chain; nutrient list duplicated into prompts |
| **L**iskov Substitution | B | Mostly fine; asymmetric provider exception types (`GeminiApiException` vs `AiProviderException`) is the only notable case |
| **I**nterface Segregation | B− | 15-prop component interfaces; ~15 unused public exports; one-field DTO manufactured to satisfy a signature |
| **D**ependency Inversion | B | Constructor injection throughout; `services/api` injectable HttpClient is exemplary — but services import a hook module (FE-27), nutrition imports food's repository (BE-40), and five modules bypass the API layer |
| **DRY** | D | The single weakest area: ~200 lines duplicated between AI clients, 3× `sanitizeApiKey`, 7× nutrient-status logic, 6× palettes, 6× bottom sheets, 5× macro rows, 2× reminder features, 2× week conventions, 3× date clamps |
| **KISS** | C+ | Hand-rolled caches/retries/idempotency where library or DB primitives exist; a tab-bar-hiding machine to compensate for a misregistered route; tautological JWT validation |
| **Separation of Concerns** | C+ | Layering is right on paper and mostly followed; violations concentrate in the voice screens, `CheckinCard`, transcript parsing in the presentation layer, and web exceptions in domain utilities |
| **Consistency** | C− | Three backend error dialects, six frontend styling dialects, two DTO shapes for the same concepts, drifting color values, mixed naming casing |

---

*Generated from a full-codebase review on 2026-07-13. Line numbers reference the working tree at commit `4829f31` (branch `mongo-deployment`) plus staged changes. Secrets in this document are intentionally not reproduced; see the cited files.*
