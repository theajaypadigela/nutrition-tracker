# API Compatibility Inventory

This inventory describes the external routes after the approved Stage A
correctness changes. Structural refactors must preserve these contracts. The
machine-readable contract is [`openapi.yaml`](openapi.yaml).

## Authentication rules

Spring Security permits `/auth/**`, the exact `/food/voice-log` path,
and `/error`. Every other route requires a bearer token. `GET /auth/me` is under
the public matcher but performs its own principal check and returns the standard
`401` error when the request has no authenticated user.

The public webhook is fail-closed:

- a missing or unequal `X-Vapi-Secret` returns an empty `401` response;
- the application refuses to start unconfigured outside the `local` profile;
- a meal-log event is authorized against the provider call created for the
  authenticated user; body metadata cannot select another user;
- accepted, ignored, malformed-at-application-level, and application-failure
  events are acknowledged with HTTP `200` and `{"result":"logged"}`.

Except for the webhook's deliberately empty `401`, API failures use
`{"status":number,"code":string,"message":string}` and do not expose internal
exception messages. Missing/invalid/expired credentials return `401`, access
denials return `403`, registration conflicts return `409`, and validation
failures return `400` with `code` `INVALID_REQUEST` and message
`Request validation failed`.

Framework-level request failures keep the status Spring MVC derives for them and
are reported in the same body: a malformed path variable or unreadable body is
`400`, an unsupported method is `405` (`METHOD_NOT_ALLOWED`), and an unsupported
content type is `415` (`UNSUPPORTED_MEDIA_TYPE`). Anything unrecognised is `500`
`INTERNAL_ERROR` with a fixed message.

## Route inventory

| Method | Path | Access | Current success contract |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | `200 {"message":"User registered"}` |
| `POST` | `/auth/login` | Public | `200 LoginResponse` |
| `GET` | `/auth/me` | Controller-checked | `200 ProfileResponse` |
| `GET` | `/profile` | Authenticated | `200 ProfileResponse` |
| `PUT` | `/profile` | Authenticated | `200 ProfileResponse` |
| `GET` | `/dashboard/{date}` | Authenticated | `200 DashboardResponse` |
| `POST` | `/food/{date}/meals/{mealType}/entries` | Authenticated | `200 FoodEntryResponse[]` |
| `GET` | `/food/{date}` | Authenticated | `200 MealsResponse` |
| `GET` | `/food?from=&to=` | Authenticated | `200 DayLogResponse[]` |
| `PUT` | `/food/{date}/meals/entries/{id}` | Authenticated | `200 MealsResponse` |
| `DELETE` | `/food/{date}/meals/entries/{id}` | Authenticated | `200 MealsResponse` |
| `GET` | `/food/nutrition/weekly?startDate=&endDate=` | Authenticated | `200 WeeklyNutritionReport` |
| `GET` | `/food/nutrition/all?startDate=&endDate=` | Authenticated | `200 NutrientSummary[]` |
| `GET` | `/food/nutrition/insights?startDate=&endDate=` | Authenticated | `200 InsightResponse[]` |
| `POST` | `/food/nutrient/{nutrientId}/pin` | Authenticated | `200 NutrientPreferenceResponse` |
| `PUT` | `/food/nutrient/{nutrientId}/target` | Authenticated | `200 NutrientPreferenceResponse` |
| `PUT` | `/food/nutrient/{nutrientId}/avoid` | Authenticated | `200 NutrientPreferenceResponse` |
| `GET` | `/food/nutrient/preferences` | Authenticated | `200 NutrientPreferenceResponse[]` |
| `POST` | `/habit` | Authenticated | `200 Habit` persistence JSON |
| `GET` | `/habit` | Authenticated | `200 Habit[]` for reminder reconciliation |
| `GET` | `/habit/today` | Authenticated | `200 HabitWithCompletionDTO[]` |
| `POST` | `/habit/{id}/toggle` | Authenticated | empty `200` |
| `DELETE` | `/habit/{id}` | Authenticated | empty `200` |
| `POST` | `/habit/voice-result` | Authenticated | `200 HabitWithCompletionDTO` |
| `POST` | `/food/voice-log` | Public webhook | `200 {"result":"logged"}` or empty `401` |
| `GET` | `/food/voice/token` | Authenticated | `200 {"token":"..."}` |
| `POST` | `/food/voice-log/parse-transcript` | Authenticated | `200 {"status":"success","entriesLogged":n}` |

## High-risk food response distinctions

Do not consolidate these shapes while moving DTOs:

- `GET /food/{date}` returns a meal-keyed object. Each item exposes string
  `quantity` and `servingSize`, and the response includes aggregate `totals`.
- `GET /food?from=&to=` returns day objects whose `meals` are arrays. Entries use
  numeric `quantity` plus `unit` and `mealType` fields.
- food `POST` returns only the created `FoodEntryResponse[]` and keeps
  `nutritionResponse: "Nutrition enrichment in progress"`; food `PUT` and
  `DELETE` return the complete daily `MealsResponse`.
- an empty `GET /food/{date}` returns `{"meals":{},"totals":{...all zeroes...}}`.
- food entry shapes add `enrichmentStatus` (`pending`, `in_progress`,
  `completed`, or `failed`) while retaining the existing nutrition fields.

Auth registration accepts an optional IANA `timezone`; login, `/auth/me`, and
profile responses include the normalized timezone. Legacy users are backfilled
to `UTC`.

## Persistence and mobile compatibility identifiers

The refactor must continue to read and write `token`, `custom_base_url`, and
`meal_schedule_v2`. Notification channel IDs, notification IDs, action IDs,
payload field names, and navigation route names are listed in
`APPLICATION_REFACTORING_PLAN.md` section 6.3 and are treated as public mobile
contracts.
