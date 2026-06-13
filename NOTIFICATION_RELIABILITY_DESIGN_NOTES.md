# Reminder reliability — design-only proposals

These are the items the task scoped as **design-only** (write a proposal, don't build).
They are documented here so the dependencies are explicit and the work is ready to pick up.

---

## 1. FCM / remote-push fallback + server device registry

### Why
Local alarms (Notifee + AlarmManager) cannot fire while the app is **force-stopped** or
killed by an aggressive OEM until the user next opens the app (see survival matrix §B B4).
On-device reconciliation recovers and surfaces the miss, but the reminder itself was lost
for that occurrence. A server-driven push is the only mechanism that can wake a
force-stopped app at the right moment.

### Proposed shape
1. **Device registry (server).**
   - New collection `device_tokens`: `{ id, userId, fcmToken, platform, appVersion,
     timezone, lastSeenAt, enabled }`, unique on `(userId, fcmToken)`.
   - Endpoints: `POST /devices` (register/refresh a token on login + on FCM token rotation),
     `DELETE /devices/{token}` (logout).
   - Reuse the existing JWT principal for `userId`. Index `(userId)` and `(enabled)`.
2. **Client.** Add `@react-native/firebase` (or the Notifee-compatible FCM path). On login
   and on token refresh, `POST /devices`. On logout, delete. Store the token alongside the
   reminder system so reconciliation can confirm registration health on the §H surface.
3. **Server scheduler.** Promote `HabitReminderScheduler` (currently log-only) into a real
   sender: each minute, find due meal-schedule + habit occurrences in the **user's
   timezone** (the `User.timezone` field added in this change set), and send a
   **data-only** FCM message to the user's devices. The device's Notifee background handler
   builds the local call notification from the data message — keeping the full-screen call
   UX identical to the local path.
4. **Dedupe.** Both the local alarm and the push can fire for the same occurrence. Reuse the
   existing per-occurrence key (`${kind}:${slot|habitId}:${intendedFireAt}`) and the
   `processedActions` / pending-answer stores to ensure exactly-once handling regardless of
   which path delivered it.

### Dependencies / cost
- Requires an FCM project + `google-services.json` / APNs key, a native rebuild, and
  Play/!App-Store review for the push capability.
- Server must become timezone-correct for "due now" (the `User.timezone` field is already in
  place; `HabitReminderScheduler` would switch from `LocalTime.now()` to per-user zone).
- Meaningful new attack surface (token registry) — rate-limit `POST /devices` and scope
  tokens to the authenticated user.

### Recommendation
Build it **after** the local path proves out on devices. The local + reconciliation path
already satisfies (b) "late delivery clearly marked" and (c) "user-visible explanation" for
the force-stop case; FCM upgrades force-stop to (a) "delivery". Phase it as a follow-up.

---

## 2. Habit edit endpoint

### Why
There is no `PUT /habit/{id}`. Editing a habit today means **delete + recreate**, which:
- changes the habit id, breaking any per-habit notification id (`habit-push-<id>`) and the
  device's pending-answer/missed records keyed by that id;
- forces a full cancel + re-arm cycle, multiplying trigger churn (and, on a partial-week
  habit, re-arming up to 7 weekly triggers) on every minor edit;
- loses the habit's `habit_entries` history association if the id changes.

### Proposed shape
- `PUT /habit/{id}` accepting the same body as create (`name`, `repeatDays`, `reminderTime`,
  `reminderType`), verifying ownership via the JWT principal, updating in place (id stable).
- Client: replace delete+recreate in the habit edit flow with a single `PUT`, then run one
  `reconcileAfterHabitChange()` — the existing reconciliation diff will re-arm only what
  actually changed (e.g. a time change moves the slot; a day change adds/removes weekday
  triggers) and prune the rest, instead of tearing everything down.

### Dependency note
This is a **prerequisite for minimizing trigger churn**: the rolling-window / per-weekday
arming model is efficient on edits *only if* the habit id is stable. Until `PUT /habit/{id}`
exists, every edit pays the full delete+recreate churn cost. Recommend implementing it
alongside any habit-editing UI work.
