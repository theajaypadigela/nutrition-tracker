# Coverage baseline

Stage 2 requires a coverage number to exist before anything ratchets against it.
These are the numbers as measured on 2026-08-23, on the Stage A + Stage 2
working tree. Report first, ratchet later — but the floors below are enforced now
so the numbers cannot go backwards.

## Backend — JaCoCo

Measured with `./mvnw verify`: 51 unit tests plus 9 Testcontainers integration
tests, with the agent set to `append` so both phases land in one `jacoco.exec`.

| Metric | Covered | Missed | Coverage |
| --- | --- | --- | --- |
| Instructions | 2,807 | 4,185 | 40.15% |
| Branches | 173 | 355 | 32.77% |
| Lines | 642 | 869 | 42.49% |
| Methods | 138 | 126 | 52.27% |

For reference, the unit tests alone reach 37.66% lines — the integration tests
add about five points, most of it in configuration and wiring code that only a
real context touches.

Uploaded as the `backend-jacoco` CI artifact. No JaCoCo `check` rule is enforced
yet; Stage 9 owns the backend ratchet, once the decomposition stages have stopped
moving the denominator around.

## Frontend — Jest

Measured with `npm run test:coverage`. Generated gluestack UI under
`src/components/ui` is excluded, the same exception boundary the TypeScript and
lint gates give it.

| Metric | Covered | Total | Coverage | Enforced floor |
| --- | --- | --- | --- | --- |
| Statements | 437 | 2,348 | 18.61% | 18% |
| Branches | 158 | 1,430 | 11.04% | 11% |
| Functions | 97 | 551 | 17.60% | 17% |
| Lines | 422 | 2,236 | 18.87% | 18% |

The floors are in `jest.config.js` under `coverageThreshold`, set at today's
measured values rounded down. Raise them as coverage rises; never lower them.

## Reading these numbers

Frontend coverage is low because most of it is screens, and the screen tests that
Stage 2 makes possible (`@testing-library/react-native` is now installed) are
Stage 5's work. What is covered today is the part that matters most right now:
the reminder/notification contracts, the API client and session handling, the
voice session lifecycle, and enrichment status. The refactor stages raise these
numbers as a by-product of extracting testable units; the floors exist so a
refactor cannot quietly lose coverage on the way.
