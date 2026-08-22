# Application Refactoring and Correctness Plan

| Field | Value |
| --- | --- |
| Status | **Stage 2 complete.** Stage A is code complete with every automated gate green, including the PostgreSQL integration tests; its exit criteria still need the physical-device and real-deployment passes. |
| Scope | React Native frontend, Spring Boot backend, native notification integration, deployability, and engineering workflows |
| Baseline commit | `b300a32` plus the uncommitted checkpoint (still uncommitted) |
| Last updated | 2026-08-23 |
| Delivery model | Correctness first, then incremental contract-preserving refactor |

## Implementation Checkpoint — 2026-08-23 (Stages A and 2 closed out)

Work resumed at the owner's request and both stages were carried to the end of what this environment can
verify. The staged working-tree checkpoint was preserved, not reset. Nothing from Stage 3 was started.

This section is the status of record. It separates *done and proven* from *done but only provable on a
real device against a real deployment*, because the two are not the same claim.

### What is now green

| Gate | Result |
| --- | --- |
| `backend/./mvnw verify` | **BUILD SUCCESS.** 51 unit tests and 9 integration tests, 0 failures, **0 skipped**, up from the 46/47 recorded at the pause. |
| PostgreSQL integration tests | **Proven locally.** Docker was installed for this purpose; `ApplicationContextIT` (4), `DatabaseMigrationIT` (3), and `PersistenceMappingIT` (2) all ran against real PostgreSQL 16.4. The Flyway `V1` → `V2` chain applies cleanly to an empty database and Hibernate's `ddl-auto=validate` accepts the result. |
| Backend coverage (JaCoCo, unit + integration) | Instructions 40.15%, branches 32.77%, lines 42.49%, methods 52.27%. Recorded in [`docs/coverage-baseline.md`](docs/coverage-baseline.md). |
| Frontend strict TypeScript | **On.** `tsconfig.json` has `"strict": true` and `npm run typecheck` is clean. Both errors were fixed outright, so no `src/components/ui` exception boundary was needed after all. |
| Frontend lint | `eslint . --max-warnings 67` — 67 warnings, 0 errors, exit 0. The count can now only go down. |
| Inline lint-suppression debt | **9** `react-hooks/exhaustive-deps` suppressions (the plan said ten; nine is the measured number). Ratcheted by `npm run lint:debt`, enumerated in [`docs/lint-debt.md`](docs/lint-debt.md). |
| Frontend tests and coverage | 36/36 pass. Statements 18.61%, branches 11.04%, functions 17.60%, lines 18.87%, with `coverageThreshold` floors set at 18/11/17/18. |
| Dependency audit | **33 findings → 0**, with no `--force` and no semver-major change. `npm run audit:ci` now gates on it. |
| Android native gate | **BUILD SUCCESSFUL** locally: `:app:testDebugUnitTest :app:lintDebug :app:assembleDebug`, against exactly the SDK/NDK versions CI pins (build-tools 36.0.0, platform android-36, NDK 27.1.12297006). |
| iOS pods | `bundle exec pod install --deployment` succeeds — `Podfile.lock` is in sync (95 dependencies, 96 pods). |
| iOS native gate | **BUILD SUCCEEDED**, 0 errors, compiling React Native from source for the simulator. One caveat: this ran under the locally installed Xcode 26.6 / iPhoneSimulator 26.5 SDK, whereas CI pins Xcode 16.4 — so the CI job is still the authoritative iOS result. |

### The backend test that was failing

The remaining 46/47 failure was not a wrong assertion. `POST /food/{date}/meals/{mealType}/entries` takes
`@RequestBody @Valid List<@Valid AddFoodEntryRequest>`, and Spring Framework 6.1+ reports container-element
constraint violations as `HandlerMethodValidationException` — a subclass of `ResponseStatusException`. The
advice therefore matched the generic `ResponseStatusException` handler and returned "The request is invalid"
instead of the documented "Request validation failed".

Fixing that exposed a larger defect the checkpoint had introduced: `@ExceptionHandler(Exception.class)`
shadows Spring MVC's own exception-to-status mapping, because `ExceptionHandlerExceptionResolver` runs
before `DefaultHandlerExceptionResolver`. A malformed date path variable, an unsupported method, and an
unsupported media type were all being reported as **500**. That contradicts Section 6.1's promise to keep
status codes compatible.

`GlobalExceptionHandler` now extends `ResponseEntityExceptionHandler` and overrides
`handleExceptionInternal`, so the framework keeps choosing the status while the class keeps owning the
`ApiError` body. Four new contract tests pin the statuses that were being swallowed: 400 for a malformed
date, 400 for malformed JSON, 405, and 415.

### The defect the integration tests found

This is the most important result of the closeout, and it is the reason the plan insisted on a
context-load test.

Once Docker was available and the Testcontainers suites actually ran, `ApplicationContextIT` failed all
four of its tests: **the Spring application context could not start at all.**

```
Error creating bean with name 'vapiClient': Failed to instantiate
[com.habitbuilder.NutritionTracker.modules.voice.VapiClient]: No default constructor found
Caused by: java.lang.NoSuchMethodException: VapiClient.<init>()
```

`VapiClient` — added by the Stage A webhook work to bind a voice session to the provider's call id — has
two constructors: a public one taking `RestTemplateBuilder` and three `@Value` properties, and a
package-private one taking a `RestOperations` for tests. Neither carried `@Autowired`, so Spring declined
to choose and fell back to looking for a no-arg constructor. The fix is the missing `@Autowired` on the
public constructor.

Three things are worth recording about this:

1. **The application could not boot.** Not a degraded path, not an edge case — every request would have
   failed. Stage A was reported as "substantially implemented" while the backend did not start.
2. **Every other gate was green while this was true.** 51 unit tests, strict TypeScript, both native
   builds, zero audit findings. None of them start a Spring context, which is exactly the gap Stage 2
   item 10 was written to close: "Today the bean graph is never exercised, so the application could fail
   to start and CI would stay green."
3. **The skip nearly hid it anyway.** `@Testcontainers(disabledWithoutDocker = true)` turns a missing
   container runtime into a *pass*. For the whole first half of this session `verify` reported BUILD
   SUCCESS with those nine tests skipped. The CI guard that rejects skips is not a nicety; without it,
   this defect ships.

A scan of every `@Component`/`@Service`/`@Repository`/`@Controller` in the backend confirmed `VapiClient`
was the only class with more than one constructor, so no sibling instance of this bug remains.

### What is still outstanding, and why it cannot be closed here

| Item | Blocker | Who can close it |
| --- | --- | --- |
| Stage A: physical Android device pass | Needs a device and a week of wall-clock: a habit set for three days firing on all three, and the daily meal reminder surviving being accepted. | Owner. |
| Stage A: release build against a real deployment | Needs a deployed backend and a hosted AI provider base URL. `babel.config.js` already refuses to build a production bundle unless `NUTRITION_API_BASE_URL` is set and HTTPS. | Owner. |
| iOS runtime behaviour | Fact X4 stands unchanged: no entitlements file, no `setNotificationCategories()`, no CallKit/PushKit. The incoming-call experience is Android-only. | Stage 6 design decision, not a Stage A regression. |
| OWASP dependency-check | Configured, but dependency-check 12 reads the NVD API, which throttles unauthenticated callers to about one request every six seconds — the first download can outrun the job's 35-minute timeout. The job now caches the database and uses `NVD_API_KEY` when present, warning and continuing when it is absent. | Owner: add the `NVD_API_KEY` repository secret (see [`docs/configuration.md`](docs/configuration.md)). |

**Stage 2's exit criteria are met.** Stage A's are not: the two rows above need a device and a
deployment. Every other item in both stages is complete and verified.

### How the 33 audit findings were cleared

No `--force`, and nothing crossed a major version.

1. `npm audit fix` under the pinned npm 10.8.2 cleared 22 findings, including both criticals.
2. The four remaining highs were `metro`/`metro-config`/`metro-transform-worker`/`image-size`.
   `image-size` has **no patched version at all** — but metro 0.83.8 drops the dependency entirely, and
   react-native 0.83.1 only asks for `^0.83.3`. An explicit `overrides` block pins the whole metro family
   to `^0.83.8`, which is tracked in the repository and so reproduces under `npm ci`.
3. The seven remaining moderates were `@react-native-community/cli*` and `fast-xml-parser`. The three CLI
   packages were pinned to exactly `20.0.0` in `devDependencies`, so `npm audit fix` could not move them;
   they are now `20.2.0`, a patch-line bump.
4. `metro-react-native-babel-preset@^0.77.0` was removed — dead weight. Nothing references it; the build
   uses `@react-native/babel-preset`.

`npm ci --dry-run` confirms `package.json` and `package-lock.json` agree. `audit-allowlist.json` is
therefore **empty**, which is the right baseline: `npm run audit:ci` fails on any unaccepted
moderate-or-higher finding *and* on a stale allowlist entry, so accepted findings cannot rot into
permanent exceptions.

### Stage A items re-verified against source

The pause note claimed all twelve Stage A items were implemented. Spot-checked rather than taken on trust:

- **C1** — `cancelDisplayedNotification` is used for dismissal; `cancelTriggerNotification` appears only in
  deliberate teardown (reconciliation, logout). `reminders.test.ts` asserts accept/decline does *not* call
  `cancelTriggerNotification`.
- **C2** — `RepeatFrequency.WEEKLY` is set per selected day in `habitScheduler.ts:167`.
- **C11** — `reconcileReminders(userId)` is called from login, foreground, and habit create/edit/delete.
- **C4, S5** — the base URL comes from `buildConfig`; the dev override, dev login, and developer settings
  route are all `__DEV__`-gated.
- **V2 migration** — statically validated against V1: `users`, `voice_meal_sessions`, and `habit_entity`
  all exist with the referenced columns, and `nutrition_cache.payload` is `jsonb` whose keys match
  `NutritionResponse`'s serialized field names exactly, so the all-zero cleanup will actually match rows.
  It has still never been executed against a real PostgreSQL — see the table above.

### Next step

Commit the checkpoint, let CI prove the PostgreSQL chain and the native jobs, then run the two owner-only
Stage A checks. Stage 3 starts only after that.

## Review Checkpoint — 2026-08-22

The previous version of this plan was reviewed line by line against the source. The method it describes is
sound — characterization tests before movement, expand/backfill/contract for schema, explicit compatibility
contracts, one architectural intent per pull request. That method is kept.

Its **premise** is not. The plan assumed current behaviour is worth preserving and that the remaining work
is structural. The review found that several of the application's headline features do not work, that one
endpoint is an unauthenticated cross-user write with the shipped default configuration, and that a release
build cannot reach a backend at all. A faithful structural refactor of that codebase produces a
well-organised application that still does not work.

### What this revision changes

1. **Stage A is inserted ahead of everything else.** It fixes the verified defects in Section 7.0. Nothing
   in it depends on the refactor, and the refactor is not worth doing before it.
2. **"Behavior-preserving refactor" becomes "contract-preserving, defect-correcting refactor."** External
   contracts in Section 6 are still preserved. Behaviour that is simply wrong is not.
3. **The Vapi webhook moves from the approval-gated backlog to Stage A.** It is not a latent weakness.
4. **Section 7.0, a verified defect register, is added** — every entry confirmed by reading the source, each
   with an explicit fix-or-accept decision.
5. **Several status claims are corrected** (below, and in Sections 5.2a and 7). A plan is the status of
   record; overstated status has a real cost.
6. **Stage 8 (product and release readiness) is added**, along with per-user timezone handling. Neither
   appeared anywhere in the previous plan.
7. **Ceremony is reduced where it was not buying anything** — see "Process calibration".

### Corrected status of the uncommitted checkpoint

| Previous claim | Corrected status |
| --- | --- |
| Phase 2 — first protected slice complete | `NutritionCalculator` (31 lines) and `FoodDtoMapper` (34 lines) came out of an 848-line `FoodService`, leaving 810 — a 4.5% reduction. Both are `new`-ed as fields (`FoodService.java:42-43`), not injected, so neither is a seam. Each has exactly one call site. The same seven-field nutrition arithmetic is still inlined three more times (`FoodService.java:286-299, 309-315, 325-332, 472-490`) and entity-to-DTO mapping twice more (`:82-88, :241-246`), none of it routed through the new classes. A warm-up, not a completed slice. |
| 31 backend tests covering food JSON contracts, authentication/ownership | The count is right; the coverage claim is not. All nine test classes are `@ExtendWith(MockitoExtension.class)`, and the controller tests use `MockMvcBuilders.standaloneSetup` with a **mocked** `FoodService`. No Spring Security filter chain runs, so nothing verifies the matcher configuration — despite Section 6.1 requiring exactly that. No test can catch a `FoodService` regression. There is no `@SpringBootTest` anywhere, so the application could fail to start and CI would stay green. |
| Repository-derived PostgreSQL baseline added | The file and its nine tables exist and CI applies them. But **`pom.xml` has no Flyway or Liquibase dependency**, so nothing runs it at application startup — while the file sits in `db/migration/`, Flyway's default auto-discovery path, labelled "do not run". Phase 0's exit criterion, "a fresh PostgreSQL instance can be created using the same baseline-plus-forward migration chain that CI will run", is unmet: there is no chain. The `ddl-auto=validate` result was a manual local action that nothing in the repository can reproduce. |
| `./mvnw verify` is a backend gate | `pom.xml` configures no Surefire, Failsafe, or JaCoCo. Surefire defaults happen to match the current `*Test` names; `*IT` tests would not run and there is no coverage signal. The CI backend job's PostgreSQL service and `SPRING_JPA_HIBERNATE_DDL_AUTO=validate` are dead configuration — no test opens a database connection. |
| Android release uses debug signing; the manifest references `${usesCleartextTraffic}` with no tracked value | The signing half is correct (`android/app/build.gradle:103`). The cleartext half is **wrong**: React Native's Gradle plugin supplies the placeholder (`AgpConfiguratorUtils.kt:39-45`) — `true` for debug, `false` for release. This matters, because release already blocks cleartext while the only configured base URL is `http://localhost:8080/`. |
| 36 npm audit findings (1 low, 13 moderate, 20 high, 2 critical) | Now 33 (1 low, 13 moderate, 17 high, 2 critical). Most are transitive build tooling. `axios` is the one **direct** dependency with a high finding and an available fix. |
| Strict TypeScript needs an incremental per-flag ratchet across Phases 4 and 7 | `npx tsc --noEmit --strict` reports **exactly 2 errors** over the identical 112-file program: one vendor file (`src/components/ui/MacroProgressBar.tsx:91`) and one test written in this same checkpoint (`src/features/api/__tests__/useApiOperation.test.tsx:100`). This is one pull request. Moved to Stage 2. |
| Lint baseline handling delivered | The delivered artefact is a one-line `.eslintignore`. `npm run lint` is `eslint .` with no `--max-warnings`, so the 67-warning baseline can grow without failing CI. Separately, `react-hooks/exhaustive-deps` is configured as an **error** but is suppressed inline at ten sites, all in the async and native screens — so the gate reports zero errors precisely where the stale-closure risk is highest. |

### Verdict on the already-implemented work

The owner has said explicitly that nothing should be preserved merely because it exists.

| Item | Verdict | Reason |
| --- | --- | --- |
| `AuthenticatedUserProvider` + Spring adapter | **Rework** | It returns the JPA `User` entity, so application code still depends on persistence. Return a typed `AuthenticatedUser(id, email)` record — that is the entire point of the boundary. |
| Injectable `Clock` (`TimeConfiguration`) | **Rework** | `Clock.systemDefaultZone()` makes the *server's* timezone every user's "today". `HabitReminderScheduler` still calls `LocalTime.now()`/`LocalDate.now()` directly, so the migration is half-done. Fold into Stage A's timezone work. |
| `NutritionCalculator`, `FoodDtoMapper` | **Keep, inject, continue** | Right direction, too small to claim a milestone, and currently unreachable as seams because they are `new`-ed. |
| `VapiWebhookSecretPolicy` | **Keep the class, reverse the rule** | `VapiWebhookSecretPolicyTest.acceptsAnyRequestWhenConfiguredSecretIsEmpty` is a passing test asserting that a vulnerability is correct behaviour. Delete that expectation; fail closed. |
| The nine backend test classes | **Rework** | Heavy mocking makes them change-detector tests that will break during the very refactor they exist to protect, while catching none of the defects in Section 7.0. Replace the controller tests with `@SpringBootTest` + `MockMvc` + a Testcontainers PostgreSQL so they exercise the real filter chain, the real service, and the real schema. |
| Frontend `shared/api` client, `sessionStore`, session events | **Keep** | Sound design, and the import cycle is genuinely gone. Add the missing tests for token injection and the 401 path. |
| `useApiOperation` | **Rework in Stage 5** | It aborts the previous request on *every* `execute`, so a hook instance shared across operations cancels its own mutations — `HabitScreen` multiplexes fetch, toggle, and delete through one instance. It has no data slot, cache, dedup, or refetch. It is a half-built server-state library; decide TanStack Query in Stage 5 rather than growing it. |
| `features/*/api` typed clients | **Keep, verify** | Hand-written and unverified: they already disagree with `docs/openapi.yaml` in at least three places, and `featureApiContracts.test.ts` mocks `apiClient` and asserts only that the wrapper called the wrapper. |
| `app/notifications/contracts.ts` | **Keep** | The best part of the checkpoint. |
| `V1__repository_derived_baseline.sql` | **Keep, but adopt a migration tool** | Useful as a fresh-database bootstrap; it is not a migration system, and its current location is a trap. It also declares zero indexes. |
| CI workflow | **Keep, strengthen** | Real gates, pinned runtimes, concurrency group, timeouts. Missing: a context-load test, coverage, a dependency-audit gate, Android SDK/NDK setup, and an iOS job. Action versions float at `@v4` while every runtime is pinned to an exact patch. |

### Process calibration

For a 3,900-line backend and 11,000 authored frontend lines, these stay: characterization tests before
moving behaviour, one architectural intent per pull request, expand/backfill/contract for schema changes,
and the compatibility contract in Section 6. They prevent the regressions this codebase is actually prone to.

These are relaxed: a formal approval gate is required only for changes that alter stored data, external
contracts, or production security posture — not for internal restructuring. Decision records are required
only for Section 14. The four-layer `api/application/domain/infrastructure` split is required only where a
feature has real content in each layer; `dashboard` (34 lines) and `auth` stay flat.

### Resume order

This original review order has been worked through. Steps 1 and 3 are done — the checkpoint was preserved,
and the Stage 2 frontend/audit gates are closed. Step 2 is done for everything except the physical-device
and real-deployment passes, which need hardware and a deployment. Section 15 carries the remaining work.

## 1. Objective

Refactor the Nutrition Tracker application into a clean, maintainable, scalable codebase while preserving its current behavior and external contracts.

The refactor must improve:

- separation of concerns;
- module boundaries and dependency direction;
- readability and discoverability;
- type safety and boundary validation;
- testability and automated verification;
- reuse of shared behavior without creating generic abstractions prematurely;
- resilience around external AI, voice, storage, and notification integrations;
- configuration, security, logging, and operational visibility.

This is an incremental migration, not a rewrite. Each phase must be independently reviewable, testable, releasable, and reversible.

## 2. Success Criteria

Criterion 0 is new and takes precedence. A codebase can satisfy criteria 1 to 14 and still be an application
that does not work; the previous version of this plan had no criterion that would have caught that.

0. **The application does what it advertises.** On a real device against a real deployment: a habit set to
   repeat on chosen days fires on all of them, week after week; the daily meal reminder survives being
   answered; food logging returns real nutrition or a visible failure; and a release build reaches the
   backend. Every entry in Section 7.0 marked "Stage A" is closed with a test.

The refactor is successful when all of the following are also true:

1. Existing user journeys pass the agreed functional smoke-test matrix on Android and iOS.
2. Existing REST routes, authentication requirements, response fields, status codes, database records, navigation routes, notification payloads, and persisted mobile keys remain compatible, **except for the deliberate changes listed in Section 6.0**.
3. Backend feature code follows an enforced dependency direction: `api -> application -> domain <- infrastructure`.
4. Controllers and screens are thin coordinators; business rules live in testable application/domain units.
5. External systems are accessed through explicit ports/adapters rather than directly from feature logic.
6. Frontend screens do not call Axios, AsyncStorage, Notifee, or the voice SDK directly when a feature/shared adapter owns that responsibility.
7. Backend application services do not obtain the current user directly from `SecurityContextHolder`.
8. API request and response types have one canonical definition per boundary and are validated.
9. TypeScript `strict` is on for authored application code. Generated/vendor UI code may remain under an explicit exception boundary.
10. CI runs backend verification **against a real PostgreSQL with a Spring context**, frontend linting/type-checking/tests, contract tests, a dependency audit, and relevant native build checks — and would fail if the application could not start.
11. Logs do not contain passwords, JWTs, raw AI payloads, or raw voice transcripts.
12. Architecture and quality rules prevent the main forms of coupling from returning.
13. Production failures are observable: crash reporting on the client, health and readiness endpoints and enrichment metrics on the backend.
14. The accuracy of the nutrition estimates is a measured number, not an assumption.

## 3. Scope and Non-Goals

### In scope

- Backend package and responsibility restructuring.
- Frontend feature-based organization.
- Extraction of application services, domain rules, adapters, mappers, hooks, and coordinators.
- Characterization, unit, integration, contract, and mobile workflow tests.
- Typed configuration and API boundaries.
- Controlled database migration support.
- Architectural seams and non-breaking security/reliability improvements required to make the code safe to maintain.
- Removal of confirmed dead code after compatibility checks.
- Documentation and CI improvements.
- **Correcting the verified defects in Section 7.0**, including the ones that require changing observable
  behaviour, because the current behaviour is wrong rather than merely undocumented.
- **Making the application deployable**: a real API base URL per build configuration, a reachable AI
  provider, and release-build hygiene.
- **Product and release readiness** (Stage 8): account deletion, crash reporting, an error boundary,
  offline behaviour, health endpoints, and store-submission requirements.

### Not in scope without separate approval

- Product or visual redesign.
- New product features beyond the ones the application already advertises and fails to deliver.
- Renaming public endpoints, JSON fields, navigation route names, or persistence keys.
- Changing nutrition formulas, daily goals, insight rules, or supported nutrients.
- Replacing the **voice** provider. Replacing the AI provider is **in scope** — see defect C4: the current
  one is `http://127.0.0.1:<port>`, which cannot be deployed, so freezing it freezes the product.
- Moving reminder ownership from the device to the server, or the reverse.
- Destructive database normalization or deletion of existing records.
- A broad dependency/framework upgrade performed together with structural refactoring.
- Rewriting generated Gluestack UI primitives under `frontend/src/components/ui`.
- Secure-token storage, data-retention deletion, and other behavior-altering hardening, without separate approval and rollout planning. **Amended:** fail-closed webhook authentication and removing developer shortcuts from release builds are **no longer** in this list — they moved to Stage A, because the current behaviour is a live vulnerability rather than a design choice (S1, S5).

Behavior defects discovered during refactoring must first be captured with a passing characterization test, documented, and approved. The approved fix should then add a failing regression expectation before implementation. Defects must not be silently corrected inside a structural change.

**Carve-out:** the defects in Section 7.0 have already been through this process — documented, evidenced, and their disposition decided. They do not need a second approval round. This paragraph governs *newly discovered* defects from here on.

## 4. Guiding Principles

1. **Preserve contracts; correct defects.** Create characterization tests before moving code — but a
   characterization test is a record of what the code does, not an argument that it should keep doing it.
   Where Section 7.0 says a behaviour is wrong, pin it with a test so the change is visible in the diff,
   then change it. The external contracts in Section 6 are what must survive the refactor; the bugs are not.
2. **Refactor by vertical slice.** Move one use case at a time through controller/screen, application logic, domain logic, and infrastructure.
3. **Keep changes small.** Do not mix package moves, dependency upgrades, schema changes, and behavior changes in the same pull request.
4. **Depend on stable abstractions at volatile boundaries.** AI, Vapi, notifications, storage, time, authentication, and caching must sit behind narrow interfaces.
5. **Prefer explicit code over speculative frameworks.** Introduce a pattern only when it removes an observed source of coupling or duplication.
6. **Keep domain rules framework-light.** Pure calculations, policies, parsers, and state transitions should be executable without Spring or React Native.
7. **Keep compatibility at the edge.** Stable API DTOs and mobile adapters may translate between the current external shape and improved internal models.
8. **Make failure states visible.** Async work, external calls, and caches require defined timeout, retry, idempotency, and observability policies.
9. **Use one source of truth.** API types, nutrition goals, route definitions, notification payloads, and status values should not be independently redefined in multiple places.
10. **Ratchet quality.** New and changed code must meet stronger rules without requiring a risky one-time cleanup of the whole repository.

## 5. Current-State Baseline

### 5.1 Technology inventory

| Area | Current stack |
| --- | --- |
| Mobile | React Native 0.83.1, React 19.2, TypeScript declared as `^5.8.3` and resolved to 5.9.3 in the lockfile, React Navigation |
| Mobile UI | NativeWind and Gluestack UI |
| Mobile integrations | Axios, AsyncStorage, Notifee, Vapi, Daily/WebRTC |
| Backend | Java release target 17, Spring Boot 3.4.2, Maven Wrapper; the observed local Maven runtime uses JDK 21.0.10 |
| Backend libraries | Spring MVC, WebFlux client, JPA, Validation, Security, JWT, Lombok |
| Database | PostgreSQL-specific mappings and queries, including arrays and JSONB |
| External services | OpenAI-compatible Copilot bridge and Vapi |

### 5.2 Verification baseline at commit `b300a32`, before the uncommitted checkpoint

The rows below are the pre-checkpoint state, kept for traceability. For the state as of 2026-08-22 read Section 5.2a instead — the checkpoint added tests, CI, a schema baseline, a configuration template, and a `typecheck` script, so several rows here are no longer current.

| Check | Observed result |
| --- | --- |
| `cd backend && ./mvnw test` | Build succeeds and compiles 52 Java sources; no backend tests exist |
| `cd frontend && npm test -- --runInBand` | Cannot run before dependencies are installed; `jest` is unavailable |
| `cd frontend && npm run lint` | Cannot run before dependencies are installed; `eslint` is unavailable |
| Frontend type-check | No script exists; TypeScript is unavailable before `npm ci` |
| Frontend tests | One application render smoke test |
| CI | No tracked CI workflow |
| Database migrations | No tracked migration tool or migration files |
| Runtime configuration | No tracked non-secret Spring configuration template |
| Android release | Release currently uses the debug signing config (`android/app/build.gradle:103`). Cleartext traffic is **already correct**: React Native's Gradle plugin supplies `usesCleartextTraffic` as `true` for debug and `false` for release. |

The first implementation step must run `npm ci` in `frontend/`, establish a reproducible baseline, and record all pre-existing failures. A refactoring pull request must not hide a baseline failure by weakening a check.

### 5.2a Verification baseline (measured 2026-08-22, updated 2026-08-23 at Stage A/2 closeout)

| Item | Measured state |
| --- | --- |
| Strict TypeScript cost | ~~2 errors~~ **Closed.** `strict` is on; both errors were fixed (`MacroProgressBar.tsx:91` guarded the optional index; the `useApiOperation` test captures signals in an array instead of a `let` the compiler narrows to `never`). No exception boundary was needed. |
| Dependency vulnerabilities | ~~33 npm findings~~ **0 findings.** Cleared without `--force` and without a major bump (see the Implementation Checkpoint). Gated by `npm run audit:ci` with an empty, self-expiring allowlist; OWASP dependency-check runs under the `dependency-audit` profile; Dependabot is configured. |
| Migration tooling | **Flyway adopted and proven.** `flyway-core` and `flyway-database-postgresql` are in `pom.xml`, with `V1` as the real baseline and `V2` carrying the Stage A backfills and constraints. `DatabaseMigrationIT` applies the `V1` → `V2` chain to an empty PostgreSQL 16.4 on every run. |
| Test infrastructure | **Present and exercised.** `ApplicationContextIT`, `DatabaseMigrationIT`, and `PersistenceMappingIT` run against Testcontainers PostgreSQL; Surefire, Failsafe, and JaCoCo are configured. `@testing-library/react-native` is installed, so Stage 5's screen tests are now achievable. Caveat worth remembering: these ITs **skip rather than fail** without a container runtime, which is why CI rejects skips. |
| Coverage | **Measured and baselined** in [`docs/coverage-baseline.md`](docs/coverage-baseline.md). Backend (unit + integration): 42.49% lines. Frontend: 18.87% lines, with `coverageThreshold` floors enforced. CI runs `npm run test:coverage` and uploads both reports. |
| Local reproducibility | **Pinned.** `.nvmrc` (20.19.4), `.ruby-version` (4.0.5), and `.tool-versions` (java temurin-17.0.19+7, nodejs 20.19.4, ruby 4.0.5) are tracked, matching the CI `env` block. |
| Transaction boundaries | The application has **no** `@Transactional` outside `NutritionEnrichmentService` and works only because `spring.jpa.open-in-view` defaults to `true` and is never set. See fact X1 in Section 7.0. |
| Observability | None. No Actuator dependency, no health or readiness endpoint, no metrics, no tracing, no crash reporting on the client. |
| Deployment | None. The `Dockerfile` was deleted in `b300a32`; there is no compose file, deploy workflow, artifact publication, or `CHANGELOG`. The app is at `versionCode 1` / `versionName "1.0"`. |

### 5.3 Current architecture

The repository is a full-stack modular monolith:

- `frontend/` contains a React Native application organized mainly around global `screens`, `components`, `services`, and `context` folders.
- `backend/` contains a Spring Boot application organized loosely by feature under `modules`, with inconsistent internal layering.
- The backend exposes authentication, profile, dashboard, food log, nutrition report, habit, and voice endpoints.
- Nutrition enrichment and several insights are produced through an external LLM bridge.
- Vapi and Notifee support voice logging, habit calls, and device reminders.

### 5.4 Main data flows

1. **Manual food logging**
   - Mobile submits a food entry.
   - `FoodController` delegates to `FoodService`.
   - `FoodLog` and `FoodEntry` are persisted.
   - `NutritionEnrichmentService` asynchronously checks `NutritionCache`, calls the AI bridge when needed, parses nutrition data, and updates `NutritionDetails`.
   - Daily log queries join entries and nutrition details and aggregate totals.

2. **Voice meal logging**
   - The mobile Vapi flow captures a transcript and posts it to the backend, or Vapi calls the public webhook.
   - `VoiceLogService` records a session, asks the LLM to extract meals, calls `FoodService` for each entry, and triggers nutrition enrichment.

3. **Habit tracking**
   - `Habit` stores the recurring definition.
   - `HabitEntity` stores per-day completion/reschedule state.
   - The mobile app schedules actual local notifications.
   - The backend scheduler currently polls and logs due reminders but does not deliver them.

4. **Dashboard and reports**
   - `FoodService` calculates daily/weekly totals, nutrient trends, RDI goals, preferences, sources, cache-backed AI insights, and fallbacks.
   - `DashboardService` composes food and habit queries.

5. **Authentication**
   - `AuthContext` owns session state and profile operations.
   - JWT is persisted under the `token` AsyncStorage key.
   - The Axios interceptor reads storage, injects the bearer token, and invokes a global logout callback on HTTP 401.

## 6. Compatibility and Preservation Contract

Before implementation begins, the following behavior must be converted into executable contract or characterization tests for the slice being changed.

**Read this section together with Section 6.0.** Everything below is preserved *except* what Section 6.0
lists. A characterization test records what the code does; it is not an argument that the code should keep
doing it. Where Section 7.0 identifies a defect, the test exists to make the change visible in the diff.

### 6.0 Explicitly not preserved

Stage A changes these deliberately. Each is a defect in Section 7.0, not a contract.

| Behaviour | Becomes | Ref |
| --- | --- | --- |
| The webhook accepts any request when no secret is configured | Fails closed; refuses to start unconfigured outside local | S1 |
| The webhook trusts `call.metadata.userId` as identity | Checks the claim against the session the token was minted for | S1 |
| Accepting or declining a call cancels the pending recurring trigger | Cancels only the displayed notification | C1 |
| Habit reminders fire once and ignore `repeatDays` | Repeat weekly on each selected day, reconciled on foreground | C2 |
| Reminders survive logout and fire for the wrong user | Cancelled on logout, re-armed per user, `userId` in the payload | C11 |
| "Today" is the server's today | Resolved from the user's stored timezone | C7 |
| An unparseable AI response is a successful all-zero enrichment, cached forever | A failure; nothing is cached | C6 |
| Expired tokens produce 403 | 401, so the client's logout path fires | C8 |
| Blank names and negative quantities are accepted | Rejected with 400, using the constraints already declared in the DTO | C9 |
| Enrichment state is invisible to clients | `enrichmentStatus` is an additive response field | C10 |
| Internal exception messages are returned in 500 bodies | A single error model with no leaked messages; 409 on registration conflict | S3, S4 |
| The developer login and settings screen ship in release | `__DEV__`-gated | S5 |
| Duplicate habit completion rows are possible | Unique on `(habit_id, user_id, entry_date)` | R8 |
| Navigating away mid-call discards the voice session | The transcript is posted before teardown | C12 |
| `GET /dashboard` returns a placeholder string | Deleted — zero production callers | X8 |

Note the interaction with Section 6.3: the notification payload gains a `userId` field. Every existing
field, channel ID, notification ID, action ID, and storage key is unchanged.

### 6.1 REST API contract

These routes and their current request/response behavior must remain stable during structural refactoring:

| Feature | Routes |
| --- | --- |
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Profile | `GET /profile`, `PUT /profile` |
| Dashboard | ~~`GET /dashboard`~~ (deleted — see X8), `GET /dashboard/{date}` |
| Food log | `POST /food/{date}/meals/{mealType}/entries`, `GET /food/{date}`, `GET /food?from=&to=`, `PUT /food/{date}/meals/entries/{id}`, `DELETE /food/{date}/meals/entries/{id}` |
| Nutrition | `GET /food/nutrition/weekly?startDate=&endDate=`, `GET /food/nutrition/all?startDate=&endDate=`, `GET /food/nutrition/insights?startDate=&endDate=` |
| Preferences | `POST /food/nutrient/{nutrientId}/pin`, `PUT /food/nutrient/{nutrientId}/target`, `PUT /food/nutrient/{nutrientId}/avoid`, `GET /food/nutrient/preferences` |
| Habits | `POST /habit`, `GET /habit/today`, `POST /habit/{id}/toggle`, `DELETE /habit/{id}`, `POST /habit/voice-result` |
| Voice | `POST /food/voice-log`, `GET /food/voice/token`, `POST /food/voice-log/parse-transcript` |

Contract tests must cover:

- authentication versus public access;
- response field names and nullability;
- status codes and current error bodies;
- date/time and numeric serialization;
- ownership and cross-user isolation;
- empty-log and missing-data behavior;
- partial async enrichment states;
- webhook acknowledgement semantics.

The current Spring Security rule permits `/auth/**`, the exact `/food/voice-log` path, and `/error`. `GET /auth/me` then checks for an authenticated `User` inside the controller. `/food/voice/token` and `/food/voice-log/parse-transcript` remain authenticated despite sharing the `/food` prefix. Contract tests must prevent the public webhook exception from widening accidentally.

High-risk response fixtures must explicitly capture:

- ~~`GET /dashboard` returns a plain string~~ (route deleted — X8), while `GET /dashboard/{date}` returns the JSON dashboard summary;
- habit creation returns the current `Habit` JSON shape, while toggle and delete return an empty HTTP 200 response;
- a webhook with a valid configured shared secret returns `{"result":"logged"}` even when the message is ignored or application processing fails, while a missing/wrong configured secret returns an empty 401;
- `GET /food/{date}` returns `MealsResponse`, with a meal-keyed map whose items use string `quantity` and `servingSize`;
- `GET /food?from=&to=` returns an array of day logs whose meals are arrays and whose entries use numeric `quantity`, `unit`, and `mealType`;
- food POST returns a list of `FoodEntryResponse`, whereas food PUT/DELETE return the full daily `MealsResponse`.

These food shapes are intentionally incompatible at present. Compatibility mappers must not accidentally collapse them while DTOs are reorganized.

The public API can receive a consistent error model internally, but an externally visible error-shape change requires versioning or explicit approval — **except the changes Section 6.0 lists** (no leaked exception messages; 409 on registration conflict; 401 rather than 403 for unauthenticated requests), which are approved defect fixes.

### 6.2 User journeys

- Register, log in, restore a session, receive automatic logout on 401, log out, and update a profile.
- View the date-based dashboard.
- Add, view, edit, and delete food entries across breakfast, lunch, snack, and dinner.
- Observe current enrichment behavior without blocking food creation: POST returns `nutritionResponse: "Nutrition enrichment in progress"`. **Amended (C10):** Stage A adds an `enrichmentStatus` field, so completion is reported rather than inferred, and failure becomes distinguishable from a genuine zero. The `nutritionResponse` string is unchanged.
- View weekly nutrition totals, averages, trends, top food sources, goals, and insights.
- Pin nutrients, set custom targets, and save avoided foods.
- Create, list, complete/uncomplete, delete, voice-complete, and reschedule habits.
- Configure meal reminders and receive meal/habit incoming-call notifications.
- Accept or decline notifications while the app is foregrounded, backgrounded, or cold-started.
- Complete meal and habit voice sessions, including same-day follow-up scheduling.
- Change the development API base URL where that feature is permitted.

### 6.3 Persistent mobile contracts

The following identifiers must not be renamed without a migration that reads the old value and writes the new value:

- AsyncStorage keys: `token`, `custom_base_url`, `meal_schedule_v2`.
- Notification channels: `meal-call-v2`, `habit-call-v1`, `habit-push-v1`.
- Notification IDs: `meal-alarm-daily`, `meal-reschedule-once`, `habit-{id}`, `habit-reschedule-{id}`.
- Notification payload fields such as `screen`, `mealSlotId`, `habitId`, `habitName`, `habitTime`, `reminderType`, `isRescheduled`, and `delayMinutes`.
- Navigation route names and parameters declared by the root, tab, auth, and food navigators, including the derived `autoStart`/`autoAccept` behavior after notification actions.
- Notification action IDs `default`, `accept`, and `decline`; full-screen action IDs `meal-fullscreen` and `habit-fullscreen`; and iOS meal category `meal-call`.
- The value stored under `meal_schedule_v2`, currently shaped as `{ hour, minute, enabled }`.

### 6.4 Database contract

- Preserve all current tables, columns, IDs, constraints, and records until a forward-compatible migration is deployed.
- Preserve the uniqueness of one food log per user/date and one nutrient preference per user/nutrient.
- Preserve current nutrition-enrichment state and raw audit/session records unless a separately approved retention migration is introduced.
- Do not rely on automatic schema recreation as a migration strategy.
- Introduce migrations through expand -> backfill -> dual-compatible code -> constraint -> cleanup steps.
- Capturing the real deployed schema requires database access and an identified owner. If that access is unavailable, start with a repository-derived schema baseline, mark its assumptions, and reconcile it with a real environment before any production migration.
- Do not enable automatic baselining for arbitrary non-empty schemas. Apply a baseline marker only after the schema fingerprint, orphan/duplicate preflight checks, migration metadata/checksum, backup, and restore procedure are approved for that environment.

### 6.5 External integration contract

- AI requests continue to use an **OpenAI-compatible interface**. The *host* changes in Stage A: the current
  `http://127.0.0.1:<port>` bridge cannot be deployed (C5). The request and response shapes are preserved.
- Nutrition parsing, RDI fallback, insights fallback, and cache behavior remain compatible until separately changed.
- Vapi voice flows, token behavior, webhook acknowledgement, transcript parsing, and session persistence remain compatible.
- Native foreground/background/killed-app handling must remain registered at the lifecycle point required by Notifee.
- The AI provider envelope remains `choices[0].message.content`; nutrition payload keys remain `calories`, `proteinG`, `carbsG`, `fatsG`, `fiberG`, `sugarG`, and `sodiumMg`.
- Vapi webhook meal processing continues to recognize the `submit_meal_log` function name.
- Habit voice data continues to translate the frontend's snake_case structured result into the backend endpoint's camelCase request fields.
- The persisted nutrition-cache key continues to use lowercased/trimmed food name and unit plus quantity formatted to two decimal places, hashed with SHA-256, until a cache-identity migration is approved. **Amended:** the formatting must be made locale-independent (R10) — today the same food hashes differently under a different default locale, so the "stable key" this line promises is not actually stable.

## 7. Prioritized Findings

### 7.0 Verified defect register

Every entry below was confirmed by reading the cited source. The **Decision** column is the default this
plan adopts. These are defects, not "inconsistencies to characterize" — Section 7.4 keeps that softer
category for behaviour that is merely undocumented or debatable.

#### D-SEC — Security

| # | Defect | Evidence | Decision |
| --- | --- | --- | --- |
| S1 | **Unauthenticated cross-user write.** `POST /food/voice-log` is `permitAll`. The secret policy accepts *every* request when the configured secret is empty, and empty is the shipped default (`vapi.webhook-secret=${VAPI_WEBHOOK_SECRET:}`). The target user is then read from the request body: `Long.parseLong(callMetadata.get("userId"))`. Any internet caller can write food entries and stored transcripts into any account by incrementing a `Long`. | `SecurityConfig.java:44`; `VapiWebhookSecretPolicy:14-18`; `VoiceLogService.java:133-141`; `application.example.properties` | **Stage A.** Fail closed. |
| S2 | The same endpoint is an unauthenticated amplifier for paid AI calls: the `meals` map is unbounded, every entry reaches the `@Async` enrichment path, and there is no body-size limit or rate limit. | `VoiceLogService.java:82-90`; `NutritionEnrichmentService.java:46` | **Stage A**, with S1. |
| S3 | Internal exception messages are returned to clients in 500 bodies, including "User not found". | `ProfileController.java:46-49, 78-81`; `AuthController.java:39-42, 55-58` | **Stage A.** |
| S4 | Registration conflict surfaces as `RuntimeException` → 500 rather than 409. `AuthRequest` carries no constraints and `AuthController` has no `@Valid`, so there is no email-format or password-strength validation. | `AuthService.java:27`; `AuthRequest.java:5-12`; `AuthController.java:34` | **Stage A.** |
| S5 | Dev login backdoor ships in release builds: `dev@gmail.com` / `123456` opens the screen that rewrites the API base URL. | `LoginScreen.tsx:91` | **Stage A** — gate on `__DEV__`. |
| S6 | Vapi public key and assistant IDs are hardcoded in two screens. Billable. The backend token endpoint that exists as the alternative is implemented, contract-tested, and never called. | `VoiceHabitScreen.tsx:14-15`; `VoiceMealLogScreen.tsx:15-16`; `voiceApi.ts:18` | **Stage A** for the config move; decide the integration path in Section 14. |
| S7 | CORS allows all origins, all headers, and all methods on every path. No credentials are sent, so this is not urgent, but it is unmentioned in the previous plan. | `SecurityConfig.java:57-64` | Stage 3. |
| S8 | Raw provider payloads are logged at INFO on every call and persisted verbatim into two uncapped `TEXT` columns. This directly contradicts the current Definition of Done. | `GeminiService.java:71, 116, 203, 207`; `NutritionEnrichmentService.java:79` | Stage 4. |
| S9 | No JWT revocation and no account-state re-check. Logout clears only the client copy; a 24-hour token stays valid, and `User.isEnabled()` is never consulted by the filter. | `JwtTokenProvider.java:26-30`; `JwtAuthenticationFilter.java:64-72` | Accept for now; record in Section 14. |
| S10 | A development database password is in git history and reachable from the published branch `origin/feature/dashboard`. No JWT or Vapi keys are exposed. | `git show 8ed39f1:backend/src/main/resources/application.properties` | Rotate if that database was ever shared; otherwise accept and note. |

#### D-FN — The application does not do what it advertises

These are the reason Stage A exists.

| # | Defect | Evidence | Decision |
| --- | --- | --- | --- |
| C1 | **Accepting or declining a meal call permanently destroys the recurring daily reminder.** `stopRinging()` calls `notifee.cancelNotification('meal-alarm-daily')`, and Notifee's `cancelNotification` cancels the *pending trigger* as well as the displayed notification. The correct call is `cancelDisplayedNotification`. The same pattern is in the background and foreground handlers. | `IncomingMealCallScreen.tsx:165-166`; `App.tsx:84, 87, 161, 167`; `IncomingHabitCallScreen.tsx:159-160` | **Stage A.** |
| C2 | **Habit reminders are one-shot.** `scheduleHabitReminder` builds a `TimestampTrigger` with no `repeatFrequency` (contrast `mealScheduler.ts:86`, which sets `RepeatFrequency.DAILY`). `repeatDays` is collected in the UI, sent to the backend, and stored — and never read by the scheduler. The only caller is habit creation; nothing re-arms on app open. | `habitScheduler.ts:60-80`; sole caller `HabitCreationScreen.tsx:162` | **Stage A.** |
| C3 | Together, C1 and C2 mean **every reminder in the product fires at most once.** This is the application's core loop. | — | **Stage A.** |
| C4 | **A release build cannot reach a backend.** `DEFAULT_BASE_URL` is `http://localhost:8080/` on both platforms — the `Platform.OS` ternary has two identical branches — and release blocks cleartext. The only escape is the dev backdoor in S5. | `shared/api/client.ts:13-16` | **Stage A.** |
| C5 | **The AI provider is a localhost process.** The bridge URL is `"http://127.0.0.1:" + port + "/v1/chat/completions"`, default port 4141. | `GeminiService.java:35` | **Stage A.** Remove from non-goals; make the base URL configurable and point it at a hosted provider. |
| C6 | **An unparseable AI response is recorded as a successful enrichment with all seven nutrients set to zero — and that zero payload is written into the shared, permanent, cross-user nutrition cache.** `getBigDecimal` returns `BigDecimal.ZERO` for any missing, null, or non-numeric field, `extractJson` returns the input unchanged when it finds no braces, and the enrichment is then marked `completed`. Every future user who logs the same food gets zeros forever. | `GeminiService.java:257-263 (getBigDecimal)`, `:245-255 (extractJson)`; `NutritionEnrichmentService.java:100-106, 140-150` | **Stage A** — the product's central number is being silently poisoned. |
| C7 | Every user's "today" is the *server's* today. The `Clock` bean is `systemDefaultZone()`; habit listing and voice food logging derive dates from it. No per-user timezone is stored anywhere, and the schema mixes `timestamptz` and naive `timestamp` for the same conceptual instant. | `TimeConfiguration.java:12`; `HabitService.java:81`; `VoiceLogService.java:163`; `V1:11,17,24` vs `V1:37,94,106-107` | **Stage A.** |
| C8 | An expired or malformed token produces **403, not 401**. The JWT filter swallows the exception and continues; the chain configures no `AuthenticationEntryPoint`, so Spring Security's default `Http403ForbiddenEntryPoint` applies. The client logs out only on 401, so the app never recovers — it sits authenticated-looking and failing every request. | `JwtAuthenticationFilter.java:76-79`; `SecurityConfig.java:41-46`; `shared/api/client.ts:43-46` | **Stage A.** Pin current behaviour with a test first. |
| C9 | Validation on the main write path is declared but never enforced: `AddFoodEntryRequest` carries `@NotBlank`/`@Positive`, but `addEntries` takes `@RequestBody List<AddFoodEntryRequest>` with no `@Valid` (which is imported and used on the update endpoint two methods below). Blank names and negative quantities are accepted today and reach the AI prompt. `@NotNull` on a primitive `double` is a no-op. | `FoodController.java:41-46, 159-170` | **Stage A.** |
| C10 | Enrichment status is persisted but never exposed, so clients poll and infer completion from nutrient fields appearing — and cannot distinguish "still working" from "failed" from "genuinely zero". | `NutritionDetails.java:52`; absent from `FoodItemResponse` | **Stage A** — additive field; removes a whole class of confusing UI. |
| C11 | Reminders are not scoped to a user and logout cancels nothing. After an account switch the previous user's reminders still fire, and accepting one drives an authenticated write under the new user's token. Notification payloads carry no user identifier. | `AuthContext.tsx:40-43`; `habitScheduler.ts:95-101` | **Stage A.** |
| C12 | Navigating away from a voice screen mid-call discards the entire session. Cleanup calls `removeAllListeners()` before `stop()`, so the `call-end` handler — the only path that parses the transcript and posts it — never runs. | `VoiceMealLogScreen.tsx:186-194`; same structure in `VoiceHabitScreen.tsx` | **Stage A.** |
| C13 | `PUT /food/{date}/meals/entries/{id}` returns **stale nutrition** for the food just edited: it saves, fires async enrichment, then synchronously re-reads the day through the still-open persistence context. | `FoodService.java:189-194` | Stage 4 (needs C10's status field first). |
| C14 | A transient AI failure pins a user to default RDI goals for the JVM's lifetime. `fetchRdiGoals` returns an empty immutable map on any exception, and `computeIfAbsent` caches it — non-null, so it is never recomputed. | `FoodService.java:392, 544-547` | Stage 4. |
| C15 | Habit completion is always written against *today* regardless of the date being viewed. The dashboard reads habits for an arbitrary date, but `toggleHabit` and `processVoiceResult` unconditionally target `LocalDate.now(clock)`. | `DashboardService.java:26`; `HabitService.java:127, 147` | Stage 4. |
| C16 | Enrichment retry is a dead end: failures below the cap set status back to `"pending"`, but nothing ever re-runs them. | `NutritionEnrichmentService.java:152-162` | Stage 4. |
| C17 | `parseReminderTime` silently substitutes 08:00 for any time string it cannot parse. | `habitScheduler.ts:43-46` | Stage 6. |
| C18 | Reschedule follow-ups are silently dropped when they would cross midnight — precisely when late meal logging happens. | `mealScheduler.ts:171-179`; `habitScheduler.ts:164-170` | Stage 6. |
| C19 | Avoided foods round-trip through a comma-joined string, so any food name containing a comma is split into multiple entries on read. | `FoodService.java:642, 655-657` | Stage 7. |
| C20 | `HabitScreen` renders `width: "NaN%"` for a user with no habits. | `HabitScreen.tsx:131` | Stage 5. |

#### D-CONC — Concurrency, resource, and data-integrity defects

| # | Defect | Evidence | Decision |
| --- | --- | --- | --- |
| R1 | The blocking, un-timed AI call is made **inside** the enrichment transaction, so every in-flight enrichment holds a JDBC connection for the full duration of the provider call. A slow provider exhausts the connection pool. | `NutritionEnrichmentService.java:47, 62, 77` | Stage 4 (high). |
| R2 | A managed JPA entity is passed across the thread boundary and mutated by the async worker while the request thread still reads the same instance; `save()` on the detached snapshot can resurrect a concurrently deleted entry or silently revert a concurrent edit. | `FoodService.java:77-89`; `NutritionEnrichmentService.java:46-62` | Stage 4. Pass an ID, not an entity. |
| R3 | `NutritionDetails` has no `@Version` and enrichment is not idempotent, so two enrichments for the same entry lose one another's writes. | `NutritionDetails.java:21-69`; `NutritionEnrichmentService.java:118-127` | Stage 4. |
| R4 | A concurrent duplicate-hash cache insert raises `DataIntegrityViolationException`, which escapes the narrow `JsonProcessingException` catch and marks the enrichment **failed** even though the data was fetched successfully. | `NutritionEnrichmentService.java:140-150` | Stage 4. |
| R5 | `rdiCache` is a plain `HashMap` mutated through `computeIfAbsent` from concurrent request threads, and is never invalidated when the profile it derives from changes. | `FoodService.java:346, 392` | Stage 4. |
| R6 | `insightsCache` is never evicted, only TTL-checked on read, and is keyed partly on caller-supplied dates — a trivial memory-exhaustion lever for any authenticated user. | `FoodService.java:31, 674, 743` | Stage 4. |
| R7 | `getOrCreateFoodLog` is an unsynchronised check-then-insert against a unique constraint, with no transaction and no upsert. Two concurrent posts for the same user and date return 500. | `FoodService.java:227-235` | Stage 4. |
| R8 | Concurrent habit toggles create duplicate `habit_entity` rows — the table has no unique constraint on `(habit_id, user_id, entry_date)` — and the read method returns `Optional`, so that habit's listing then fails permanently. | `HabitService.java:125, 143-164`; `HabitEntityRepository.java:11`; `V1:32-42` | **Stage A** for the constraint (it is data-corrupting); Stage 4 for the transaction. |
| R9 | Deleting a habit orphans its completion history forever, and deleting a user orphans food logs and nutrient preferences: none of those relationships has a foreign key. | `HabitService.java:178`; `V1:116-130` (four FKs, none covering these) | Stage 7. |
| R10 | The nutrition cache key and the nutrition prompt both use `String.format("%.2f", …)` with no `Locale`, so the same food hashes differently — and is prompted differently — across environments with different default locales. | `NutritionEnrichmentService.java:165`; `GeminiService.java:162-184` | Stage 4. |
| R11 | The V1 baseline declares **zero indexes**, including on `food_entries.food_log_id` and the habit lookup triple. Every join and scheduler query is a sequential scan from day one. | `V1:1-130`; no `@Index` anywhere | Stage 7, pulled forward if data volume grows. |
| R12 | The transcript-parsing path reports success while logging zero meals whenever the provider envelope cannot be unwrapped: `extractContentFromLLMResponse` falls through to returning the raw envelope, and `extractJson` then grabs the envelope's braces. | `VoiceLogService.java:243-273` | Stage 4. |

#### D-FE — Frontend data-layer defects

| # | Defect | Evidence | Decision |
| --- | --- | --- | --- |
| F1 | One `AbortController` is shared across unrelated operations, so a hook instance used for more than one thing cancels its own **mutations**. `HabitScreen` multiplexes fetch, toggle, and delete through a single `useApiOperation`. | `useApiOperation.ts:18`; `HabitScreen.tsx:34, 40, 72` | Stage 5, with the server-state decision. |
| F2 | `FoodLogScreen` issues two identical `GET /food/{date}` requests on every mount, one of which immediately aborts the other. | `FoodLogScreen.tsx:84-92` | Stage 5. |
| F3 | `NutritionReportScreen`'s insights spinner is cleared by a superseded request — its `finally` is unguarded, unlike `useApiOperation`'s. | `NutritionReportScreen.tsx:139-141` | Stage 5. |
| F4 | `AllNutritionsCard` discards optimistic pin state whenever the user opens a nutrient drawer. | `AllNutritionsCard.tsx:240-252` | Stage 5. |
| F5 | The 18-second enrichment polling loop in `VoiceMealLogScreen` has no abort signal, unmount guard, or cleanup; it keeps fetching and calling `setState` after the screen is gone. | `VoiceMealLogScreen.tsx:274-327` | Stage 5 (C10 removes the need for polling entirely). |
| F6 | Cold-start notification handling contains an unbounded, uncancellable `setTimeout` retry loop that can also navigate to routes that do not exist for an unauthenticated user. | `App.tsx:136-143` | Stage 6. |
| F7 | Two navigators register a route named `VoiceMealLog` with incompatible param types, and `FoodLogScreen` hand-copies a param list to dodge a circular import. | `FoodStackNavigator.tsx:10` vs `AppNavigator.tsx:28` | Stage 5. |
| F8 | No error boundary anywhere: a render-time throw blanks the app. Eleven of fifteen screens report failures only to the console. | no `componentDidCatch`/`getDerivedStateFromError` in `frontend/src`; `App.tsx:173-181` | Stage 8. |
| F9 | Dead code the checkpoint left behind: `hooks/useApi.tsx` (87 lines, zero importers), `services/authService.ts` (compat shim, zero importers), `ensureHabitChannels` (declared, never called). | grep: no importers | Stage 5. |

#### Structural facts the plan must account for

| # | Fact | Evidence | Consequence |
| --- | --- | --- | --- |
| X1 | **The application has no transaction boundaries.** One `@Transactional` exists, on `NutritionEnrichmentService`. Everything else works only because `spring.jpa.open-in-view` defaults to `true` and is never set: mapping and ownership checks traverse lazy associations outside any transaction. | `grep -rn "@Transactional" backend/src/main/java`; `FoodDtoMapper:16`; `FoodService.java:175` | Any layering change that disables OSIV breaks the read path. Stage 4 must add explicit boundaries **before** turning OSIV off, and CI must pin the setting so it cannot flip silently. |
| X2 | Batch writes are genuinely non-atomic: `addFoodEntries` saves inside a loop with no surrounding transaction, so a failure at item *k* leaves 1..*k*-1 committed and returns 500 with no rollback. The voice path does the same deliberately, and additionally records the session as `FAILED` next to the rows that did commit, then returns HTTP 200 `{"result":"logged"}`. | `FoodService.java:69-91`; `VoiceLogService.java:78, 97-102`; `VoiceLogController.java:65-71` | Section 6 currently promises to preserve this. Decide it as a product question in Section 14, not as a compatibility default. |
| X3 | `HabitEntity.habitId` and `userId` are `varchar` while `Habit.id` and `User.id` are `Long`. No foreign keys, no unique constraint, no index. | `HabitEntity.java:26-30`; `V1:32-42` | Typed IDs and foreign keys move from the end of Stage 7 to immediately after Stage 4a; the unique constraint moves to Stage A (see R8). |
| X4 | **iOS has no entitlements file at all**, so `interruptionLevel: 'timeSensitive'` is inert. `UIBackgroundModes` is `remote-notification` only — no `audio`, so a Vapi call dies when the app backgrounds; and no `voip`. There is no CallKit, PushKit, or callkeep. The iOS notification category `meal-call` is referenced but `setNotificationCategories()` is never called, so **iOS notifications have no Accept/Decline buttons**, and habit notifications set no category at all. | `frontend/ios` (no `.entitlements`); `Info.plist:55-58`; `mealScheduler.ts:141`; no `setNotificationCategories` in the repo | The "incoming call" experience is Android-only in practice. Stage 6 must state the intended iOS design rather than assume parity. |
| X5 | `USE_EXACT_ALARM` is declared. Google Play restricts it to apps whose core function is an alarm clock or calendar. Separately, Android 14+ does not auto-grant `USE_FULL_SCREEN_INTENT` outside the calling and alarm categories, and the app never checks whether it has it. Notifee's native code logs to `System.err` and returns without scheduling when `canScheduleExactAlarms()` is false, while `createTriggerNotification()` still resolves successfully — so exact-alarm failure is silent and unobservable. | `AndroidManifest.xml:9-10, 15`; `mealScheduler.ts:113-116` | Stage 6 must add a permission-state check and a visible degraded state. Stage 8 decides the `USE_EXACT_ALARM` submission risk. |
| X6 | Nothing re-arms reminders after app update (package replace), force-stop, or data clear. Notifee's merged manifest handles `BOOT_COMPLETED` but registers no `MY_PACKAGE_REPLACED`. Android alarms also do not follow timezone changes, and the persisted schedule stores a bare wall-clock hour and minute with no zone. | merged manifest receivers; `mealScheduler.ts` storage shape | Stage A's reconciliation-on-foreground covers most of this; Stage 6 adds the rest. |
| X7 | `IncomingMealCallScreen` and `IncomingHabitCallScreen` are **~89% identical** after normalising meal/habit naming (52 differing lines of ~480). `VoiceMealLogScreen` and `VoiceHabitScreen` are only **~21%** identical (339 differing lines of ~430). | `diff` after token normalisation | Consolidate the incoming-call screens — high payoff, low risk. Do **not** force the two voice screens into one abstraction; share only the Vapi lifecycle hook. This revises Stage 6's assumption of symmetric duplication. |
| X8 | `GET /dashboard` is a placeholder returning `"Hello User, welcome to your dashboard!"`. It has zero production callers — the only frontend reference is an unused typed client method exercised solely by a contract test written in this same checkpoint. | `modules/dashboard/controller/Dashboard.java`; `dashboardApi.ts:5-8`; `featureApiContracts.test.ts:39` | Delete it and its client method. No deprecation cycle is warranted for a route nothing calls. |
| X9 | The two report endpoints disagree on trend length: `getAllNutrientsSummary` zero-fills every day in the range, while `getWeeklyNutritionReport` emits only days that have logs. | `FoodService.java:361-365, 406-408` vs the weekly path | Pin both with fixtures in Stage 2; choose one in Stage 4. |
| X10 | `.gitignore` ignores the bare filename `application.properties`, so no non-secret Spring defaults file can ever be committed without `-f`. | `.gitignore:89` | Fix in Stage 2. |

### 7.1 Priority 0 (superseded)

The table below was the previous plan's Priority 0. Section 7.0 supersedes it; it is kept for traceability.

| Finding | Evidence | Required response |
| --- | --- | --- |
| No backend regression suite | Maven compiles but reports no tests | Add endpoint, service, persistence, security, and integration characterization tests |
| Minimal frontend coverage | Only `App.test.tsx` exists | Add feature-service, hook, notification-routing, voice, and critical screen tests |
| No schema history | No migration files or tracked runtime resource directory | Capture the deployed schema and introduce a migration baseline |
| No reproducible CI | No workflow and frontend dependencies are not installed locally | Add deterministic install/build/test commands and CI |
| Public webhook can fail open | `X-Vapi-Secret` is compared only when a secret is configured; an unset secret accepts the request | Characterize both configured and unset behavior, then separately approve a provider-compatible hardening rollout |
| Release/dev boundaries are weak | A development login shortcut, hard-coded Vapi public/assistant identifiers, and arbitrary base URL behavior exist in app code; Android release uses debug signing | Isolate these behind build/runtime configuration and treat production enforcement as separately approved release hardening |

*(Superseded.)* The previous plan concluded here that "security changes that alter external behavior must use a rollout plan, but they should be scheduled before broad architectural cleanup." The second half is right and is now Stage A. The first half does not apply to S1: there is no legitimate traffic that a fail-closed webhook would reject, because the secret is simply unset.

### 7.2 Backend hotspots

1. `FoodService.java` is 810 lines (848 before the checkpoint) and owns unrelated responsibilities: authentication lookup, commands, queries, mapping, aggregation, RDI generation, AI prompts/parsing, preferences, caches, and fallbacks.
2. `FoodController.java` contains numerous package-private request/response classes, making API contracts hard to find, reuse, validate, and test.
3. Authentication lookup is repeated through `SecurityContextHolder` in services and controllers.
4. Error handling mixes controller `try/catch`, `RuntimeException`, `ResponseStatusException`, null returns, and exposed exception messages.
5. `GeminiService` repeats HTTP request code and has a provider-specific/misleading name even though it calls an OpenAI-compatible Copilot bridge.
6. JSON extraction and AI response parsing are duplicated across food, nutrition, and voice code.
7. Async enrichment is fire-and-forget, uses no explicit bounded executor, has no durable retry worker, and can leave unclear partial-failure states.
8. Cache policies are implicit and inconsistent: successful insights live 60 minutes, fallback insights 10 minutes, the non-thread-safe RDI `HashMap` lasts for the JVM lifetime, and the database nutrition cache has no expiry.
9. Cross-feature code depends on concrete services and persistence entities rather than narrow use-case interfaces.
10. Domain concepts are represented inconsistently as strings: meal types, statuses, age, completion time, reminder type, habit/user IDs, and avoided-food collections.
11. Habit listing performs a per-habit completion lookup, creating an N+1 query pattern.
12. Time is read directly from the system in services and schedulers, complicating tests and timezone behavior.
13. `modules/dashboard/controller/Dashboard.java` is a placeholder. **Verified (X8):** it does not collide with `DashboardController` — the paths are distinct — and it has zero production callers. Delete it.

### 7.3 Frontend hotspots

1. Large authored files combine state, data fetching, business rules, orchestration, and rendering, including `AllNutritionsCard.tsx`, `HabitCreationScreen.tsx`, `NutritionDetailDrawer.tsx`, and the voice/incoming-call screens.
2. API access is inconsistent. **Amended:** `hooks/useApi.tsx` now has zero importers (F9) and should be deleted; the live inconsistency is between `useApiOperation` and direct `apiClient` calls.
3. ~~`api/client.js` and `authService.js` remain JavaScript~~ **Resolved by the checkpoint.** Both are now TypeScript. `services/authService.ts` is a compatibility shim with zero importers and should be deleted (F9).
4. `AuthContext` owns transport, persistence, session coordination, profile mutations, and UI state; a mutable global logout callback breaks an import cycle.
5. Meal and habit voice screens duplicate Vapi lifecycle, microphone, transcript, delay parsing, status, and cleanup behavior.
6. Incoming meal and habit call screens duplicate animation, vibration, accept/decline, timer, and navigation behavior.
7. Notification logic is distributed across `App.tsx`, schedulers, bootstrap code, and screens; channel creation and route mapping are repeated.
8. Navigation uses `any` casts despite declared route types.
9. TypeScript has `strict: false`, `allowJs: true`, and several overlapping transport/domain/view types.
10. Date formatting based on `toISOString().split('T')[0]` can shift a user's local date.
11. Meal scheduling and onboarding screens duplicate scheduling/form behavior.
12. Generated Gluestack primitives are large but are not the highest-value refactoring target; they should be isolated as a vendor boundary.

### 7.4 Inconsistencies to characterize, not silently change

- The backend advertises more nutrient metadata than the persisted nutrition model and enrichment response currently populate.
- Nutrition target defaults and fallback rules are duplicated and differ between frontend and backend.
- The frontend contains configured Vapi identifiers while the backend also exposes a voice-token endpoint; the intended integration path is unclear. (Partly superseded: S6 moves the identifiers to configuration in Stage A; the *integration path* remains open in Section 14.)
- Weekly averages currently use days containing logs rather than necessarily every day in the selected range.
- Partial manual/voice batch commits are observable behaviors. (Enrichment polling and duplicate initial loads are superseded — C10 exposes a status field and F2/F5 remove the polling.)
- The public webhook intentionally returns HTTP 200 for application-processing failures to prevent provider retries, but there is no durable failure queue.

Each item requires a decision record and explicit acceptance criteria before its behavior changes. **Items superseded by Section 7.0 are exempt** — their disposition is already decided there. In particular, the habit repeat-day model (C2/C3) and the fail-open webhook (S1) were previously listed here as "characterize, do not change"; both are now Stage A fixes.

## 8. Target Architecture

### 8.1 Architectural style

Use a **modular monolith** with feature ownership and selective ports/adapters. Use clean boundaries around real seams without turning every class into a framework.

Backend dependency direction within a feature:

```text
api/controller + api/dto
          |
          v
application/use-cases -----> application ports
          |                         ^
          v                         |
       domain <------------- infrastructure adapters
```

Frontend dependency direction within a feature:

```text
screen -> feature hook/controller -> feature service/API -> shared adapters
   |              |
   v              v
presentational UI + pure model/policies
```

Cross-feature calls should use a small public application interface, not another feature's repository, controller DTO, or concrete implementation service.

### 8.2 Target backend structure

```text
backend/src/main/java/com/habitbuilder/NutritionTracker/
  common/
    config/
    error/
    security/
    time/
    observability/
  modules/
    auth/
      api/
      application/
      domain/
      infrastructure/
    food/
      api/
      application/
      domain/
      infrastructure/
    nutrition/
      api/
      application/
      domain/
      infrastructure/
    habit/
      api/
      application/
      domain/
      infrastructure/
    voice/
      api/
      application/
      domain/
      infrastructure/
    dashboard/
      api/
      application/
```

This is a vocabulary for the target dependency shape, not a mandate that every feature contain all four folders or one class per layer. Create a layer/package only when that feature has a real responsibility there; a composition-only dashboard can remain much simpler. Existing JPA entities can initially remain framework-aware behind repository/application boundaries.

**Proportionality (added by the review).** This is a 3,900-line backend. Concretely: `food` and `nutrition`
earn the full split — `FoodService` is 810 lines with thirteen public methods spanning commands, queries,
reporting, preferences, AI prompting, and caching, and that is the real seam. `voice` earns three layers.
`habit` earns two plus a policy class. `auth` and `dashboard` (34 lines) stay flat; creating four packages
around a composition facade adds indirection and buys nothing. If a package would contain one class that
only forwards, do not create it. Section 4's principle 5 already says this; it is restated here because the
diagram above reads as a mandate.

**A note on the abstraction that already exists.** `AuthenticatedUserProvider` currently returns the JPA
`User` entity, so application code still depends on persistence — the boundary exists in form but not in
effect. That is the failure mode this section is guarding against, and it is worth checking each new port
against it: does the caller now depend on less than it did before?

The initial food/nutrition ownership rule is:

- food owns `FoodLog`, `FoodEntry`, and food commands;
- food publishes entry-change events and exposes a narrow read interface;
- nutrition owns enrichment details, nutrient preferences, nutrition calculations/reports, provider integration, and nutrition caches;
- nutrition consumes food events/read interfaces and must not mutate food repositories directly after the seam is established.

During migration, existing bidirectional JPA references may remain inside infrastructure adapters, but they must not become application-layer dependencies. Likewise, habit application code should use a typed user identifier rather than depending on the auth `User` entity; the current entity association can be contained in persistence until a safe schema migration is approved.

### 8.3 Backend responsibility split

#### Food and nutrition

Extract `FoodService` one use case at a time into:

- `FoodLogCommandService`: add, update, and delete entries while initially preserving current per-save/partial-write transaction behavior.
- `FoodLogQueryService`: daily/range reads and compatibility responses.
- `NutritionReportService`: weekly totals, averages, trends, sources, and flags.
- `NutrientPreferenceService`: pin, custom-target, and avoided-food operations.
- `NutritionInsightService`: insight prompts, fallback policy, and cache coordination.
- `NutritionCalculator`: pure total/average/percentage calculations. **Exists** — inject it rather than `new`-ing it, and route the three remaining inline copies of the same arithmetic through it.
- `FoodDtoMapper` and `NutritionDtoMapper`: entity/domain-to-contract mapping. `FoodDtoMapper` **exists** — same treatment, plus the two remaining hand-rolled mappings.
- `MealType`, `NutrientId`, and enrichment status types internally, with compatibility mapping at the API edge.

#### Authentication and errors

- **Rework** `AuthenticatedUserProvider`: it exists but returns the JPA `User` entity, so application code still depends on persistence. Return a typed principal.
- Keep Spring Security mechanics inside `common/security` and auth infrastructure.
- Introduce domain/application exceptions with a single `@RestControllerAdvice`.
- Preserve current external error responses through a compatibility mapper until an API version change is approved.
- Add validation to all request DTOs, list elements, date ranges, enums, lengths, and numeric ranges.

#### AI integration

Define a provider-neutral `AiCompletionClient` port with one HTTP adapter. Build typed task services above it:

- `NutritionEstimator`;
- `MealTranscriptExtractor`;
- `RdiAdvisor`;
- `NutritionInsightGenerator`.

Each task owns its prompt and typed parser. The HTTP adapter owns authentication, base URL, model, timeout, retry classification, response-size limits, and redacted logging. JSON extraction should have one tested implementation.

#### Async enrichment

- Publish a post-commit `FoodEntryChanged` event after an entry is created or edited.
- Process enrichment idempotently through an application handler.
- Configure a named bounded executor initially; evaluate a durable job/outbox separately when multi-instance or guaranteed retry behavior is required.
- Define state transitions such as pending -> in progress -> completed/failed and test retries/races.
- Make cache writes idempotent and handle concurrent insert conflicts.

#### Voice

- `VoiceWebhookService`: validate, acknowledge, and enqueue provider events.
- `VoiceSessionService`: session lifecycle and audit state.
- `MealTranscriptExtractor`: typed transcript-to-meal conversion.
- Backend `VapiClient`: the REST adapter used to obtain the token/call response for `/food/voice/token`, with explicit timeouts. The main live-call lifecycle remains in the frontend Vapi SDK adapter.
- `VoiceMealLogUseCase`: orchestrate validated meal logging through the food command interface.

#### Habits and dashboard

- Split definition management from daily completion state.
- Introduce pure `HabitSchedulePolicy` and `HabitCompletionPolicy` classes.
- Inject `Clock` and an explicit timezone policy.
- Batch-load daily completion states rather than querying once per habit.
- Keep `DashboardQueryFacade` as a thin composition of public food and habit query interfaces.

### 8.4 Target frontend structure

```text
frontend/src/
  app/
    App.tsx
    bootstrap/
    navigation/
    providers/
    notifications/
  features/
    auth/
      api/
      hooks/
      model/
      screens/
      components/
    food-log/
      api/
      hooks/
      model/
      screens/
      components/
    nutrition-report/
      api/
      hooks/
      model/
      screens/
      components/
    habits/
      api/
      hooks/
      model/
      screens/
      components/
    voice/
      adapters/
      hooks/
      model/
      screens/
      components/
    reminders/
      adapters/
      model/
  shared/
    api/
    config/
    date-time/
    errors/
    storage/
    ui/
    utils/
```

Existing generated UI primitives can remain in their current path initially, exposed through `shared/ui` exports or a stable alias. Moving generated files has low priority.

### 8.5 Frontend responsibility split

#### API and server state

- ~~Convert the Axios client and auth service to TypeScript~~ — done in the checkpoint.
- Keep Axios configuration, token injection, base URL selection, and error normalization in `shared/api`.
- Create typed feature clients: `authApi`, `profileApi`, `foodApi`, `nutritionApi`, `habitApi`, and `voiceApi`.
- Expose data through feature hooks; screens must not contain URL literals.
- Replace deprecated cancellation behavior with `AbortController`/Axios signal support.
- Start with typed services and hooks using existing dependencies. Record an ADR before adding a server-state library; if adopted, migrate one feature at a time.
- Derive transport types from a checked-in OpenAPI contract or verify handwritten types against it.

#### Session management

- Separate `SessionStore`, `AuthRepository`, and `SessionCoordinator` responsibilities.
- Replace the mutable global logout callback with an explicit unauthorized/session event owned by the application provider layer.
- Keep `AuthContext` focused on exposing session state and actions to React.
- Plan a backward-compatible token migration if platform secure storage is adopted.

#### Screens and components

- Screens compose feature hooks and presentational sections.
- Presentational components receive data/callbacks and do not fetch, persist, navigate globally, or call native SDKs.
- Extract forms, validation policies, date-range selection, and mapping logic from large render files.
- Keep domain values, API DTOs, and view models distinct where their shapes differ.

#### Voice and notifications

- Create a shared `useVoiceSession` hook/state machine for permission, connection, transcript, speaking, completion, error, and cleanup states.
- Supply meal and habit behavior through typed task strategies rather than duplicate screens.
- Create one configurable incoming-call presentation with meal/habit content strategies.
- Introduce a discriminated `NotificationPayload` union and one parser/route resolver.
- Move foreground, background, and cold-start navigation into a notification coordinator while keeping background registration at the required top level.
- Centralize channel definitions and notification builders; preserve all existing IDs and payload fields.
- Wrap Notifee and Vapi behind adapters so feature behavior can be tested without native modules.

#### Date and time

- Add local-calendar-date helpers that do not convert through UTC unintentionally.
- Centralize parsing/formatting for reminder times and API dates.
- Inject/fake current time in schedulers and tests.

### 8.6 Patterns to use deliberately

| Pattern | Use in this application |
| --- | --- |
| Modular monolith | Enforce feature ownership without deploying separate services |
| Ports and adapters | Isolate AI, Vapi, notification, storage, cache, clock, and authenticated-user boundaries |
| Lightweight CQRS | Separate food mutations from complex reporting queries without introducing a messaging framework |
| Mapper | Preserve API DTOs while internal models improve |
| Strategy | Share voice, incoming-call, notification, and parsing flows with meal/habit-specific behavior |
| Facade | Compose dashboard data through narrow feature interfaces |
| State machine | Make voice/enrichment/notification lifecycle transitions explicit and testable |
| Domain event; optional outbox | Decouple post-commit enrichment, adding an outbox only when durability requirements justify it |
| Repository | Keep persistence queries behind feature-owned interfaces |
| Dependency injection | Make authentication, time, external clients, and caches replaceable in tests |

Patterns not justified by a current seam should not be added merely for uniformity.

## 9. Migration Roadmap

The stages below replace the previous eight-phase numbering. Stage A is new. Stages 2 through 9 map onto
the previous Phases 0 through 7 with the amendments noted in each.

| Stage | Was | Theme | Gate before starting |
| --- | --- | --- | --- |
| A | *new* | Make it correct and safe | none — start here |
| 2 | Phase 0 | Make it verifiable | Stage A's fixes exist (they can be tested as part of Stage 2) |
| 3 | Phase 1 | Cross-cutting boundaries | Stage 2 gates are green |
| 4a | Phase 2 | Backend use-case decomposition | Stage 3 |
| 4b | Phase 3 | External isolation, async and cache correctness | Stage 3 (may overlap 4a) |
| 5 | Phase 4 | Frontend feature boundaries and server state | Stage 2 (independent of backend stages) |
| 6 | Phase 5 | Voice, notification, and reminder orchestration | Stage A's reminder fixes are shipped and verified on device |
| 7 | Phase 6 | Domain and database model | Stage 4 |
| 8 | *new* | Product and release readiness | can run in parallel from Stage 5 onward |
| 9 | Phase 7 | Quality and performance ratchets | last |

There is no Stage 1: the numbering is deliberately offset so that Stage *n* maps to the previous Phase *n*-1, keeping old references readable. Where a Section 7.0 entry says "Stage 4" without a letter, it means 4b unless it is a pure decomposition item.

Stages 4 and 5 are independent and can run concurrently. Stage 8 has items that should start early
(crash reporting, error boundary) and items that gate a store submission.

### Stage A: Make the application correct and safe

**Implementation status (2026-08-23): CODE COMPLETE, EXIT CRITERIA NOT YET MET.** All twelve items below
are implemented and covered by tests, and every automated gate is green — 51 unit plus 9 integration tests
against real PostgreSQL. One Stage A defect was found during closeout and fixed: `VapiClient`'s ambiguous
constructor prevented the Spring context from starting at all (see the Implementation Checkpoint). The stage
still cannot be signed off, because its exit criteria require a physical-device pass and a release build
against a real deployment — neither is possible in the implementation environment.

This stage exists because the previous plan's premise — that current behaviour is worth preserving — does
not hold for Section 7.0. Everything here is small, none of it depends on the refactor, and the refactor is
not worth doing first.

**Order matters within this stage**, and it is the same order as Section 15:
S1 (live vulnerability) → C4 and C5 (nothing else can be validated end to end until the app can reach a real
backend and a real provider) → C1, C2, C3 (the core loop) → C6 (stop poisoning the cache) → the rest.

#### Changes

1. **Fail-closed webhook** (S1, S2). Refuse to start when `vapi.webhook-secret` is unset outside the local
   profile. Constant-time comparison. Cap the request body and the number of meals per call. Replace the
   fail-open test expectation with a fail-closed one. If Vapi supports request signing, prefer it and keep
   the shared secret as fallback. Treat `call.metadata.userId` as a claim to be checked against the session
   the token was minted for, not as an identity.
2. **Deployable configuration** (C4, C5). A real API base URL per build configuration. A configurable,
   hosted AI provider base URL. Keep the developer override, gated on `__DEV__`.
3. **Reminders that actually recur** (C1, C2, C3, C11).
   - Replace every `cancelNotification` on a trigger ID with `cancelDisplayedNotification`.
   - Give habit reminders a weekly-repeating trigger per selected day, so `repeatDays` means something.
   - Add a single `reconcileReminders()` that reads the user's habits and meal schedule and rebuilds the
     full pending-notification set. Call it on app foreground, after habit create/edit/delete, and after
     login. This also covers app update, force-stop, and data clear (X6).
   - Cancel everything on logout and re-arm for the new user; stamp `userId` into notification payloads and
     ignore a payload whose user is not the current one.
   - Disable the backend `HabitReminderScheduler`, which delivers nothing and runs two queries a minute.
4. **Per-user timezone** (C7). Add `timezone` to the user profile, defaulting to the device IANA zone at
   registration. Resolve "today" from it in habit listing and voice logging.
5. **Stop poisoning the nutrition cache** (C6). Treat a response that yields no numeric nutrients as a
   *failure*, not a zero-valued success. Never cache a failed or all-zero parse. Distinguish "the model
   said zero" from "we could not parse a number". Add a one-off cleanup for cache rows that are all zero.
6. **401 for unauthenticated requests** (C8). Add an `AuthenticationEntryPoint` returning 401 and an
   `AccessDeniedHandler` returning 403. Pin the current 403 behaviour with a test first so the change is
   visible in the diff.
7. **Enforce the validation that is already declared** (C9). `@Valid` on the food batch endpoint with
   element-level cascading; drop the meaningless `@NotNull` on the primitive; add constraints and `@Valid`
   to `AuthRequest`.
8. **One error model** (S3, S4). A single `@RestControllerAdvice`. No exception messages in responses.
   Registration conflict returns 409.
9. **Expose enrichment status** (C10). Add `enrichmentStatus` to the food item response as an additive
   field. Existing clients ignore it; the app can then show "estimating…", "couldn't estimate", and a retry
   affordance instead of a silent zero — and Stage 5 can delete the polling loop (F5).
10. **Uniqueness on habit completion** (R8). Add the unique constraint on
    `(habit_id, user_id, entry_date)` after de-duplicating existing rows. This one is in Stage A rather than
    Stage 7 because it is actively corrupting data.
11. **Release hygiene** (S5, S6). `__DEV__`-gate the developer login and settings route; move Vapi
    identifiers to build configuration.
12. **Keep the voice session alive** (C12). Stop the call before removing listeners, and await the
    transcript post, so navigating away does not silently discard the session.

#### Required verification

- A contract test proves the webhook rejects an unsigned request, and that startup fails when the secret is
  absent outside the local profile.
- A test over a faked clock proves `reconcileReminders()` produces the right pending set for a habit
  repeating on three days, and that accept/decline leaves the recurring trigger intact.
- One end-to-end pass on a physical Android device: a habit set for three days fires on all three across a
  week, and the daily meal reminder survives being accepted.
- A test proves an expired token produces 401 and that the client interceptor logs out.
- A test proves a blank name and a negative quantity are rejected with 400.
- A test proves an unparseable AI response leaves the entry in a failed state and writes nothing to the
  cache.
- A release build reaches a real backend from a physical device.

#### Exit criteria

Every Section 7.0 entry marked "Stage A" is closed with a test. The application's advertised core loop —
log food, get nutrition, get reminded, complete a habit — works on a real device against a real deployment.

#### Rollback

Each item is independently revertible. The reminder work (item 3) is the only one that touches persisted
device state; ship it behind a reconciliation that is safe to run repeatedly, so a rollback simply stops
rebuilding rather than leaving a half-armed set.

### Stage 2 (was Phase 0): Freeze contracts and make builds verifiable

**Implementation status (2026-08-23): COMPLETE.** Items 1 to 19 are all implemented and every piece of
required verification has run. Strict TypeScript is on, the lint warning cap and inline-suppression ratchet
are in place, coverage is configured and baselined on both sides, the dependency audit is at zero findings
behind a gate, both native gates pass locally against the versions CI pins, and `./mvnw verify` runs 51 unit
and 9 integration tests with zero skips against real PostgreSQL 16.4 — which is how the `VapiClient`
startup defect was caught. See the Implementation Checkpoint above.

#### Changes

Items 1 to 8 carry over from the previous Phase 0. Items 9 to 19 close the gaps the review found: Phase 0
was marked "locally complete" while most of what makes a gate a gate was absent.

1. Install frontend dependencies with `npm ci` and record current lint, type, test, Android, and iOS results.
2. ~~Add a `typecheck` script~~ — it exists (`package.json:12`). **What remains: turn `strict` on**, which is still `false` in `tsconfig.json:11`. It costs 2 errors (see the Review
   Checkpoint), so the per-flag ratchet the previous plan spread across Phases 4 and 7 is unnecessary.
   Keep an explicit exception boundary for `src/components/ui` if the vendor error is not worth fixing.
3. Inventory every route and begin an OpenAPI description/golden fixture set; require executable fixtures for each affected slice before that slice moves.
4. Produce a repository-derived PostgreSQL schema baseline. If an authoritative deployed database is available, obtain an owner-approved schema dump/fingerprint and reconcile it before creating any production baseline marker.
5. Add tracked non-secret configuration templates and document required environment variables. **Amended:**
   remove the bare `application.properties` entry from `.gitignore` (X10), which currently makes a tracked
   non-secret defaults file impossible.
6. Add backend tests for API shape/security and frontend tests for critical coordinators.
7. Add CI with deterministic Node, Java, Maven, and npm versions.
8. Record current behavior for all inconsistencies in Section 7.4.
9. **Adopt a migration tool.** Add Flyway to `pom.xml` and make `V1` the real baseline, or move the file out
   of `db/migration/` so it stops sitting in Flyway's auto-discovery path while documented as inert. Without
   this there is no migration chain, and the exit criterion inherited from Phase 0 cannot be met.
10. **Add a context-load test.** One `@SpringBootTest` with non-secret test properties. Today the bean graph
    is never exercised, so the application could fail to start and CI would stay green.
11. **Add Testcontainers PostgreSQL and one `@DataJpaTest`-style mapping test** so the entities are validated
    against `V1` on every run. The CI job's PostgreSQL service and `SPRING_JPA_HIBERNATE_DDL_AUTO=validate`
    are currently dead configuration — nothing opens a connection.
12. **Configure Surefire, Failsafe, and JaCoCo** so `./mvnw verify` runs unit and `*IT` tests and reports
    coverage. Configure Jest coverage. Report first, ratchet later — but a baseline number must exist.
13. **Replace the mock-heavy controller tests** with `@SpringBootTest` + `MockMvc` so the real filter chain
    runs and Section 6.1's "contract tests must prevent the public webhook exception from widening
    accidentally" is actually true.
14. **Add `@testing-library/react-native`.** The screen tests this plan calls for are not achievable with
    `react-test-renderer` alone.
15. **Add a dependency gate**: `npm audit` and OWASP dependency-check in CI with an allowlist for accepted
    findings, plus Dependabot or Renovate. Pin GitHub Actions to commit SHAs — every runtime is pinned to an
    exact patch while the actions themselves float at `@v4`.
16. **Add `--max-warnings` to the lint script** at the current baseline of 67 so it can only go down, and
    convert the ten inline `react-hooks/exhaustive-deps` suppressions into tracked debt. The rule is
    configured as an error and is disabled exactly where the stale-closure risk is highest.
17. **Pin `spring.jpa.open-in-view` explicitly** (see X1) so the setting the whole read path depends on
    cannot flip silently.
18. **Add local toolchain pins**: `.nvmrc`, `.tool-versions` or `.sdkmanrc`, and an exact Ruby version, so
    local builds are as reproducible as CI.
19. **Add Android SDK/NDK setup to the Android CI job**, which currently assumes the runner already has the
    exact pinned NDK and accepted licenses.

#### Required verification

- Backend `./mvnw verify` is green **and actually runs tests against a real PostgreSQL**, including a
  context-load test and an entity-versus-`V1` mapping check.
- Frontend lint, type-check (strict), and test commands run reproducibly, with coverage reported.
- The full route inventory exists, and executable contract snapshots cover the first slice to be moved.
- A fresh PostgreSQL instance can be created using the same baseline-plus-forward migration chain that CI will run.
- When an authoritative existing schema is available, preflight checks and a backup/restore rehearsal show it can receive only the approved baseline marker and forward migrations without replaying schema creation or losing data.
- A test proves the security matcher configuration: `/food/voice-log` is the only public route outside `/auth/**` and `/error`, and it does not widen.

#### Exit criteria

The build/test/migration harness and smoke baseline must exist before structural movement. Each vertical slice additionally requires characterization of its affected auth, ownership, API, persistence, and mobile behavior before that slice moves; unrelated features do not block the first protected slice.

#### Rollback

This stage is additive. CI/reporting checks can initially be non-blocking while failures are classified; contract fixtures and schema snapshots must not be removed.

### Stage 3 (was Phase 1): Standardize cross-cutting boundaries

#### Required refactoring changes

1. Add typed configuration properties for database, JWT, CORS, AI bridge, Vapi, executor, and cache settings.
2. Document environment profiles and required configuration; surface missing settings clearly without changing production acceptance rules inside an unrelated refactor.
3. ~~Characterize the optional `X-Vapi-Secret` behavior~~ **Moved to Stage A, fail-closed.** What remains
   here is replay and idempotency protection.
4. ~~Place development login helpers behind a build-time boundary~~ **Moved to Stage A.** What remains is the
   approved-host policy for release builds.
5. Replace backend `System.out`, stack traces, raw provider payload logs, and unnecessary mobile health/voice debug logs with structured, redacted logging and correlation IDs. **Amended:** this includes
   `GeminiService.java:71, 116, 203, 207` (S8), which the previous checkpoint's "touched paths" never reached.
6. ~~Add `AuthenticatedUserProvider`, injectable `Clock`, filter-chain 401/403 handlers, and global error mapping~~
   **Moved to Stage A.** What remains here: make `AuthenticatedUserProvider` return a typed
   `AuthenticatedUser(id, email)` rather than the JPA `User` entity, and finish the `Clock` migration into
   `HabitReminderScheduler` and the remaining `LocalDate.now()` call sites.
7. Inventory current invalid-input behavior. **Amended:** the previous wording — "add validation only where
   valid requests remain compatible and any invalid-request status/body change is separately approved" — is
   too cautious for cases like C9, where the constraints are already declared in the DTO and simply not
   wired up. Where the code already states the intent, enforcing it is a bug fix. Reserve the approval gate
   for validation that is genuinely new.
8. Add production CORS allowlists (S7).

#### Approval-gated security and release backlog

The following work can change behavior, requires external credentials or provider support, or affects
release operations. It does not gate Stage 4's internal decomposition.

**Moved to Stage A** (no longer approval-gated, because the current behaviour is a live vulnerability or a
shipping blocker rather than a design choice): fail-closed webhook authentication; release exclusion of
developer shortcuts; a reachable production API base URL.

1. Define durable webhook acceptance semantics, replay/idempotency protection, and per-caller rate limits.
2. Narrow public auth matchers from `/auth/**` to explicit login/register routes and move `/auth/me` to framework-enforced authentication.
3. Add JWT key-strength/rotation rules, auth throttling, and comprehensive malformed/expired/signature/algorithm token handling. **Amended:** add session invalidation (S9) — today logout clears only the client copy of a 24-hour token, and the filter never re-checks `User.isEnabled()`.
4. Configure production release signing, HTTPS-only transport, and an approved-host policy.
5. Migrate JWT storage to platform secure storage through a compatibility path that reads the legacy `token`, verifies the new write, deletes the legacy value, and clears both on logout during rollout.
6. Define access, encryption, redaction, retention, and deletion policy for stored transcripts and raw AI responses. **Amended:** this is a prerequisite for the account-deletion work in Stage 8, not an independent item.
7. Add per-user rate limiting and an LLM cost ceiling on the AI-backed endpoints.

#### Required verification

- Authorization and cross-user tests pass.
- Config, security-context, error-mapping, and **fail-closed** webhook secret/acknowledgement tests pass. (The previous "characterize the current fail-open rule" requirement is superseded by Stage A.)
- Log-capture tests or review confirm that tokens, passwords, raw transcripts, and raw AI payloads are absent.
- Existing valid clients and characterized invalid clients receive compatible bodies, except as Section 6.0 lists.
- Any approved hardening item has its own provider/release/security acceptance tests and rollout evidence.

#### Exit criteria

No migrated feature service reads security context directly, cross-cutting configuration/errors are isolated, and behavior-altering hardening remains explicitly tracked rather than mixed into extraction work.

#### Rollback

Keep old facades/config readers delegating to the new boundary until compatibility tests pass. For separately approved hardening, use an environment-gated rollout backed by confirmed provider/release behavior; do not invent a cryptographic signature scheme the provider cannot verify.

### Stage 4a (was Phase 2): Decompose backend use cases

#### Changes

1. Move request/response types out of controllers into feature `api/dto` packages.
2. Add compatibility mappers and keep controllers thin.
3. Extract food command and query services method by method.
   - Preserve current individual-save and partial-write boundaries for manual batches and voice batches during extraction. An atomic batch transaction is a behavior change and must wait for compatible post-commit enrichment plus explicit approval.
4. Extract pure nutrition calculation and report policies.
5. Extract nutrient preference and insight services.
6. Split habit definition, completion, and schedule behavior.
7. Replace concrete cross-feature service dependencies with narrow public application interfaces.
8. Convert dashboard composition to a query facade.
9. ~~Confirm the placeholder `/dashboard` route contract, then deprecate/remove it~~ **Superseded: delete it.** X8 established zero production callers; the only reference is an unused client method exercised by a test written in the same checkpoint. No deprecation cycle is warranted.
10. **Return fresh nutrition from the edit endpoint** (C13). Today `PUT` saves, fires async enrichment, then re-reads through the still-open persistence context and returns pre-edit values. With C10's status field in place, return the entry as `in_progress` rather than returning a stale number as if it were current.
11. **Write habit completion against the date being viewed** (C15). `toggleHabit` and `processVoiceResult` unconditionally target `LocalDate.now(clock)` while the dashboard reads an arbitrary date, so completing a habit for yesterday silently marks today.

#### Required verification

- Golden API responses are identical for representative and edge-case fixtures.
- Calculation tests cover totals, averages, trends, flags, top sources, and empty data.
- Ownership tests cover update/delete/toggle/voice operations.
- Architecture tests reject controller-to-repository access and cross-feature infrastructure coupling.
- Query-count tests guard habit and report N+1 regressions.

#### Exit criteria

`FoodService` no longer owns unrelated reporting, preferences, AI prompting, caching, and authentication concerns. Controllers migrated in this stage only validate/translate/delegate.

#### Rollback

Extract one public method/use case per pull request. Keep the old facade delegating to new services until all callers and contracts are verified, then remove it.

### Stage 4b (was Phase 3): Isolate external AI, voice, async work, and caches

#### Changes

1. Introduce `AiCompletionClient` and consolidate external HTTP behavior.
2. Extract typed prompt builders/parsers for nutrition, RDI, insights, and transcript meals.
3. Add explicit HTTP connect/read/total timeouts, response-size limits, retry classification, and sanitized failures.
4. Introduce the typed backend Vapi REST client used by the voice-token endpoint with the same protections; frontend SDK isolation remains a frontend task.
5. Make enrichment event-driven, post-commit, idempotent, and observable.
6. Add a bounded executor and retry policy; evaluate a durable job/outbox separately before multi-instance or guaranteed-delivery requirements are adopted.
7. Put RDI, insight, and nutrition cache behavior behind cache ports with explicit key, TTL, capacity, invalidation, and concurrency policies.
8. Make invalidation specific: age/gender profile changes invalidate that user's RDI and insights; food mutations invalidate overlapping insight ranges; preference changes invalidate insights. The content-addressed nutrition cache is unaffected by profile/preferences, and an edited entry naturally receives a new hash.

**Added by the review — the concurrency and resource defects in Section 7.0 D-CONC land here:**

9. **Move the provider call out of the transaction** (R1). Today the blocking, un-timed AI call runs inside
   `@Transactional`, so each in-flight enrichment pins a JDBC connection for the provider's full latency.
   Fetch first, then open a short transaction to persist.
10. **Pass an entry ID across the thread boundary, not a managed entity** (R2). The current handoff lets the
    async worker resurrect a deleted entry or revert a concurrent edit.
11. **Make enrichment idempotent and version it** (R3, R4). Add `@Version` to `NutritionDetails`; treat a
    duplicate-hash cache insert as a cache hit, not an enrichment failure.
12. **Fix the caches** (R5, R6, C14): replace `rdiCache` with a bounded, invalidatable concurrent cache;
    bound and evict `insightsCache`; never cache a failed RDI fetch as an empty success.
13. **Make `getOrCreateFoodLog` an upsert or retry on constraint violation** (R7).
14. **Add transaction boundaries before disabling open-in-view** (X1). This ordering is not optional: the
    read path currently depends on OSIV, so turning it off first breaks mapping and ownership checks.
15. **Locale-independent formatting** for the cache key and the prompt (R10).
16. **A durable retry path for enrichment** (C16). Status returns to `pending` today and nothing re-runs it.
    A scheduled sweep over `pending` rows older than N minutes is sufficient; an outbox is not yet warranted.
17. **Fix the transcript envelope fallback** (R12), which currently reports success while logging zero meals.
18. **Decide the trend-length disagreement** between the two report endpoints (X9).
19. **Add Actuator with health and readiness endpoints and enrichment metrics.** Section 5.2a records that
    there is no observability at all today, so the metrics bullet below currently cannot be satisfied.

#### Required verification

- Stubbed external-client tests cover success, invalid JSON, timeout, HTTP failure, oversized response, fallback, and retryable/non-retryable errors.
- **A test proves that a response yielding no numeric nutrients is recorded as a failure and is not cached** (C6).
- Enrichment tests cover duplicate events, concurrent updates, cache hits, retry exhaustion, and stale results.
- Manual and voice batch tests document and preserve or deliberately change partial-commit behavior.
- **A test proves a slow provider does not exhaust the connection pool** (R1).
- Metrics expose latency, failures, retries, queue depth, cache hit rate, and stuck enrichment.

#### Exit criteria

No feature application service constructs HTTP requests or parses provider envelopes directly. Async work cannot grow an unbounded thread/queue/cache silently.

#### Rollback

Keep provider adapters selectable by configuration during migration. Preserve old persisted enrichment states and make new workers able to resume them.

### Stage 5 (was Phase 4): Establish frontend feature boundaries and server state

#### Changes

1. Introduce `app`, `features`, and `shared` boundaries without a bulk file move.
2. ~~Convert `api/client.js` and `services/authService.js` to TypeScript~~ — done. Delete the now-unused `services/authService.ts` shim instead (F9).
3. Add typed feature API clients and move URL literals out of screens/components.
4. Introduce feature hooks/controllers for auth, food log, nutrition report, habits, profile, and voice.
5. Separate transport DTOs, feature models, and view models.
6. Make route refs and navigator usage fully typed.
7. Replace duplicated date helpers with local-date utilities.
8. ~~Enable strict TypeScript flags one at a time~~ **Moved to Stage 2** — it costs 2 errors.

**Added by the review:**

9. **Decide server state properly** (F1). `useApiOperation` shares one `AbortController` across every
   operation on a hook instance, so `HabitScreen` — which multiplexes fetch, toggle, and delete through a
   single instance — cancels its own mutations. It also has no data slot, cache, dedup, or refetch. Either
   adopt TanStack Query (recommended: it is the thing being half-rebuilt, and it solves F2, F3, and F5 as a
   side effect) or give queries and mutations separate controllers and add per-operation state. Record the
   choice as the ADR Section 14 already calls for — but record it now rather than deferring it again.
10. **Fix the concrete data-layer defects**: double fetch on `FoodLogScreen` mount (F2), the unguarded
    `finally` that clears the insights spinner from a superseded request (F3), optimistic pin state
    discarded on drawer open (F4), and the uncancellable enrichment polling loop (F5 — deletable once
    Stage A exposes `enrichmentStatus`).
11. **Single-source the navigation types** (F7): two navigators register `VoiceMealLog` with incompatible
    params, and `FoodLogScreen` hand-copies a param list to dodge a circular import.
12. **Verify the hand-written clients against `docs/openapi.yaml`** in CI. They already disagree in at least
    three places, and `featureApiContracts.test.ts` mocks `apiClient` and asserts only that the wrapper
    called the wrapper.
13. **Delete the dead code the checkpoint left behind** (F9): `hooks/useApi.tsx`, `services/authService.ts`,
    `ensureHabitChannels`, and the unused `getLegacyDashboard` client with the `/dashboard` placeholder (X8).
14. **Guard the empty state** in `HabitScreen`, which renders `width: "NaN%"` for a new user (C20).

#### Required verification

- API adapter tests assert routes, verbs, parameters, and payload mapping, **and are checked against the
  OpenAPI document**.
- Hook tests cover loading, success, empty, error, cancellation, refetch, and mutation states.
- **A test proves a mutation is not cancelled by a concurrent query on the same screen** (F1).
- Screen tests confirm existing loading/error/empty/success behavior.
- **Tests cover the authenticated request path, the 401 unauthorized-logout flow, and token restore** —
  the highest-risk behaviour the checkpoint rewrote, currently untested.
- Navigation compilation requires no application-owned `any` cast.
- Existing AsyncStorage keys and development-build custom API base URL behavior remain compatible; any production host restriction follows the separately approved security rollout.

#### Exit criteria

Screens contain no raw endpoint strings and no direct Axios calls. All authored code passes strict TypeScript.

#### Rollback

Maintain compatibility re-exports from old paths while a feature moves. Remove each re-export only after all imports and native tests pass.

### Stage 6 (was Phase 5): Unify voice, notification, and reminder orchestration

#### Changes

1. Extract notification payload parsing and route resolution from `App.tsx`.
2. Centralize channel definitions and notification builders.
3. Extract foreground, background, and cold-start handling into a coordinator while retaining required top-level registration.
4. **Amended (X7): share the Vapi lifecycle hook, not the screens.** The review measured the duplication:
   `IncomingMealCallScreen` and `IncomingHabitCallScreen` are ~89% identical after normalising naming, so
   consolidating those is high-payoff and low-risk. `VoiceMealLogScreen` and `VoiceHabitScreen` are only
   ~21% identical — forcing them into one abstraction with "task strategies" would invent coupling that is
   not there. Extract `useVoiceSession` for permission, connection, transcript, speaking, error, and
   cleanup; leave the two screens separate.
5. Replace duplicate incoming-call screens with shared presentation and typed variants.
6. Consolidate meal scheduling/onboarding form logic.
7. Wrap device-owned scheduling behind a `ReminderScheduler` interface. **Amended:** the interface wraps the
   *corrected* Stage A scheduler. Do not wrap and preserve the pre-Stage-A behaviour.
8. Create an ADR deciding long-term reminder ownership, timezone behavior, recurrence semantics, and multi-device behavior.

**Added by the review:**

9. **Write down the iOS design** (X4). iOS has no entitlements file, so `timeSensitive` is inert; no `audio`
   background mode, so a call dies when the app backgrounds; no CallKit or PushKit; and
   `setNotificationCategories()` is never called, so iOS notifications have **no Accept/Decline buttons**.
   The "incoming call" experience is Android-only today. Decide explicitly: add the entitlement, the audio
   background mode, and category registration for parity — or state that iOS gets a notification-first
   experience and design it deliberately.
10. **Make exact-alarm and full-screen-intent failure visible** (X5). Notifee's native code logs to
    `System.err` and returns without scheduling when `canScheduleExactAlarms()` is false, while
    `createTriggerNotification()` still resolves successfully. Check the permission state, surface a
    degraded state in the UI, and offer the settings deep link.
11. **Fix the permission check** *(unregistered follow-up — not a numbered 7.0 defect)* — it treats only explicit `DENIED` as failure, so `NOT_DETERMINED` and
    `PROVISIONAL` fall through as success, and onboarding schedules alarms regardless of the result.
12. **Fix midnight-crossing reschedules** (C18), silently dropped today at exactly the hour late meal logging
    happens, and `parseReminderTime`'s silent 08:00 fallback (C17).
13. **Fix the cold-start retry loop** (F6): unbounded, uncancellable, and able to navigate to routes that do
    not exist for an unauthenticated user. Also reconcile it with the iOS `getInitialNotification`
    deprecation *(unregistered follow-up)*, which can make cold-start navigation fire twice with two different behaviours.
14. **Reconsider navigating on `EventType.DELIVERED`** *(unregistered follow-up)* in the foreground handler — a delivered notification
    currently yanks the user out of whatever they were doing.
15. **Add tests for the scheduling layer**, which today has none: `mealScheduler`, `habitScheduler`, and
    `notifee.bootstrap` are entirely untested, and they are what the product depends on.

#### Required verification

- Matrix-test foreground, background, killed-app, default press, accept, decline, timeout, and reschedule paths.
- **A test proves accept and decline cancel the displayed notification without cancelling the pending trigger** (C1).
- **A test proves `reconcileReminders()` is idempotent and produces the correct pending set for every repeat-day combination** (C2).
- Test permission denied, provider disconnect, duplicate events, app resume, and cleanup behavior.
- Verify notification IDs, channel IDs, route names, and payload fields are unchanged. **Amended:** payload
  fields gain a `userId` in Stage A (C11); that addition is intended, and the check is that nothing else changed.
- Run Android and iOS device/simulator smoke tests; native SDK behavior cannot be validated only with Jest.

#### Exit criteria

Meal and habit flows share lifecycle infrastructure but keep separate business strategies. `App.tsx` is application composition, not the notification implementation.

#### Rollback

Keep route resolution and scheduling adapters behind feature flags/configuration during rollout. Never register both old and new background handlers simultaneously.

### Stage 7 (was Phase 6): Strengthen the domain and database model

#### Prerequisite

This stage begins only after application boundaries and database migration tests are stable — except for items 2, 3, 9, and 10, which are pulled forward as noted below.

#### Candidate changes

Every candidate below requires an approved data design and migration plan; none is implied by the internal package refactor.

**Pulled forward by the review.** Items 2, 3, and the indexes are not "candidates" — they are the absence of
referential integrity in a live schema, and deferring them to the end guarantees rework in Stage 4, which
has to reason about habit state without them. Schedule 2, 3, and 9 immediately after Stage 4a. The unique
constraint on `(habit_id, user_id, entry_date)` moves further forward still, into **Stage A** (R8), because
duplicate rows there permanently break a habit's listing.

1. Introduce internal enums/value objects for meal type, reminder type, habit status, enrichment status, nutrient ID, date range, and positive quantity.
2. Replace inconsistent habit/user string IDs with typed IDs through additive migrations (X3). (The foreign keys themselves are item 10.)
3. Add uniqueness constraints for daily habit state and frequently queried dates/statuses. (Indexes are item 9; the habit-completion uniqueness constraint itself moves to Stage A — R8.)
4. Decide whether repeat days remain a PostgreSQL array or move to a normalized schedule table.
5. Avoided foods: see item 12 — the comma-splitting defect (C19) settles this in favour of structured storage.
6. Standardize time and timezone types — see item 11 for the specific mismatch.
7. Establish explicit retention rules for voice transcripts and raw AI responses.
8. For large tables, use additive nullable columns, restartable batch backfills, dual read/write compatibility, concurrent index creation where supported, deferred constraint validation, and bounded lock/statement timeouts.
9. **Add the missing indexes** (R11). `V1` declares none — not on `food_entries.food_log_id`, not on the
   habit lookup triple, not on any foreign key. Every join and scheduler query is a sequential scan.
10. **Add the missing foreign keys and cascade behaviour** (R9). Deleting a habit orphans its completion
    history forever; deleting a user orphans food logs and nutrient preferences. Four FKs exist and none
    covers these.
11. **Reconcile the timestamp types** (C7). The schema mixes `timestamptz` and naive `timestamp` for the same
    conceptual instant. This is the concrete content of item 6.
12. **Normalise avoided foods** (C19), currently a comma-joined string that splits any food name containing
    a comma. This is the concrete content of item 5.

#### Required verification

- Migration tests run from both a fresh database and a representative pre-refactor schema.
- Backfills are restartable and do not lose or reinterpret data.
- Old and new application versions are compatible during deployment where zero-downtime rollout is required.
- Query plans and indexes are checked for date-range/report/scheduler paths.

#### Exit criteria

Persistence constraints reflect domain invariants, and every schema change has a forward, compatibility, and rollback plan.

#### Rollback

Use expand/migrate/contract and prefer a tested forward fix over destructive down-migrations. Destructive cleanup occurs only after the compatibility window, verified backups, and a rehearsed restore procedure.

### Stage 8 (new): Product and release readiness

The previous plan was entirely about internal structure. None of the items below appeared in it, and
several are hard blockers for shipping. Items 1 to 3 should start as soon as Stage 5 does; the rest gate a
store submission.

#### Changes

1. **Crash and error reporting.** There is none. Add Sentry or Crashlytics on the client and error reporting
   on the backend. Without this, every defect in Section 7.0 that reaches a user is invisible to you — which
   is how a product whose reminders fire once reached this point undetected.
2. **An error boundary and a consistent failure surface** (F8). A render-time throw currently blanks the
   app, and eleven of fifteen screens report failures only to the console. One error boundary at the
   provider tree, one toast or banner surface, and a shared loading/empty/error contract that screens use
   rather than reinvent.
3. **Offline behaviour.** A food logger is used in restaurants and gyms. Today there is no `NetInfo`, no
   retry, no queue, and a 10-second Axios timeout that is too short for the LLM-backed transcript endpoint.
   At minimum: detect offline, say so, retry idempotent reads with backoff, and queue food-entry writes.
   Optimistic entry creation with a pending state pairs naturally with the `enrichmentStatus` field from
   Stage A.
4. **Account deletion.** There is no delete-account endpoint or UI. Apple requires in-app account deletion
   for any app that supports account creation; this is a hard App Store rejection, not a nice-to-have. It
   depends on the retention policy in Stage 3's backlog and the foreign keys in Stage 7 — without cascades,
   a delete leaves orphaned food logs, preferences, transcripts, and habit history.
5. **Data export.** Lower priority than deletion, but the same machinery.
6. **Store submission requirements.** iOS `PrivacyInfo.xcprivacy` exists — verify it declares the actual
   data collection. Android Data Safety form. Decide the `USE_EXACT_ALARM` question (X5): Google Play
   restricts it to alarm-clock and calendar apps, so a nutrition tracker declaring it risks rejection.
   Prefer `SCHEDULE_EXACT_ALARM` with a runtime permission flow.
7. **Release engineering.** There is none: the `Dockerfile` was deleted in `b300a32`, and there is no compose
   file, deploy workflow, artifact publication, `CHANGELOG`, or version strategy — the app is still at
   `versionCode 1`. Add a backend container image and deploy path, real release signing, a version scheme,
   and a staged rollout with a crash-free-rate check.
8. **Nutrition accuracy.** This is the product's central claim and it is currently an unvalidated LLM guess
   at `temperature: 0.1`, cached permanently and shared across all users. Build a small evaluation set of
   50 to 100 common foods with known values (USDA FoodData Central), measure error, and track it as a
   number. Then decide: a deterministic food-database lookup with the LLM as fallback for unmatched items
   is very likely the better architecture for accuracy, cost, and latency. Until that decision is made, show
   the user that values are estimates.
9. **Accessibility and polish.** Screen-reader labels on the interactive surfaces, dynamic type, contrast,
   and real empty states. Units: metric versus imperial is a genuine nutrition-app requirement, not
   speculative i18n.

#### Required verification

- A crash in any screen is reported and does not blank the app.
- Airplane mode produces a clear message and a working retry, and a queued food entry is delivered on
  reconnect.
- Account deletion removes every row belonging to the user, verified by a test that counts rows across all
  nine tables before and after.
- The nutrition evaluation set runs in CI and reports mean absolute error per macronutrient.
- A release build passes store validation for both platforms.

#### Exit criteria

The application can be submitted to both stores, failures are observable in production, and the accuracy of
its central number is a measured quantity rather than an assumption.

#### Rollback

Every item here is additive except the offline write queue and the `USE_EXACT_ALARM` decision. Ship the
queue behind a flag; keep the direct-write path until the queued path has run in production for a release.

### Stage 9 (was Phase 7): Complete quality, performance, and documentation ratchets

#### Changes

1. ~~Raise strict TypeScript settings for all authored code~~ **Moved to Stage 2** — it costs 2 errors. What remains here: document the exceptions for generated/vendor code.
2. Add backend formatting/static analysis, architecture rules, coverage reporting, and dependency checks.
3. Add frontend formatting/lint/type/test coverage reporting and native build checks.
4. Add performance tests for reports, date ranges, webhooks, enrichment throughput, and scheduler queries.
5. Replace template documentation with current setup, architecture, configuration, troubleshooting, and release instructions.
6. Remove confirmed compatibility shims, dead code, and redundant root package metadata.
7. Create a controlled dependency-update process that verifies native patches.

#### Required verification

- Every gate in Section 10.4 runs in CI and blocks the merge.
- Coverage is reported on both sides and has a floor that only moves up.
- The performance tests have recorded baselines, so a regression is visible.
- The documentation matches a clean-machine setup, verified by following it on a clean machine.

#### Exit criteria

All Definition of Done items in Section 13 pass, documentation matches the deployed architecture, and remaining debt has an owner/decision record.

#### Rollback

Ratchets are the one thing that should not be rolled back. If a new gate fails on legitimate work, raise the
threshold explicitly and record why — do not remove the gate.

## 10. Test and Quality Strategy

### 10.1 Backend test layers

- **Pure unit tests:** nutrition calculations, flags, date ranges, reminder policies, state transitions, prompt construction, JSON extraction, and mappings.
- **Application tests:** commands/queries with fake repositories, authenticated user, clock, cache, AI, and Vapi ports.
- **Web slice/contract tests:** controller validation, JSON shape, status codes, security rules, and error mapping.
- **Persistence integration tests:** PostgreSQL-compatible tests for arrays, JSONB, joins, unique constraints, ownership, migrations, and query counts.
- **External adapter tests:** stub HTTP servers for AI and Vapi timeouts, errors, envelopes, and redaction.
- **End-to-end backend tests:** critical auth -> write -> enrich -> query workflows with controlled async execution.

### 10.2 Frontend test layers

- **Unit tests:** validators, date/time helpers, reducers/state machines, payload parser, route resolver, delay extraction, and mappers.
- **Adapter tests:** typed API clients, SessionStore, storage migration, Notifee adapter, and voice adapter.
- **Hook tests:** auth, food, nutrition, habits, voice, and reminder orchestration.
- **Component/screen tests:** critical loading, empty, success, validation, error, and retry states.
- **Navigation/lifecycle tests:** foreground, background, initial notification, accept/decline, pending navigation, and unauthorized logout.
- **Native smoke/E2E tests:** Android and iOS login, food CRUD, notification, and voice flows.

### 10.3 Critical contract matrix

| Area | Minimum cases |
| --- | --- |
| Auth | register conflict, valid/invalid login, token restore, missing/malformed/expired token, 401 logout, profile ownership, exact public/authenticated route matchers |
| Food | all three current response shapes, empty day, add batch/partial write, inferred async completion, edit, delete, invalid input, cross-user access, concurrent log creation |
| Reports | no data, partial week, totals, averages, trends, goals, preferences, top sources, fallback insights |
| Habits | day filtering, ownership, toggle both ways, delete, voice completed/missed/rescheduled, timezone boundary |
| Voice webhook | **fail-closed with no configured secret**; valid/invalid/missing `X-Vapi-Secret`; **a body-supplied `userId` that does not match the session the token was minted for is rejected**; `submit_meal_log`, ignored event, malformed payload, unknown user, oversized body, partial failure, 200/401 acknowledgement; approved replay/idempotency rules when supported |
| AI adapters | `choices[0].message.content`, exact nutrition keys, cache-key normalization/hit, fenced/malformed JSON, timeout, provider error, fallback, retry exhaustion, **a response that yields no numeric nutrients is a failure and is not cached**, **locale independence of the cache key** |
| Notifications | foreground/background/killed, accept/decline/default press, timeout, same-day reschedule, payload compatibility, **accept/decline leaves the recurring trigger armed**, **`reconcileReminders()` is idempotent and honours every repeat-day combination**, **logout cancels and re-arms per user** |
| Reminder recurrence | every repeat-day subset; a habit surviving a week; DST transition; timezone change; app update; force-stop; permission revoked mid-life |
| Deployability | a release build reaches a configured backend; the AI provider base URL is configurable and reachable |
| API client/release | development custom-host behavior; separately approved production host/redirect, HTTPS, developer-route, token-storage, signing, and CORS policy |
| Persistence | fresh migration, existing-schema baseline, constraints, indexes, rollback/forward compatibility |

### 10.4 Quality gates

These are the actual commands as of the Stage A/2 closeout:

```bash
cd backend
./mvnw verify              # 51 unit tests + 9 Testcontainers ITs + JaCoCo

cd ../frontend
npm ci                     # runs the tracked patch-package postinstall
npm run audit:ci           # fails on unaccepted moderate+ findings and on stale allowlist entries
npm run lint               # eslint . --max-warnings 67
npm run lint:debt          # inline eslint-disable ratchet
npm run typecheck          # tsc --noEmit, strict
npm run test:coverage -- --ci --runInBand

cd android
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Strict TypeScript is on and cost 2 errors, both fixed rather than excepted. Canonical CI uses normal
`npm ci` so the tracked `patch-package` postinstall runs, and it fails if either native patch does not apply.

`./mvnw verify` is now a real gate: Surefire, Failsafe, and JaCoCo are configured, and
`ApplicationContextIT`/`DatabaseMigrationIT`/`PersistenceMappingIT` open a real Testcontainers PostgreSQL —
H2 would not do, because the application uses arrays, JSONB, and native SQL. One caveat that matters:
**Testcontainers skips rather than fails when no container runtime is present, and `verify` still reports
success.** CI therefore carries an explicit step that parses the failsafe reports and rejects a run where
any of the three IT classes reported zero tests or any skips. Without that step, a runner without Docker
would produce a green backend job that proved nothing.

CI must additionally gate on: a dependency audit with an explicit allowlist for accepted findings; the
hand-written TypeScript clients matching `docs/openapi.yaml`; and `spring.jpa.open-in-view` remaining at its
pinned value. GitHub Actions themselves must be pinned to commit SHAs — pinning every runtime to an exact
patch while the actions float at `@v4` is an inconsistent determinism claim and a supply-chain exposure.

An iOS compile/smoke job must run on macOS CI after Bundler/CocoaPods installation, using a pinned Ruby/Xcode/CocoaPods toolchain and appropriate lockfiles. Emulator/device tests should be added for native notification/voice paths. If production hardening is approved, add a separate Android `lintRelease`/`bundleRelease` gate that rejects the debug signing certificate and verifies the merged production manifest disables cleartext traffic; do not infer release safety from `assembleDebug`.

Coverage should initially be reported, then ratcheted for changed code and critical modules. A global percentage must not encourage low-value tests or block early characterization work.

Every stage must also pass:

- contract comparison against the baseline;
- configured secret scanning (including history), frontend/backend dependency analysis, and static security analysis, with no new high/critical findings except documented time-bounded exceptions;
- architecture dependency rules;
- database forward/compatibility checks for schema changes;
- a log-redaction check;
- the critical manual smoke-test subset affected by the change.

## 11. Delivery and Pull Request Strategy

Use small pull requests in this order within each vertical slice:

1. Add characterization tests for the existing behavior.
2. Introduce a seam/interface while the existing implementation remains active.
3. Move one responsibility behind the seam.
4. Compare contract outputs and operational metrics.
5. Switch callers to the new implementation.
6. Remove the old path only after all callers and tests are green.

Recommended pull request constraints:

- one primary architectural intent per PR;
- no unrelated formatting sweep;
- no framework/dependency upgrade unless required by that PR;
- no schema cleanup in the same PR as application extraction;
- explicit compatibility notes and rollback steps;
- before/after dependency or data-flow description for structural changes;
- updated tests and documentation in the same PR.

## 12. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| **The refactor faithfully preserves broken behaviour** — the risk this plan actually realised. Nine months of structural work would have produced a clean codebase whose reminders still fire once. | Section 7.0 is the register of what must *not* be preserved. Criterion 0 in Section 2 gates on the product working, not on the structure being tidy. Stage A runs first. |
| **The plan's status drifts from reality**, so decisions are made on claims rather than facts. Eight of the previous checkpoint's status claims were wrong or overstated. | Every status claim cites a file and line, or a command whose output is recorded. "Locally complete" is not a status; a green CI run is. |
| Refactor changes undocumented behavior | Characterization tests and golden contracts before movement |
| Large file moves cause merge conflicts | Move one feature/use case at a time; retain compatibility exports/facades |
| Async enrichment loses or duplicates work | Post-commit event, idempotency, bounded execution, metrics, and a durable job/outbox only where required |
| Cache changes produce stale goals/insights | Explicit keys, TTL/retention decision, invalidation, capacity, and concurrency tests |
| Database normalization loses data | Baseline migration, expand/backfill/contract, backups, representative migration tests |
| Notification refactor breaks killed-app handling | Keep required top-level registration and run a lifecycle/device test matrix |
| Voice abstraction hides meal/habit differences | **Measured (X7): the two voice screens are only ~21% duplicated.** Share the Vapi lifecycle hook only; do not merge the screens. The incoming-call screens, at ~89%, are the ones to consolidate. |
| ~~Strict TypeScript creates a long-running branch~~ | **Not a risk. Measured at 2 errors.** |
| API DTO cleanup breaks mobile clients | Compatibility DTOs, OpenAPI/golden snapshots, version externally visible changes |
| Security hardening rejects legitimate provider traffic | Observe, shadow-validate, and phase enforcement with provider test traffic |
| Dependency updates break native patches | Keep upgrades separate and verify patched Android/iOS builds |
| New abstractions increase complexity | Require each abstraction to remove an observed dependency or duplication |

## 13. Definition of Done

A stage is complete only when:

- [ ] All in-scope user journeys behave as before, **or better where Section 6.0 says so**, or have an explicitly approved behavior change.
- [ ] REST contracts and mobile persistence/notification/navigation identifiers remain compatible apart from the Section 6.0 list.
- [ ] **No Section 7.0 defect assigned to this stage remains open, and each closed one has a test that would fail if it regressed.** Items marked *unregistered follow-up* are tracked but do not gate the stage.
- [ ] Backend verification passes.
- [ ] Frontend lint, type-check, and tests pass.
- [ ] Relevant Android and iOS smoke/build checks pass.
- [ ] New behavior is covered at the appropriate unit/integration/contract level.
- [ ] No direct dependency violates the target module rules.
- [ ] No new high-severity security or dependency finding is introduced.
- [ ] Logs contain no credentials, tokens, raw transcripts, or raw AI responses.
- [ ] External calls define timeout, error, retry, and observability behavior.
- [ ] Async operations are bounded and have visible failure states.
- [ ] Cache behavior defines key, capacity, explicit TTL/retention decision, invalidation, and concurrency semantics.
- [ ] Schema changes include migration, compatibility, backup, and rollback notes.
- [ ] Documentation and decision records are updated, **and every status claim in this plan cites a file, a line, or a recorded command output**.
- [ ] Obsolete compatibility code is removed only after its migration window closes.

The overall work is complete when the application does what it advertises on both platforms, the target boundaries are enforced, the compatibility suite remains green, production failures are observable, and the remaining deferred decisions are explicitly documented rather than embedded as accidental behavior.

## 14. Decisions Required

Decisions marked **resolved** were settled by the 2026-08-22 review because the "default during refactor"
turned out to preserve a defect rather than a design choice.

| Decision | Position |
| --- | --- |
| Device-owned vs server-owned reminders | **Still open.** Device-owned for now, behind an interface — but the interface wraps the *corrected* Stage A scheduler, not the current one. |
| Habit recurrence semantics | **Resolved: fix.** There is nothing to characterize. `repeatDays` is stored and ignored (C2), and accept/decline destroys the recurring meal trigger (C1). Stage A. |
| Per-user timezone | **Resolved: add it.** The previous plan had no position at all. Every user's "today" is currently the server's (C7). Stage A. |
| Webhook failure acknowledgement | Still open. Preserve provider-compatible acknowledgement while adding durable failure visibility. |
| Webhook authentication/replay controls | **Resolved: fail closed, now.** Not approval-gated. With the shipped default this is an unauthenticated cross-user write with an attacker-supplied user ID (S1). Replay and idempotency remain open. |
| AI provider replacement | **Resolved: replace.** `http://127.0.0.1:<port>` cannot be deployed (C5). Keep the OpenAI-compatible interface; change the host. Whether to add a deterministic food database as the primary source is a separate Stage 8 decision. |
| Frontend server-state library | **Decide in Stage 5, not later.** `useApiOperation` is a half-built one whose shared abort already cancels mutations (F1). Recommendation: adopt TanStack Query. |
| OpenAPI-generated frontend types | Still open — but the clients must be *verified* against the contract in CI from Stage 5 regardless, since they already disagree in three places. |
| Secure token storage | Still open. Design a backward-compatible migration from the `token` key. Pair with session invalidation (S9). |
| Nutrient model mismatch | Still open. Preserve current output until product requirements are approved. |
| Nutrition goal/fallback differences | Still open. Choose one source of truth in a separate change. |
| Partial manual/voice batch writes | **Reframed.** This is a product question, not a compatibility default. Today a half-committed batch returns 500 with no rollback (X2), and the voice path records the session as `FAILED` next to the rows that committed while returning HTTP 200. Decide what the user should see, then implement it. |
| Placeholder `GET /dashboard` | **Resolved: delete.** Zero production callers; the only reference is an unused client method exercised by a test written in the same checkpoint (X8). No deprecation cycle warranted. |
| Transcript/AI response retention | Still open, and now a **prerequisite for account deletion** (Stage 8), not an independent item. |
| Vapi integration path | **New, open.** The frontend starts calls with hardcoded public keys while the backend `/food/voice/token` endpoint is implemented, contract-tested, and never called. Pick one. Stage A only moves the identifiers into configuration; it does not settle this. |
| Nutrition accuracy strategy | **New, open.** LLM-only versus food-database-first. Unmeasured today. Stage 8 item 8. |
| iOS incoming-call design | **New, open.** Full parity (entitlement + `audio` background mode + category registration) versus a deliberate notification-first iOS experience (X4). |
| `USE_EXACT_ALARM` | **New, open.** Play Store restricts it to alarm-clock and calendar apps (X5). |

## 15. Recommended First Implementation Slice

Stage A and Stage 2 are implemented and every gate that can run outside CI is green, so the next slice is
no longer verification work either. What remains before Stage 3 is confirmation the owner has to run:

1. **Commit the checkpoint** as reviewable commits — it is still one large staged working tree, and the
   longer it stays that way the less reviewable it gets.
2. **Let CI confirm on pinned runners.** Everything has passed locally, but CI pins Xcode 16.4 where the
   local build used 26.6, and it is the environment the guard against skipped integration tests protects.
3. **Run Stage A's two owner-only checks:** a physical Android device pass over a week (a habit set for
   three days firing on all three; the daily meal reminder surviving being accepted), and a release build
   reaching a real deployed backend with a hosted AI provider.
4. **Record those results here**, mark Stage A's exit criteria met, and then start Stage 3.

Steps 3 and 4 are the whole reason Stage A exists — Success Criterion 0 is about behaviour on a real device
against a real deployment, and no amount of green CI substitutes for it. The `VapiClient` defect is the
argument in miniature: everything was green until something actually started the application.

See **Implementation Checkpoint — 2026-08-23 (Stages A and 2 closed out)** for exactly what was verified
and how.

## 16. Prioritized Work Queue

Ordered by (user-visible value + risk reduction) ÷ effort. This is a **value ranking, not an execution
order** — for the order to actually work in, follow Stage A and Section 15, which put the deployability
fixes (rows 3 and 4 here) before the reminder work, because nothing can be verified end to end until the
app can reach a backend. Sizes are rough: S is under a day, M is a few days, L is a week or more.

| # | Work | Stage | Size | Why here |
| --- | --- | --- | --- | --- |
| 1 | Fail-closed webhook + reject body-supplied user identity | A | S | Live unauthenticated cross-user write |
| 2 | Reminders that recur (C1, C2, reconciliation, per-user scoping) | A | M | The product's core loop does not work |
| 3 | Configured API base URL + hosted AI provider | A | S | Nothing else can be validated end to end |
| 4 | Stop caching all-zero nutrition; treat unparseable as failure | A | S | Silently poisoning the central number, permanently and globally |
| 5 | 401 entry point + client logout recovery | A | S | Users get stuck in a broken session with no way out |
| 6 | Expose `enrichmentStatus` | A | S | Removes polling, guesswork, and a whole class of confusing UI |
| 7 | Wire up the validation already declared; one error model | A | S | Cheap; closes S3, S4, C9 |
| 8 | Unique constraint on habit completion | A | S | Actively corrupting data |
| 9 | Release hygiene: `__DEV__` gates, Vapi config, keep voice sessions alive | A | S | Ships a backdoor today |
| 10 | Per-user timezone | A | M | Wrong day boundaries are a persistent, hard-to-diagnose class of bug |
| 11 | Context-load test + Testcontainers + Surefire/Failsafe/JaCoCo | 2 | M | Today CI cannot catch a failure to start |
| 12 | Strict TypeScript | 2 | S | 2 errors |
| 13 | Migration tool (Flyway) | 2 | S | There is no migration chain, only a file |
| 14 | Replace mock-heavy tests with real filter-chain tests | 2 | M | Current tests protect nothing and will break during the refactor |
| 15 | Crash reporting + error boundary | 8 | S | Failures are invisible in production today |
| 16 | AI call out of the transaction; bounded caches; idempotent enrichment | 4b | M | Connection-pool exhaustion and unbounded growth |
| 17 | Transaction boundaries, then disable open-in-view | 4b | M | Prerequisite for any layering change |
| 18 | Server-state decision + fix the data-layer defects | 5 | M | Mutations cancelling each other is a user-visible correctness bug |
| 19 | Consolidate the incoming-call screens (89% duplicate) | 6 | M | High payoff, low risk |
| 20 | Typed IDs, foreign keys, indexes | 7 | L | Referential integrity is absent; Stage 4 needs it |
| 21 | Account deletion | 8 | M | Hard App Store blocker |
| 22 | Nutrition accuracy evaluation | 8 | M | The product's central claim is unmeasured |
| 23 | Offline behaviour | 8 | L | Real usage context for a food logger |
| 24 | `FoodService` decomposition | 4a | L | Genuinely worth doing — but it is maintainability, not correctness, and it has been the plan's focus while items 1 to 10 went unnoticed |

The ordering makes one point explicitly: **item 24 was the previous plan's centre of gravity, and it belongs
near the bottom.** Decomposing an 810-line service is real work with real value, and it should happen. It
just should not happen before the application does what it says it does.
