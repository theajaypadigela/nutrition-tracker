# Refactoring Plan — Nutrition Tracker

**Status:** Phases 1–5 executed (2026-08-23). Phase 0 skipped by decision. Two Phase 5 items
are deliberately not done — `import/order` (needs a new dependency, see C4) and
`noUncheckedIndexedAccess` (see the Phase 5 deviations).
**Prepared:** 2026-08-23 · branch `mongo-deployment`
**Scope:** `backend/` (Spring Boot 3.4 / Java 17 / MongoDB) and `frontend/` (React Native 0.83 / TypeScript).

---

## 1. Objective and Constraints

Improve the internal architecture, organisation, readability and reusability of the codebase
**without changing observable behaviour**.

Non-negotiables for every change in this plan:

| # | Rule |
|---|------|
| C1 | **Behaviour-preserving.** No endpoint contract, screen layout, rendered pixel, notification timing, or persisted document shape changes. Where a rename is unavoidable, it is a mechanical rename with no semantic change. |
| C2 | **Incremental.** Each numbered task is a self-contained, independently mergeable, independently revertable commit. No task depends on a later task to compile. |
| C3 | **Test-guarded.** A task that changes logic (not just location) gets a test *before* the change, asserting current behaviour. The existing 34 test files are the regression net; they must stay green at every commit. |
| C4 | **No new dependencies** unless explicitly called out and approved (only one is proposed: nothing on the backend, nothing on the frontend). |
| C5 | **Generated / vendored code is out of scope.** See §8. |

---

## 2. Baseline (measured, not estimated)

| Metric | Backend | Frontend |
|---|---|---|
| Source files | 108 `.java` (`src/main`) | 189 `.ts`/`.tsx` (excl. tests) |
| Source LOC | 7,568 | 29,365 |
| — of which generated/vendored | 0 | 8,748 (`src/components/ui/**`, Gluestack scaffold) |
| — of which hand-written app code | 7,568 | **~20,600** |
| Test files | 4 | 30 |
| Largest hand-written file | `VoiceLogService.java` (482) | `VoiceSessionScreen.tsx` (576) |

Other measured signals used throughout this plan:

- **328** hardcoded hex colour literals in `frontend/src`, of which **82** are in the token
  source `theme/tokens.ts` — leaving **246 scattered across ~40 component/screen files**.
- **204** deep relative imports (`../../` or worse) across **76** files; the `@/*` path alias
  defined in `tsconfig.json` is used **6** times.
- **50** files style with NativeWind `className`, **34** with `StyleSheet.create`.
- **0** uses of `@ConfigurationProperties`; **28** hand-mapped env keys in `EnvConfig`.
- `tsconfig.json` has `"strict": false`.

---

## 3. What Is Already Right — Protect It

This is not a rewrite. The codebase has several deliberate, well-executed patterns. The plan
below **extends these patterns to the places that don't yet follow them**, rather than
inventing new ones.

| Existing good pattern | Where | Why it matters to this plan |
|---|---|---|
| **Strategy + chain of responsibility** for nutrition sources | `modules/nutrition/provider/NutritionProvider.java` — `source()` / `isConfigured()` / `fetch()`, chained by config, "adding a source means adding a bean, not editing the flow" | This is the reference design for §4.2 F5 (AI clients). Copy it; don't invent a second abstraction. |
| **Provider registry keyed by name** | `AiTextService` builds `Map<String, AiTextClient>` from injected `List<AiTextClient>` | Correct open/closed extension point. Keep. |
| **Uniform error contract** | `common/GlobalExceptionHandler` — services signal with `ResponseStatusException`, everything else becomes a logged generic 500 | The target convention for F4. |
| **Single access point for the current user** | `common/CurrentUserProvider` | Already documents the rule F3 will enforce. |
| **Typed, injectable API layer** | `frontend/src/services/api/*` — each `create*Api(client: HttpClient = apiClient)` | The target convention for F10. |
| **Screen → hook separation** | 11 of 17 screens hold **zero** `useState` and delegate to a `use*` hook (`useDashboard`, `useFoodLog`, `useHabitCreationForm`, …) | The target convention for F12/F13. The pattern exists; six screens just don't follow it. |
| **Single design-token source** | `theme/tokens.ts` with an explicit "do not merge these hues" comment | The target convention for F15. |
| **Behaviour-first test suite** | `services/notifications/__tests__/*` covers scheduling, reconciliation, staleness, clock maths | This is the safety net that makes the notification refactors (F11) safe at all. |

---

## 4. Findings Register

Severity = risk to maintainability/scalability if left alone.
Effort = S (< ½ day), M (½–2 days), L (> 2 days).

### 4.1 Cross-cutting

---

**F1 · Dead code and abandoned compatibility shims** — Sev: Med · Effort: S

Files that exist only to preserve call sites that no longer exist:

| File | Status |
|---|---|
| `frontend/src/hooks/useApi.tsx` (105 lines) | **Zero importers.** Superseded by `services/api/*`. The only reference is a comment in `useFoodLog.ts:20` describing the pattern it replaced. |
| `frontend/src/services/authService.js` (9 lines) | **Zero importers.** Self-describes as "Backward-compatible shim". |
| `frontend/src/api/client.js:40-41` | `DEFAULT_BASE_URL` re-export — **zero importers.** |
| `backend/…/modules/food/seed/FakeFoodLogBackfillRunner.java` | **0 bytes.** Empty file in production sources. |

*Why it matters:* dead code is read as live code by the next maintainer, and `useApi` in
particular advertises a second, competing data-access idiom.

*Action:* delete all four. Delete the now-empty `seed/` package.

---

**F2 · Pass-through indirection layers** — Sev: Med · Effort: M

`frontend/src/services/habitScheduler.ts` and `mealScheduler.ts` both open with
"Backward-compatible … surface. The real logic lives in `src/services/notifications/*`".
Every exported function is a one-line delegation. `mealScheduler.ts` additionally publishes
**three names for one type**: `MealSchedule` → `MealReminder` → `MealSlot`.

*Why it matters:* two extra hops and a synonym set between a screen and the logic it calls;
"go to definition" lands on a forwarder. The migration these shims covered is finished.

*Action:* inline the delegations at the ~12 call sites, collapse the type aliases to
`MealSchedule`, delete both files. Pure mechanical rename — no logic moves.

---

**F3 · Documentation sprawl at the repo root** — Sev: Low · Effort: S — ✅ **resolved in Phase 1**

> The paths below are the *pre-Phase-1* locations, kept as the record of what was measured.
> They now live under `docs/` and `docs/history/`.

11 markdown files, 137 KB, several of them process artefacts rather than reference docs:
`DESIGN_REVIEW.md` (59 KB), `NOTIFICATION_RELIABILITY_PROMPT.md` (21 KB),
`frontend/UI_REDESIGN_AUDIT.md` (17 KB), `frontend/NOTIFICATION_TESTING.md` (13 KB).

*Action:* keep `README.md`, `backend/README.md`, `frontend/README.md`, and the two docs that
describe live invariants (`NOTIFICATION_RELIABILITY_DESIGN_NOTES.md`,
`backend/ENTRY_HASH_NUTRITION_FLOW.md`). Move the rest to `docs/history/`. Zero code risk;
do it in the same commit as F1 so the tree reads clean from the start.

---

### 4.2 Backend (Spring Boot)

---

**F4 · `VoiceLogService` is a god service (482 LOC, 6 responsibilities)** — Sev: **High** · Effort: L

`modules/voice/VoiceLogService.java` currently owns:

1. Vapi webhook payload → food entries (`processVoiceMealLog`)
2. `VoiceMealSession` audit-record lifecycle (create/complete/fail, 4 `save()` sites)
3. Vapi **client session configuration** — 4 `@Value` fields (lines 48–61), assistant-id
   resolution, API-key sanitisation, a `@PostConstruct` config-warning block
4. Request de-duplication via an **in-process** `ConcurrentHashMap` (line 46) with manual
   eviction (`cleanupOldIdempotencyKeys`) and a hand-rolled `sha256` helper
5. **Two LLM prompt templates** embedded as 40-line string literals
6. LLM response parsing into domain objects

Secondary problems in the same file:

- Six `throw new RuntimeException(...)` sites — the **only** ones in the codebase besides one
  in `AuthService`. Everything else uses `ResponseStatusException`, so these bypass the
  intended mapping in `GlobalExceptionHandler` and surface as generic 500s.
- Field-level `@Value` injection while the rest of the class uses constructor injection —
  the class cannot be constructed in a unit test without Spring.
- The idempotency map is **per-JVM**: it silently stops working the moment a second instance
  runs. This is a scalability defect hiding inside a service-organisation problem.

*Target design:*

```
modules/voice/
├── VoiceLogController.java          (thin; see F6)
├── config/VapiProperties.java       @ConfigurationProperties("vapi") — record, validated
├── session/VapiSessionService.java   assistant-id + client-token resolution ONLY
├── webhook/VapiWebhookProcessor.java payload → FoodLogService, no persistence concerns
├── transcript/
│   ├── TranscriptParsingService.java parse transcript → entries
│   ├── TranscriptInterpreter.java    classify transcript → {shouldLog, rescheduleMinutes}
│   └── prompt/MealTranscriptPrompts.java  templates, as text blocks or resources
├── session/VoiceSessionRecorder.java VoiceMealSession lifecycle (the audit trail)
└── idempotency/TranscriptIdempotencyGuard.java  interface + current in-memory impl
```

`TranscriptIdempotencyGuard` as an interface is the key move: it makes the single-instance
limitation **explicit and swappable** (a Mongo TTL-collection implementation becomes a
drop-in) instead of an invisible assumption. Behaviour today is unchanged — the in-memory
implementation is the one that gets wired.

Convert the six `RuntimeException`s to `ResponseStatusException` with accurate statuses
(`400` for a malformed date, `404` for a missing user, `422` for an empty payload) —
**this is the one intentional behaviour change in the plan** and needs your sign-off (§9).

---

**F5 · ~120 lines of near-verbatim duplication between the two AI clients** — Sev: **High** · Effort: M

`GeminiService.java:187-256` and `GroqService.java:217-288` contain the same retry engine:

| Method | Relationship |
|---|---|
| `isRetryableStatusCode(int)` | **byte-identical** (429/500/502/503/504) |
| `isRetryableTransportException(Throwable)` | **byte-identical** (cause-chain walk) |
| `computeBackoffMs(int)` | **byte-identical** (shifted exponential, clamped) |
| `sleepBeforeRetry(long)` | identical except the exception type thrown |
| `isRetryable{Gemini,Groq}Error(…)` | identical except the parameter type |
| `isRetryableErrorBody(String)` | same shape; **differs only in the keyword list** |
| `validate{Gemini,Groq}Configuration()`, `sanitizeApiKey(String)` | same shape |

Both classes also independently re-declare the same 4 retry-tuning `@Value` parameters
(7 in `GroqService`, 6 in `GeminiService`).

*Why it matters:* a retry-policy fix has to be made twice and has already drifted once
(`isRetryableErrorBody` keyword sets). Adding a third provider means a third copy.

*Target design:* an `AbstractRetryingAiTextClient` template-method base (or, preferred, a
composed `AiRetryPolicy` collaborator + `AiRetryProperties` record) holding the identical
logic, with exactly two extension points per provider: the retryable-keyword set and the
provider-specific request/response mapping. `GeminiApiException` already extends
`AiProviderException`, so the exception hierarchy needs no change.

*Verification:* extract with the existing behaviour pinned by new unit tests on
`computeBackoffMs`, `isRetryableStatusCode`, and `isRetryableErrorBody` **for both keyword
sets** before touching either class.

---

**F6 · Fat controllers, and `SecurityContextHolder` read directly in 4 of them** — Sev: **High** · Effort: M

`common/CurrentUserProvider` exists and its own javadoc states: *"Services should depend on
this instead of reading `SecurityContextHolder` themselves."* Four controllers ignore it:

- `modules/voice/VoiceLogController.java:92, 125, 144, 202` (4 sites)
- `modules/auth/controller/AuthController.java:71`
- `modules/auth/controller/ProfileController.java:35, 62`

`FoodController.java` (145 LOC) injects **four** services and serves four unrelated concerns
under one `/food` prefix: entry CRUD, weekly nutrition reports, nutrient preferences, and AI
insights. `VoiceLogController` *also* maps `/food`, so route ownership is split across two
classes.

`VoiceLogController` additionally: validates the Vapi webhook secret inline (lines 50–53)
with a field-injected `@Value` (line 33), returns `ResponseEntity<?>` wildcards, and wraps
its body in `catch (Exception)`.

*Actions:*
1. Route all six call sites through `CurrentUserProvider`. Mechanical, behaviour-identical.
2. Split `FoodController` into `FoodEntryController` (`/food`),
   `NutritionReportController` (`/food/nutrition`), `NutrientPreferenceController`
   (`/food/nutrient`), `NutritionInsightsController` (`/food/nutrition/insights`) — **paths
   unchanged**, so no client change. Each ends up with one injected service.
3. Move webhook-secret validation into a dedicated `VapiWebhookAuthenticationFilter` (or a
   small `@Component` predicate), replace `ResponseEntity<?>` with concrete types.

---

**F7 · Configuration is hand-plumbed in three different ways** — Sev: Med · Effort: M

- **Zero** `@ConfigurationProperties` in the codebase; 31 scattered `@Value` annotations,
  7 of them field-level (untestable without Spring).
- `config/EnvConfig.java` (181 LOC) maintains **two parallel hand-written lists** that must
  stay in lockstep: 28 supported env keys (`getSupportedKeys`, lines ~102–136) and 28
  key→Spring-property aliases (`getSpringPropertyAliases`, lines ~138–168). Adding one env
  var means editing two lists; forgetting the second fails silently.
- The same file logs startup diagnostics with **`System.out.println`/`System.err.println`**
  (14 sites, starting line 26) rather than SLF4J, including lines that name which secrets
  were loaded.

*Target design:* typed, validated `@ConfigurationProperties` records grouped by concern —
`GeminiProperties`, `GroqProperties`, `AiRetryProperties`, `VapiProperties`,
`JwtProperties`, `NutritionProviderProperties`. Replace the dual-list mapping with a single
derivation (`SERVER_PORT` → `server.port` is `toLowerCase().replace('_','.')` for most keys;
the handful of genuine exceptions become a small explicit override map). Swap the
`println`s for a logger at `INFO`/`WARN`.

*Payoff:* config becomes discoverable, fail-fast (`@Validated`), and unit-testable; each new
env var is one line, not three.

---

**F8 · Inconsistent module package layout** — Sev: Med · Effort: M

| Module | Layout |
|---|---|
| `modules/auth` | `controller/` `service/` `repository/` `entity/` `dto/` — **layered, 0 flat files** |
| `modules/food` | **17 flat files** + `dto/` + (empty) `seed/` |
| `modules/nutrition` | **20 flat files** + `provider/` + `units/` |
| `modules/habit` | **15 flat files**, no subpackages at all |
| `modules/mealschedule` | 5 flat files |
| `modules/dashboard` | 3 flat files + an empty `controller/` |
| `modules/voice` | 4 flat files + `dto/` |

In `modules/habit`, entity (`Habit`, `HabitEntity`), repositories, service, scheduler,
controller, enum, and **7 DTOs** all sit in one namespace. In `modules/food`, `FoodEntry`
(entity) sits beside `FoodItemResponse` (DTO), `MealTypes` (constants), `FoodLogQueries`
(query builder) and four services.

*Action:* adopt `modules/auth`'s layout everywhere — `controller/ service/ repository/
entity/ dto/`, plus module-specific packages where they already earn their place
(`nutrition/provider`, `nutrition/units`). This is pure file movement plus package
statements; an IDE move-refactor with a full-build verification. Remove the empty
`dashboard/controller/` package.

*Sequencing note:* do this **after** F4/F5/F6 so those refactors don't have to be rebased
across a large file move.

---

**F9 · Test coverage is 4 files for 108 classes** — Sev: **High** · Effort: L

Existing: `HabitServiceTest`, `MealScheduleServiceTest`, `NutritionScalerTest`,
`VoiceLogServiceTest`. Untested: every controller, the whole security/JWT path, the nutrition
provider chain, `FoodLogService`, `NutritionReportService`, `NutritionEnrichmentService`,
`NutritionInsightsService`, `NutrientPreferenceService`, `DashboardService`, both AI clients.

*Why it matters:* this is what makes F4–F8 feel risky. It is the reason the plan is phased
the way it is.

*Action, in the order the refactors need it:*
1. `@WebMvcTest` slices for each controller (locks the HTTP contract before F6 splits them).
2. Pure unit tests for the retry helpers (before F5 extracts them).
3. Unit tests for `NutritionScaler`/`UnitConversion` edge cases and `FoodLogQueries`.
4. One `@SpringBootTest` smoke test asserting the context loads with a representative
   property set (catches every F7 mistake at once).

---

### 4.3 Frontend (React Native)

---

**F10 · Three competing data-access idioms** — Sev: Med · Effort: M

1. **Intended:** typed domain modules — `services/api/{auth,habit,foodLog,nutrition,dashboard}Api.ts`,
   each an injectable `create*Api(client: HttpClient = apiClient)` factory. Good.
2. **Bypass:** `apiClient` imported directly by non-API modules —
   `services/vapiSessionService.ts`, `services/notifications/habitStore.ts:22`,
   `mealScheduleStore.ts:9`, `habitOccurrenceApi.ts:7`. Endpoint strings and response
   shapes for habits/meal-schedules therefore live in **two** places.
3. **Dead:** `hooks/useApi.tsx` (see F1).

Also: `api/client.js` is **JavaScript** in a TypeScript codebase (as is `authService.js`),
so the axios instance — the one object every request flows through — is untyped.

*Actions:* move the four bypassing modules' HTTP calls into the matching `services/api/*`
module (or add `voiceApi.ts`); convert `api/client.js` → `client.ts` with a typed
`HttpClient` export; delete the shims per F1. Endpoint strings then have exactly one home.

---

**F11 · Six hand-rolled AsyncStorage stores with divergent rigour** — Sev: Med · Effort: M

`services/notifications/{habitStore, mealScheduleStore, missedStore, rescheduleStore,
pendingAnswerStore, processedActions}.ts` each implement the same private pair:

```
readAll()  → getItem(KEY) → JSON.parse → shape-check → [] on any failure + reminderLog.warn
writeAll() → JSON.stringify → setItem(KEY)
```

But the shape-check has drifted: `rescheduleStore.ts:31-40` validates **every element**
(`typeof e.id === 'string' && typeof e.fireAt === 'number'`), while `missedStore.ts:29-38`
only checks `Array.isArray`. So one store rejects a corrupt element and its neighbour
persists it. Storage keys are six independent module-private `STORAGE_KEY` constants, and
the auth token key `'token'` is an inline string literal in `context/AuthContext.tsx` (4
sites) and `api/client.js` (2 sites).

*Target design:* a `createJsonArrayStore<T>(key, guard: (x: unknown) => x is T, opts?: {max})`
factory in `services/storage/`, plus a single `storageKeys.ts` registry (which also
documents the `_v1`/`_v2` migration suffixes that currently exist only as string tails).
Each store keeps its domain functions (`recordMissed`, `upsertReschedule`, …) and loses its
duplicated I/O. **Every store gains element-level validation** — a deliberate hardening;
call it out in the commit message since it changes behaviour on corrupt input only.

*Verification:* the notification test suite (7 files) already covers `habitStore`,
`processedActions`, `reconcileDiff`, `scheduler`, `staleness` — run it after each store
migrates, one store per commit.

---

**F12 · Voice screens carry orchestration that every other screen delegates to a hook** — Sev: **High** · Effort: M

The app's dominant, correct pattern is *screen renders, hook decides*: `FoodLogScreen`,
`HabitScreen`, `HabitCreationScreen`, `ManualFoodLogScreen`, `WeeklyNutritionSummaryScreen`,
`ReminderHealthScreen`, `ProfileScreen` and `NutritionReportScreen` hold **zero** `useState`.

The two voice screens don't follow it:

- `screens/main/VoiceMealLogScreen.tsx` (318 LOC) — `getFoodLogSnapshot` (81),
  `waitForNutritionEnrichment` (101, a **polling loop**), `parseMealsFromTranscript` (149–275).
  Two timeout constants, two refs, an autostart effect.
- `screens/main/VoiceHabitScreen.tsx` (345 LOC) — `processHabitResult` (208–310),
  plus module-local `parseTimeToMinutes` / `sameTime` helpers (45–70) that duplicate what
  `utils/timeFormatter.ts` is for.

Both files have the **same skeleton** (identical 11-line import block shape, autostart
effect, transcript-processing callback, `getStatusText`, render `VoiceSessionScreen`) —
i.e. a shared abstraction is already implied by the structure.

*Action:* extract `useVoiceMealSession` and `useVoiceHabitSession` alongside the existing
`useVapiSession`, lifting the API orchestration, polling, reschedule-arming and status
derivation out of the components. Move the two time helpers into `utils/timeFormatter.ts`.
Screens become presentational, like their eleven siblings.

---

**F13 · Auth and onboarding screens hold raw form state** — Sev: Med · Effort: M

`RegisterScreen.tsx` holds **11** `useState` (lines 63–74: name, dob, gender, email,
password, confirm, agree, touched, submitted, showDob, registerError);
`LoginScreen.tsx` holds 5; `OnboardingMealScheduleScreen.tsx` holds 5.

Meanwhile `hooks/useProfileForm.ts`, `useHabitCreationForm.ts` and `useManualFoodLogForm.ts`
already exist, each with a test — the form-hook pattern is established and proven, just not
applied here. `utils/authValidation.ts` (tested) already holds the validation rules, so the
hooks have somewhere to delegate to.

*Action:* add `useRegisterForm`, `useLoginForm`, `useOnboardingMealScheduleForm` following
`useProfileForm`'s shape and test style.

---

**F14 · `AuthContext` mixes three concerns** — Sev: Med · Effort: M

`context/AuthContext.tsx` exposes a 14-member value covering (a) authentication,
(b) **token persistence** — raw `AsyncStorage.getItem/setItem/removeItem('token')` inline,
(c) **onboarding flow state** (`needsOnboarding`, `onboardingCallTime`,
`setOnboardingCallTime`, `completeOnboarding`), and (d) reminder side-effects
(`onLoginReminders` / `onLogoutReminders`).

Consequence: any onboarding-state change re-renders every `useAuth()` consumer, and the
context can't be tested without AsyncStorage.

*Action:* extract a `tokenStorage` module (single owner of the `'token'` key, feeding the
key registry from F11), split onboarding state into `OnboardingContext`, keep
`AuthContext` to session + identity. Split the existing `AuthContext.test.tsx` to match.

---

**F15 · Design tokens: one source, four aliasing layers, 246 stragglers** — Sev: Med · Effort: L

`theme/tokens.ts` is the documented single source (82 hex values, with an explicit
"do not merge these hues" rationale). But four modules re-export it under different names —
`components/auth/authTheme.ts` (`T`, `R`), `components/nutrition-report/weekly-summary/tokens.ts`
(`tokens`), `theme/callTheme.ts` (`callColors`), `components/nutrition-report/constants.tsx` —
so the same colour is reachable as `brandGreen.base`, `T.green`, and a literal.

And **246 hex literals remain outside `tokens.ts`**, concentrated in
`components/food-log/MealGroup.tsx` (28), `screens/main/DashBoardScreen.tsx` (18),
`components/nutrition-report/NutritionCard.tsx` (15), `components/food-log/CheckinCard.tsx` (13),
and ~35 more files.

Separately, styling is split down the middle: **50** files use NativeWind `className`,
**34** use `StyleSheet.create` — several use both.

*Action (staged, and the one place I recommend restraint):*
1. Sweep the 246 literals into semantic tokens, **file by file**, verifying each swap is the
   same value. This is mechanical and safe; it is also where the real payoff is.
2. Collapse the four alias layers to **one** semantic scale with per-surface namespaces
   (`tokens.auth.*`, `tokens.report.*`, `tokens.call.*`).
3. Do **not** unify NativeWind vs `StyleSheet` in this pass — see §8.

---

**F16 · `"strict": false`, and a path alias nobody uses** — Sev: **High** · Effort: L

`frontend/tsconfig.json`: `"strict": false`, `"allowJs": true`, no `noUncheckedIndexedAccess`,
no `noImplicitOverride`. TypeScript is currently checking names, not types — implicit `any`
flows freely (`useApi.tsx` alone has three `any`s in its public interface).

The same file defines `"@/*": ["./*"]`, used **6** times. Meanwhile there are **204** deep
relative imports across **76** files — `ManualFoodLogScreen.tsx` and `FoodLogScreen.tsx`
have **12 each**, and eight screens have 8+.

*Action:*
1. Re-point the alias at `src` (`"@/*": ["src/*"]`, mirrored in `babel.config.js`'s
   `module-resolver` — `babel-plugin-module-resolver` is already a dependency, so **no new
   dependency**), then codemod the 204 deep imports. Import lines become stable under file
   moves, which is what makes F8-style reorganisation cheap on the frontend too.
2. Turn on strictness **incrementally**: `strict: true` plus a per-file `// @ts-nocheck`
   escape hatch would be the fast path, but the honest route is
   `noImplicitAny` → `strictNullChecks` → `strict` → `noUncheckedIndexedAccess`, fixing
   each wave. Expect real bugs to surface; each is a separate commit.
3. Enrich `.eslintrc.js` (currently 8 lines, just `extends: '@react-native'`) with
   `import/order` and a `no-restricted-imports` boundary rule that forbids screens importing
   `api/client` directly — this is what stops F10 from regressing.

---

**F17 · Date/time logic spread over six modules in two directories** — Sev: Med · Effort: M

| Module | Owns |
|---|---|
| `utils/date.ts` | local-date strings, ordinals |
| `utils/timeFormatter.ts` | 7 × 12-hour formatters |
| `utils/weekRange.ts` | Sun–Sat and Mon–Sun week ranges |
| `utils/daySelection.ts` | `type DayKey = 'Mon'\|…\|'Sun'` + weekday-set helpers |
| `services/notifications/time.ts` | `type WeekdayCode = 'Sun'\|…\|'Sat'` + timezone maths |
| `services/notifications/clockTime.ts` | `WallClockTime`, `parseClockTime`, slot keys |

Two independent weekday-string unions (`DayKey`, `WeekdayCode` — same seven strings, different
order) and two clock-formatting families now coexist, requiring conversion at every boundary.

*Action:* one `DayCode` union, one canonical clock-time representation. Keep the
timezone-aware notification maths where it is (it is well tested and genuinely different
from display formatting) — this is about eliminating the duplicate *type*, not merging the
modules.

---

**F18 · Frontend test coverage: 30 files for 189 modules** — Sev: Med · Effort: L

Well covered: `services/notifications/*` (7 files), `utils/*` (10 files), 9 hooks.
Uncovered: **every screen**, every component, `services/api/*` beyond one file,
`useVapiSession`, `useDashboard`, `useFoodForm`, `useIncomingCall`, the whole notification
hook layer (`hooks/notifications/*`, 6 modules). The root suite is a single `App.test.tsx`.

*Action:* add render tests for the screens that F12/F13 touch — **written before** the
extraction, asserting current rendered output. `jest.config.js` is 3 lines; add
`collectCoverageFrom` with `!src/components/ui/**` so the 8,748 generated lines stop
distorting the number.

---

## 5. Phased Roadmap

Ordered so that **every phase leaves the tree releasable**, and so the risky work happens
only after the safety net exists.

### Phase 0 — Safety net *(no production code changes)*
> Nothing else in this plan is safe without this. Do not skip.

| # | Task | Findings |
|---|---|---|
| 0.1 | `@WebMvcTest` slice per backend controller, pinning current HTTP contracts | F9 |
| 0.2 | Unit tests for the AI retry helpers, both keyword sets | F9, F5 |
| 0.3 | `@SpringBootTest` context-load smoke test with a representative property set | F9, F7 |
| 0.4 | Render tests for the 5 screens Phases 3–4 will touch | F18, F12, F13 |
| 0.5 | `collectCoverageFrom` excluding `src/components/ui/**`; record the real baseline | F18 |

**Exit:** full backend + frontend suites green; coverage baseline recorded in the PR.

### Phase 1 — Subtraction *(lowest risk, immediate legibility win)* — ✅ **done 2026-08-23**

| # | Task | Findings | Status |
|---|---|---|---|
| 1.1 | Delete `useApi.tsx`, `authService.js`, the `DEFAULT_BASE_URL` re-export, the empty `FakeFoodLogBackfillRunner.java` + `seed/` | F1 | ✅ |
| 1.2 | Inline and delete `habitScheduler.ts` / `mealScheduler.ts`; collapse `MealReminder`/`MealSlot` → `MealSchedule` | F2 | ✅ |
| 1.3 | Move process docs to `docs/history/` | F3 | ✅ |

**Exit:** ~130 fewer lines, four fewer indirection hops, no behaviour delta.

**Deviations from the plan as written, and why:**

- **1.2 — three of the ten shim exports were not one-line delegations.** `saveSchedule`,
  `scheduleHabitReminder` and `cancelHabitReminder` each composed two calls (cache write →
  reconcile) with the rationale documented in comments. Inlining those at every call site
  would have duplicated the composition 4× and lost the rationale, so instead they were
  **moved into `services/notifications/reminderService.ts`** — the module whose own header
  already declares it "the public facade … screens import from here". Net effect is the one
  F2 asked for: one facade instead of two, and "go to definition" now lands on real logic.
  `saveSchedule(x)` + `scheduleAllAlarms(x)` collapsed to the pre-existing
  `saveMealSchedule(x)`, which was already byte-for-byte the same three calls.
- **1.2 — four exports had zero call sites** and were deleted rather than relocated:
  `ensureHabitChannels`, `cancelHabitCallSlot`, `cancelAllMealAlarms`, and the `MealSlot`
  type alias.
- **1.3 — `NOTIFICATION_TESTING.md` went to `docs/`, not `docs/history/`.** §6 of this plan
  requires walking it on a device before every notification-touching merge, and it was last
  updated 2026-06-16 (`b987410`) — it is a live runbook, so filing it under "history" would
  misrepresent it. The five genuine process artefacts went to `docs/history/` as specified.

### Phase 2 — Backend structure — ✅ **done 2026-08-23**

| # | Task | Findings | Status |
|---|---|---|---|
| 2.1 | Extract `AiRetryPolicy` + `AiRetryProperties`; collapse the duplicated retry engine | F5 | ✅ |
| 2.2 | Route the 6 `SecurityContextHolder` sites through `CurrentUserProvider` | F6 | ✅ (7 sites) |
| 2.3 | Split `FoodController` into 4 controllers (**paths unchanged**) | F6 | ✅ |
| 2.4 | Decompose `VoiceLogService` per §F4; `TranscriptIdempotencyGuard` as an interface | F4 | ✅ |
| 2.5 | `RuntimeException` → `ResponseStatusException` | F4 | ✅ signed off |
| 2.6 | Extract Vapi webhook auth into a filter; drop `ResponseEntity<?>` wildcards | F6 | ✅ |
| 2.7 | `@ConfigurationProperties` records; `EnvConfig` dual-list → single derivation; `println` → SLF4J | F7 | ✅ partial |
| 2.8 | Normalise all module packages to the `modules/auth` layout | F8 | ✅ |

**2.8 went last on purpose** — it touched ~100 files, so every earlier refactor landed before
the big move rather than being rebased across it.

**Deviations from the plan as written, and why:**

- **2.2 — the plan's "behaviour-identical" claim did not survive contact.** `CurrentUserProvider`
  throws 401, but `/auth/me` answers an anonymous caller `{valid:false}` and `/profile` answers
  `{message:...}`; routing them through the throwing accessor would have changed both bodies.
  Added `findCurrentUser(): Optional<User>` so all seven sites keep their exact responses.
  An `isAuthenticated()` check was tried and reverted — a no-op in production (the JWT filter
  always builds the three-argument token) but it rejects the two-argument token tests use, which
  `MealScheduleServiceTest` caught immediately.
- **2.4 found eight `RuntimeException` sites, not six.** The plan's grep missed the two inside
  `orElseThrow` lambdas.
- **2.5's real footprint is one path, not six.** The plan assumed these failures surfaced as
  `GlobalExceptionHandler`'s generic 500. They did not: both entry points caught `Exception`
  themselves. Only `parse-transcript` was opened up, and only its missing-user path changes
  (500 → 404). The body deliberately keeps this endpoint's own `{error: string}` shape, because
  `VoiceMealLogScreen` renders that string — the uniform contract's `"Not Found"` reason phrase
  would have become user-facing copy. **The webhook keeps swallowing everything into 202 on
  purpose:** its new 400/422 are permanent failures and Vapi retries any non-2xx, so surfacing
  them would cause re-delivery of a payload that can never succeed.
- **2.7 — the plan's derivation rule was backwards.** `toLowerCase().replace('_','.')` only
  reproduces 12 of the 28 property names, because the leaf segments are kebab-case
  (`gemini.api.retry.max-attempts`). Deriving in the *other* direction — property name to env
  key, uppercase with `.`/`-` → `_` — reproduces 25 of 28, leaving exactly three legacy
  overrides (`GEMINI_MODEL`, `GROQ_MODEL`, `MONGODB_URI`). The single list is therefore keyed by
  Spring property name.
- **2.7 is partial by scope, and named as such.** The six records the plan lists were done.
  `spoonacular.api.*`, `usda.api.*`, `mongo.*`, `cors.allowed-origins` and `ai.provider` stay on
  `@Value`. Separately, `JwtAuthenticationFilter` still writes seven `System.out.println` lines
  per request — including the authenticated email — which is outside F7's stated scope but is a
  worse instance of the same defect.
- **2.8 left six files at their module roots.** `MealTypes`, `NutrientCatalog`, `NutrientKeys`,
  `Nutrients`, `JsonNumbers` and `VoiceTranscriptProcessingException` belong to no single layer
  and are read from all of them; filing `MealTypes` under `entity/` or `dto/` would claim
  something untrue. `HabitCompletionDTO` and `HabitDTO` had to widen from package-private to
  public, being used from what are now sibling packages.
- **Verification, given Phase 0 was skipped.** Two throwaway harnesses were written, run, and
  removed rather than committed: a standalone-MockMvc route inventory (13 `/food` routes resolve
  to the expected handlers) and an `ApplicationContextRunner` binding suite (8 checks: every
  default equals the `@Value` default it replaced, clamping survives binding, missing required
  properties still fail startup, an empty Gemini key still starts, the Vapi assistant fallback
  distinguishes unset from empty, all 28 env keys derive to their historical names, and
  `EnvConfig` still instantiates from `spring.factories` with its new `DeferredLogFactory`
  constructor). Both were re-run against the moved tree after 2.8. They are worth committing if
  Phase 0 is ever revisited.

### Phase 3 — Frontend data & storage — ✅ **done 2026-08-23**

| # | Task | Findings | Status |
|---|---|---|---|
| 3.1 | `api/client.js` → `client.ts`, typed `HttpClient` | F10 | ✅ |
| 3.2 | Move the 4 bypassing modules' HTTP calls into `services/api/*` | F10 | ✅ |
| 3.3 | `createJsonArrayStore<T>` factory + `storageKeys.ts`; migrate the 6 stores **one per commit** | F11 | ✅ |
| 3.4 | `tokenStorage` module; single owner of the `'token'` key | F11, F14 | ✅ |
| 3.5 | Split `OnboardingContext` out of `AuthContext` | F14 | ✅ |

**Deviations from the plan as written, and why:**

- **3.1 and 3.4 landed in one commit.** `api/client` is one of the two owners of the `'token'`
  key, so splitting them meant writing the token accessors twice and reverting one leaves the
  other broken.
- **3.3 needed two factories, not one.** `mealScheduleStore` persists a single
  `{hour, minute, enabled}` object, so it was never an array store; it uses a
  `createJsonValueStore<T>` sibling. Calling it an array store would have been a fiction.
  The other five use `createJsonArrayStore<T>` as specified, one per commit.
- **3.3 — the element-guard hardening bit three stores, not all six.** `rescheduleStore` and
  `habitStore` already validated elements, and `mealScheduleStore` is a single value.
  `missedStore`, `pendingAnswerStore` and `processedActions` gained element validation, so a
  malformed record is now dropped instead of read back and re-persisted.
- **3.5 required inverting the provider order.** `OnboardingProvider` wraps `AuthProvider`,
  because registration arms the flow and a parent cannot read a child's context. It also
  surfaced a latent lint error: moving `resetOnboarding` into `logout`'s closure made
  `react-hooks/exhaustive-deps` flag the effect's empty dependency array. Fixed with
  `useCallback` rather than suppressed.
- **3.5 — `setOnboardingCallTime` has no caller anywhere in the app**, so `onboardingCallTime`
  is always `null` and the navigator's `ONBOARDING_DONE` branch is unreachable; the chosen time
  actually reaches the Done screen as a navigation param. Removing the pair is provably
  behaviour-identical, but it deletes a navigator branch, so it was documented in
  `OnboardingContext` and left for a decision rather than done unasked.
- **No new tests were written** (see §9 decision 5). The existing suites were kept green and
  three were adjusted mechanically: `VoiceLogServiceTest` became
  `TranscriptInterpreterTest`, `habitStore.test.ts` now seeds through
  `StorageKeys.habitDefinitions` instead of a raw key literal, and `AuthContext.test.tsx`
  gained the `OnboardingProvider` wrapper. F14's "split the test to match" was not done.

### Phase 4 — Frontend component/hook boundaries — ✅ **done 2026-08-23**

| # | Task | Findings | Status |
|---|---|---|---|
| 4.1 | `useVoiceMealSession` / `useVoiceHabitSession`; move time helpers to `utils/timeFormatter.ts` | F12 | ✅ |
| 4.2 | `useRegisterForm`, `useLoginForm`, `useOnboardingMealScheduleForm` | F13 | ✅ |
| 4.3 | Unify `DayKey` / `WeekdayCode` into one `DayCode` | F17 | ✅ |
| 4.4 | Relocate the 3 loose `components/*.tsx` into feature or `components/common/` | F8-analogue | ✅ (2 moved, 1 deleted) |

**Deviations from the plan as written, and why:**

- **4.1 — the two time helpers moved verbatim, not unified.** `timesMatch` /
  `parseTimeToMinutes` now live in `utils/timeFormatter.ts` as
  `timesMatch` / `parseTime12hToMinutes`, but they were *not* rewritten to delegate to
  `clockTime.parseClockTime`. That parser is anchored and range-validated; the habit one is
  deliberately unanchored and lenient, and `timesMatch` also has a normalised-exact-match
  fast path that makes 24-hour strings compare. Delegating would change which strings match
  — `timesMatch('', '')` is `true` today and `habitTime` defaults to `''`. The comment on
  the new helper says which parser to reach for.
- **4.1 — navigation stayed in the screens.** No hook in this codebase imports
  react-navigation, so the habit hook takes an `onRescheduled` callback for the
  post-reschedule bounce rather than calling `navigate` itself. Matches
  `useHabitCreationForm(onSaved)`.
- **4.2 — `useLoginForm` preserves an asymmetry rather than fixing it.** Typing clears the
  sign-in banner but *not* the field error; the field error only re-computes on blur and on
  submit. That is what shipped, so it is what the hook does, with a comment saying so.
- **4.2 — two inline styles became `StyleSheet` entries** as a side effect of extracting the
  render (LoginScreen's field stack, the onboarding time-select text block). Lint warnings
  76 → 74.
- **4.3 — the two ordered arrays were renamed, and that is the point.** `ALL_DAYS` and
  `WEEKDAY_CODES` gave no hint that one started on Sunday. They are now
  `DAY_CODES_MONDAY_FIRST` (display order) and `DAY_CODES_SUNDAY_FIRST` (`Date#getDay()`
  index order) in the new `utils/dayCode.ts`, with element order untouched.
  `normalizeWeekdayCode` / `weekdayIndexToCode` keep their names — F17 is about the
  duplicate *type*, and renaming tested exports would be diff noise.
- **4.4 — `FoodItem.tsx` was deleted, not relocated.** It has zero importers; every
  `FoodItem` in the tree is the *type* from `types/types.ts`. Phase 1/F1 was the subtraction
  pass and missed it. Moving dead code to a tidier folder only makes it harder to spot next
  time. It carried 11 of the repo's inline-style warnings (74 → 63).

### Phase 5 — Type safety and tokens — ✅ **done 2026-08-23** *(5.2 and 5.3 partial by decision)*

| # | Task | Findings | Status |
|---|---|---|---|
| 5.1 | Re-point `@/*` at `src`; codemod the deep imports | F16 | ✅ (214 specifiers, 80 files) |
| 5.2 | ESLint `import/order` + `no-restricted-imports` boundary rules | F16 | ⚠️ boundary rules ✅; `import/order` **not done** |
| 5.3 | `noImplicitAny` → `strictNullChecks` → `strict` → `noUncheckedIndexedAccess` | F16 | ⚠️ `strict: true` ✅; `noUncheckedIndexedAccess` **skipped by decision** |
| 5.4 | Sweep the stray hex literals into semantic tokens | F15 | ✅ (271 → 1) |
| 5.5 | Collapse the 4 token alias layers into one namespaced scale | F15 | ✅ |

**5.5 was executed before 5.4, deliberately** — collapsing the alias layers first meant the
literal sweep could add its new tokens straight into the final namespaces instead of writing
them twice.

**Deviations from the plan as written, and why:**

- **5.1 — 214 specifiers across 80 files, not 204 across 76.** The tree moved during Phases
  2–4. Also: `"@/*": ["src/*"]` fails as written (TS5090 without a `baseUrl`); it needs
  `["./src/*"]`. Single-hop and `./` specifiers were left relative on purpose — they are
  sibling/parent access, they read fine, and they do not rot under file moves. `jest.mock`
  and `require` strings *were* rewritten, since they rot for exactly the same reason imports
  do; `babel-plugin-module-resolver` transforms them by default, and `jest.config.js` gained
  a matching `moduleNameMapper` as a belt-and-braces.
- **5.2 — `import/order` is not done, and cannot be without a new dependency.** It requires
  `eslint-plugin-import`, which is not installed, and **C4** forbids new dependencies without
  approval. Everything in F16 item 3 that needs no dependency *is* done: three
  `no-restricted-imports` boundary groups — no `../../`, no `api/client` outside
  `services/api/*` (F16's stated purpose: "what stops F10 from regressing"), and no direct
  AsyncStorage outside `services/storage/*`. All three were probed against a deliberate
  violation and fire. Zero violations in the existing tree.
- **5.3 — one commit, not three waves, and `noUncheckedIndexedAccess` is off.** The plan
  sequenced `noImplicitAny` → `strictNullChecks` → `strict` expecting each wave to surface
  real bugs. Measured, it does not:

  | config | errors |
  |---|---|
  | `--noImplicitAny` alone | 17 |
  | `--strictNullChecks` alone | 2 |
  | `--noImplicitAny --strictNullChecks` | **1** |
  | `--strict` | **1** |
  | `--strict --noUncheckedIndexedAccess` | 29 |

  The 17 and the 2 are artifacts of the intermediate configurations — TS7010/TS7018 on test
  harnesses whose JSX return type only resolves once `strictNullChecks` is also on. Fixing
  them would mean annotating test helpers to satisfy a config the repo never ships. So the
  waves are collapsed and the one real error is fixed: `MacroProgressBar.tsx:91` indexed a
  size map with an optional key.

  `noUncheckedIndexedAccess` was **skipped by decision.** Of its 28 errors, 4 are inside
  generated Gluestack code (2 in the live `ui/drawer`, 2 in dead `.web.tsx` files) which §8
  says never to hand-edit, and the other 24 are all provably-safe accesses — regex groups,
  `habits[0]` inside a `length > 0` guard, `s[0]` fallbacks. It would buy 24 defensive
  guards and a §8 violation and catch no bug.

- **§8's "all of `components/ui/**` is generated" is not accurate.** The generated Gluestack
  scaffold is the lowercase subdirectories. Seven hand-written app components sit at that
  folder's root — `CalorieRing`, `CircularProgress`, `MacroProgressBar`, `MacroRings`,
  `QuickAddFAB`, `SearchBar`, `StreakCounter` — and two of them were edited in this phase.
- **5.4 — 271 literals at the start, not 246**, and one is left in the tree on purpose:
  `channels.ts:121` `lightColor: '#10b981'`, the Android notification-channel LED colour.
  That is a platform channel property, not a painted surface.
- **5.4 — the sweep needed a primitive layer the plan did not anticipate.** Several
  *different* surface decisions legitimately land on the same Tailwind step (amber-600 tints
  the habit clock glyph, the daily-report insight icon and the "High" nutrient flag). Naming
  each separately while retyping `#d97706` three times is how the drift F15 describes starts,
  so there is now a private `tw` ramp of the 31 Tailwind steps in use, and the semantic
  namespaces reference it. One value, three names, one place to change it.
- **5.4 — shorthand hex was normalised** (`#fff` → `#ffffff`, `#666` → `#666666`,
  `#13961aff` → `#13961a`). Same rendered colour; the verifier normalises both sides before
  comparing, so this is checked rather than assumed.
- **5.4 — three "do not merge" pairs found and preserved,** each documented on the token:
  `foodLog.greenDeep` #0a5226 vs `brandGreen.deep` #0a4d27; `dashboard.ink` #0f172a
  (slate-900, the chrome) vs `dashboard.calendarInk` #111827 (gray-900, what
  react-native-calendars was configured with); `dashboard.inkMuted` #94a3b8 vs
  `dashboard.calendarInkMuted` #6b7280.
- **5.4 — `tokens.settings` names values it does not endorse.** Profile, Meal schedule,
  Reminder health and MealReminderSettings predate the design system and were never
  restyled. Naming their `#1a1a1a`/`#666`/`#999` ramp stops it being retyped; restyling them
  onto `auth`/`foodLog` would change pixels and is out of scope.
- **5.5 — `callTheme.ts` was three-quarters dead.** `callColors` was a one-line alias of
  `callPalette`, and `callRadius`, `callSpacing` and the `callTheme` bundle had **zero
  importers** despite the module header claiming three surfaces drew from it. Only
  `VoiceSessionScreen` ever did. The module now holds `callFontFamily` alone.
- **5.5 — `MacrosCard`/`MealGroup` were out of scope for the alias collapse.** Each declared
  its *own* local `const T` from raw hex — a third thing named `T`, unrelated to the auth
  palette — so they were handled in 5.4a, not 5.5.

**How the token work was verified, given no screenshot pass was possible here.** §6 asks for
before/after screenshots because "the token sweep is only correct if the pixels are
identical". Three mechanical checks stand in, and they are stronger than eyeballing:

1. **Per-swap validation.** The sweep is table-driven; the driver resolves each target token
   and refuses the swap unless its hex equals the literal being replaced. 205 swaps across
   the four 5.4 commits, 0 failures.
2. **Colour fingerprints.** For every changed file, the multiset of colours it references —
   hex literals, `tokens.*` paths, and local aliases/palette objects/spreads resolved — is
   compared against the previous commit. 0 differences, every commit. Probed by deliberately
   swapping `goodSoft` for `warnSoft`: it reports `#e3f5ea: 1 -> 0`. The checker found two
   holes in *itself* first (it undercounted `{...DEFAULT_COLORS}` spreads and did not follow
   palette objects whose members are token references); both were fixed and the earlier
   commits re-checked under the stricter version.
3. **Token-map diff.** Every pre-existing token path is confirmed to resolve to exactly the
   same value after each change: 172 paths, 0 changed, 0 dropped.

A device pass is still owed for the notification/call lanes (§6 item 1) — 4.1 rewrote both
voice lanes' orchestration, and no test covers it.

---

## 6. Verification Strategy

Per commit:

```bash
# backend
cd backend && ./mvnw -q test

# frontend
cd frontend && npx tsc --noEmit && npm run lint && npm test
```

`npx tsc --noEmit` matters most during Phase 5 — it is the only check that catches the class
of error that flag flips surface.

Beyond the automated suites, three things need a human pass because no test covers them:

1. **Notification/call reliability** (Phase 3.3, 4.1). Walk `docs/NOTIFICATION_TESTING.md`
   on a device: schedule → fire → accept → reschedule → miss → follow-up, for both the meal
   and habit lanes.
2. **Visual diff** (Phase 5.4/5.5). Screenshot every screen before and after each token
   commit. The token sweep is only correct if the pixels are identical.
3. **Startup config** (Phase 2.7). Boot with a full `.env` and confirm every property still
   resolves — this is precisely what task 0.3 automates, so most of it should already be green.

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Notification/call regression from the storage refactor (F11) | Med | **High** — silently missed reminders, the app's core promise | 7 existing tests run per store; one store per commit; device walkthrough before merge |
| `strict: true` surfaces genuine latent bugs (F16) | **High** | Med | Expected, not a failure. One flag per commit; fix, don't suppress. Budget for it. |
| Token sweep shifts a colour by one shade (F15) | Med | Low | Value-for-value swaps only; before/after screenshots; `tokens.ts` already documents which near-identical hues must stay distinct |
| Package move (F8) breaks Spring component scanning | Low | High | Everything stays under the scanned root package; 0.3's context-load test catches it immediately |
| `RuntimeException` → `ResponseStatusException` changes a status the app depends on (F4) | Med | Med | Grep the frontend for status-code branching first; §9 sign-off; ship behind its own commit |
| Phase 2.8 conflicts with in-flight feature work | **High** | Med | Schedule it for a quiet window; it is a single mechanical commit, so land it fast |

---

## 8. Explicit Non-Goals

Named so nobody expects them and nobody quietly does them:

- **`frontend/src/components/ui/**` (8,748 LOC).** Gluestack scaffold — generated code
  (`icon/index.tsx` alone is 1,587 lines). Regenerate, never hand-edit.
- **`frontend/android/`, `frontend/ios/`, `frontend/vendor/`, `frontend/patches/`.** Native
  and patch-package territory; out of scope.
- **NativeWind vs `StyleSheet` unification.** 50 vs 34 files. Real inconsistency, but
  converging them is a ~3,000-line diff with a per-screen visual-regression cost and no
  architectural payoff. Recommend: pick one convention for *new* code, document it, converge
  opportunistically. Not part of this plan.
- **Mongo→SQL, or any schema/data-model change.** Out of scope entirely.
- **New features, new endpoints, new screens.** Out of scope by definition (C1).
- **Dependency upgrades.** Separate exercise with its own risk profile.

---

## 9. Decisions — answered 2026-08-23

1. **Task 2.5 — `RuntimeException` → `ResponseStatusException`.** ✅ **Proceed with accurate
   4xx.** Grep evidence supporting the call: the only HTTP-status branches in `frontend/src`
   are `api/client.ts` (401) and `mealScheduleStore` (404, on a different endpoint). Nothing
   branches on the voice endpoints' 500s. See the Phase 2 deviations for what actually changed.

2. **Task 5.3 — `strict: true` rollout.** ✅ **Done, as one commit rather than three waves**
   — the intermediate flag combinations produce errors the final configuration does not have
   (see the Phase 5 deviations for the measurements). `noUncheckedIndexedAccess` is
   **skipped**: 4 of its 28 errors are in generated code §8 protects, and the other 24 are
   provably-safe accesses.

3. **Phase 2.8 — the ~100-file package move.** ✅ **Included, landed last** as the plan
   sequenced it.

4. **Sequencing.** ✅ Phases 2 and 3 were run back to back, then 4 and 5. Within Phase 5,
   5.5 was run before 5.4 so the literal sweep could write into the final token namespaces.

5. **Phase 0 — the test safety net.** ✅ **Skipped by decision**; no new test files were
   committed. The two throwaway verification harnesses described in the Phase 2 deviations
   stood in for tasks 0.1–0.3 and were discarded afterwards. Phase 0 is therefore still open.

   **This is now the largest outstanding risk in the plan.** Phases 4–5 rewrote both voice
   screens' orchestration, three auth/onboarding forms, and every colour reference in the
   app, with no render test under any of it. The token work is covered by mechanical
   equivalence checks (see the Phase 5 verification note) and the type work by `tsc`, but the
   hook extractions in 4.1 and 4.2 are covered by nothing except the compiler. If any single
   item from Phase 0 is revisited, make it 0.4 — render tests for the five screens Phases
   4–5 touched.

6. **New tests in Phases 4–5.** ⏳ Still none, per decision 5. F13 asks for the three new
   form hooks to follow `useProfileForm`'s "shape *and test style*"; they follow the shape
   only. `useVoiceMealSession` / `useVoiceHabitSession` are likewise untested.
