# Backend configuration

The backend reads Spring properties from environment variables. A non-secret
template is tracked at
`backend/src/main/resources/application.example.properties`. Copy it to the
Git-ignored `backend/src/main/resources/application-local.properties`, provide
the environment values below, and start the local profile:

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Do not put credentials in a tracked properties file. Shared environments should
inject them through their secret manager.

## Environment variables

| Variable | Required | Purpose | Safe local default |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL JDBC URL | `jdbc:postgresql://localhost:5432/nutrition_tracker` |
| `DATABASE_USERNAME` | Yes | PostgreSQL role | `nutrition_tracker` |
| `DATABASE_PASSWORD` | Yes | PostgreSQL password | None |
| `FLYWAY_ENABLED` | No | Enables the forward-only migration chain | `true` |
| `JPA_DDL_AUTO` | Yes | Hibernate schema policy | `validate` |
| `JWT_SECRET` | Yes | HMAC signing key; use at least 32 random bytes | None |
| `JWT_ACCESS_EXPIRATION` | Yes | Access-token lifetime in milliseconds | `86400000` |
| `AI_PROVIDER_BASE_URL` | No | Hosted OpenAI-compatible API root | `https://api.openai.com/v1` |
| `AI_PROVIDER_TOKEN` | Yes | Provider bearer token | None |
| `AI_PROVIDER_MODEL` | No | Provider model identifier | `gpt-4o-mini` |
| `VAPI_PRIVATE_KEY` | Yes | Vapi server credential | None |
| `VAPI_ASSISTANT_ID` | Yes | Vapi assistant identifier | None |
| `VAPI_API_BASE_URL` | No | Vapi server API root | `https://api.vapi.ai` |
| `VAPI_WEBHOOK_SECRET` | Yes outside `local` | Value expected in `X-Vapi-Secret` | None |
| `VAPI_WEBHOOK_MAX_BODY_BYTES` | No | Public-webhook request limit | `65536` |
| `VAPI_WEBHOOK_MAX_MEALS` | No | Maximum meals accepted per provider call | `20` |

The Vapi webhook fails closed when its secret is empty. Outside the `local`
profile, the Spring context also refuses to start without a configured secret.
Never reuse the JWT secret or a Vapi private key as the webhook secret.

## Database setup

Flyway creates fresh local, test, and CI databases from the repository-derived
V1 and applies all forward migrations before Hibernate validates the mappings.
`baseline-on-migrate` and Flyway clean are disabled. Follow the reconciliation,
backup, and restore checklist in the migration README before an owner adds a
baseline marker to any existing non-empty environment.

## CI toolchain

The tracked workflow uses:

- Eclipse Temurin Java 17.0.19;
- Maven 3.9.12 from the Maven Wrapper;
- Node.js 20.19.4 and npm 10.8.2; and
- Ruby 4.0.5, Bundler 4.0.11, Xcode 16.4, Android API 36, and NDK 27.1.12297006;
- PostgreSQL 16.4 through Testcontainers for migration and mapping validation.

Local versions are recorded in `.tool-versions`, `.nvmrc`, and `.ruby-version`.
CI runs backend verification and dependency analysis, frontend deterministic
install/audit/lint/strict type-check/Jest coverage, Android debug tests/lint/
assembly, and an iOS simulator compile. Every third-party action is pinned to
an immutable commit SHA.

The PostgreSQL integration classes are reported as skipped when local Docker is
unavailable, so unit-only work remains runnable. CI treats any such skip as a
failure and proves all three Testcontainers suites executed against PostgreSQL.

## Running the integration tests locally

`@Testcontainers(disabledWithoutDocker = true)` means a missing container runtime
produces a **skip, not a failure**, and `./mvnw verify` still reports success. If
you want the integration tests to actually run, check the output says
`Tests run: 9, ... Skipped: 0` — not just that the build was green.

Docker Desktop works as-is. With Colima (`brew install docker colima`) on Apple
silicon, two extra pieces of setup are needed:

```bash
colima start --cpu 4 --memory 6 --disk 30

# Testcontainers does not read Docker CLI contexts, so point it at the socket.
printf 'docker.host=unix://%s/.colima/default/docker.sock\n' "$HOME" \
  > ~/.testcontainers.properties

# Docker Engine 29 dropped API versions below 1.40; docker-java negotiates 1.32.
printf 'api.version=1.44\n' > ~/.docker-java.properties
```

Then run the suite with Ryuk disabled, because Ryuk bind-mounts the Docker socket
by its host path and the Linux VM cannot resolve a macOS path:

```bash
TESTCONTAINERS_RYUK_DISABLED=true ./mvnw verify
```

With Ryuk off, containers are cleaned up by the test lifecycle rather than by a
reaper, so check `docker ps -a` if a run is interrupted. None of this affects CI,
which uses the runner's own Docker.

## CI secrets

| Secret | Required | Purpose |
| --- | --- | --- |
| `NVD_API_KEY` | Recommended | OWASP dependency-check 12 reads advisories from the NVD API, which throttles unauthenticated callers to roughly one request every six seconds. Without a key the first data download can exceed the `backend-dependencies` job timeout. The job logs a warning and continues without it; request a free key at <https://nvd.nist.gov/developers/request-an-api-key>. |

No other CI secret is needed today. The webhook secret, JWT secret, database
credentials, and AI provider base URL are runtime configuration for a deployment,
not build inputs — the backend refuses to start without `VAPI_WEBHOOK_SECRET`
outside the `local` profile, and `babel.config.js` refuses to produce a release
bundle unless `NUTRITION_API_BASE_URL` is set to an HTTPS URL.
