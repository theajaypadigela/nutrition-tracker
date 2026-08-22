# Nutrition Tracker

A full-stack nutrition tracking application with a React Native mobile frontend and Spring Boot backend.

## Project Structure

```
.
├── frontend/          # React Native mobile application
│   ├── src/           # Source code
│   ├── android/       # Android native code
│   ├── ios/           # iOS native code
│   └── ...
│
├── backend/           # Spring Boot REST API
│   ├── src/           # Java source code
│   ├── pom.xml        # Maven configuration
│   └── ...
│
└── README.md          # This file
```

## Frontend (React Native)

The mobile application is built with React Native, featuring:
- NativeWind for styling
- Gluestack UI components

### Getting Started

```bash
cd frontend
npm ci
npm run android  # For Android
npm run ios      # For iOS
```

## Backend (Spring Boot)

The REST API is built with Spring Boot and Java.

### Getting Started

Create an empty PostgreSQL database, then let Flyway apply the tracked baseline
and forward migrations. Configure the required environment variables first. See
[Backend configuration](docs/configuration.md) and the
[database baseline guide](backend/src/main/resources/db/migration/README.md).

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

## Development

Each project can be developed independently. CI runs PostgreSQL-backed backend
verification and dependency analysis, frontend audit/lint/strict type-check/
coverage, Android debug checks, and an iOS simulator compile on every push and
pull request.

### Quality gates

Run these before pushing; CI runs the same commands.

```bash
cd backend
./mvnw verify              # unit tests, Testcontainers PostgreSQL ITs, JaCoCo

cd ../frontend
npm run audit:ci           # dependency audit against audit-allowlist.json
npm run lint               # capped at the current warning baseline
npm run lint:debt          # inline eslint-disable ratchet
npm run typecheck          # strict TypeScript
npm run test:coverage      # Jest with enforced coverage floors
```

`./mvnw verify` needs a container runtime (Docker, colima, or podman). Without
one the Testcontainers integration tests **skip** and the build still reports
success, so check for `Tests run: 9, ... Skipped: 0` rather than trusting the
green build. CI has an explicit step that rejects a run where they were skipped.
Colima needs a little extra setup — see
[docs/configuration.md](docs/configuration.md#running-the-integration-tests-locally).

Three numbers are ratcheted and may only go down: the lint warning cap
(`--max-warnings`), the inline suppression counts in
`frontend/lint-debt-baseline.json`, and the accepted findings in
`frontend/audit-allowlist.json`. Coverage floors in `frontend/jest.config.js` may
only go up. See [docs/coverage-baseline.md](docs/coverage-baseline.md) and
[docs/lint-debt.md](docs/lint-debt.md).
