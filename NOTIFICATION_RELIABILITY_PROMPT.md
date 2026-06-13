# Task prompt — Alarm-grade reminder reliability

> **How to use:** Run Claude Code with model `claude-fable-5` (effort `high` or `xhigh`), from the repo root, and paste everything below the line as the first message of the session. Give it the whole prompt in one turn — don't drip-feed sections.
>
> The codebase facts below were audited and adversarially verified on 2026-06-13 against branch `mongo-deployment`. Line numbers may drift; the behaviors were confirmed.

---

## Mission

Make every reminder in this app fire like an Android alarm-clock alarm: at the right local time, every scheduled occurrence, regardless of reboot, Doze, force-stop, OEM task killers, permission churn, timezone/DST changes, app reinstall, or the app being killed — with explicit, user-visible degradation when the OS genuinely won't allow delivery, and best-effort parity on iOS. Today the system silently loses reminders through at least seven distinct paths; after your work, **no reminder may ever be lost silently**. Every failure mode must end in one of: (a) delivery, (b) late delivery clearly marked as such, or (c) a user-visible explanation with a one-tap fix.

This is a React Native app (`frontend/`) using `@notifee/react-native` 9.x for all reminders, with a Spring Boot + MongoDB backend (`backend/`) that stores habit definitions but currently sends no pushes. There are two reminder families, both styled as full-screen incoming voice calls that launch a Vapi voice session on Accept:

- **Meal reminder** — one daily call. `frontend/src/services/mealScheduler.ts`. `TimestampTrigger` + `RepeatFrequency.DAILY` + `alarmManager:{allowWhileIdle:true}`. Schedule `{hour, minute, enabled}` lives only in AsyncStorage (`meal_schedule_v2`); the backend has no meal-schedule model.
- **Habit reminders** — per-habit. `frontend/src/services/habitScheduler.ts`. Time parsed from `"HH:MM AM/PM"` strings; **one-shot** triggers (no `repeatFrequency`), even though the backend `Habit` model carries `repeatDays`. Call-type habits at the same time share one notification id (`habit-call-<slot>`).

Event wiring: `App.tsx` registers `notifee.onBackgroundEvent` at module scope (accept/decline `ACTION_PRESS` only) and `onForegroundEvent` inside a `useEffect`; cold-start taps recover via `getInitialNotification`. Accept/Decline flow through `frontend/src/hooks/useIncomingCall.ts`. Channels are created in `frontend/src/services/notifee.bootstrap.ts` from an `App.tsx` effect. Android `targetSdk` is 36; the manifest declares `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `POST_NOTIFICATIONS`, `USE_FULL_SCREEN_INTENT` — but not `RECEIVE_BOOT_COMPLETED`. iOS has never been built from this repo (no `Podfile.lock`); treat all iOS work as compile-verified only and say so.

## Verified defects — fix these first (P0)

Re-verify each against the code before changing it; if one turns out to be wrong or already fixed, say so and move on rather than forcing a change.

1. **Answering or declining any call wipes every scheduled reminder.** `useIncomingCall.cancelCallNotifications` (`useIncomingCall.ts` ~70–81) calls `notifee.cancelAllNotifications()`, which per Notifee's contract also deletes **all pending trigger notifications** — including the daily meal repeat. One interaction with any call kills every future reminder. Replace with display-only cancellation (`cancelDisplayedNotification(s)`) or targeted ids.
2. **Foreground delivery also kills the meal repeat.** The `onForegroundEvent` DELIVERED handler (`App.tsx` ~210–212 and ~262–264) calls `notifee.cancelNotification(id)` to swap the OS notification for the in-app banner — but `cancelNotification` removes the re-armed trigger with that id too, ending the DAILY chain. Verify Notifee's post-fire re-arm ordering and switch to a display-only cancel.
3. **Habit reminders fire once, then never again.** One-shot triggers (`habitScheduler.ts` ~82–85), no recurrence, no day-of-week filtering despite `repeatDays` existing server-side, and nothing ever re-arms them. The backend's `HabitReminderScheduler` only writes log lines.
4. **No launch-time reconciliation exists, and Notifee never re-arms alarm triggers on app launch** (its database-driven rescheduling runs only from its boot receiver and exact-alarm-permission-grant receiver). After a force-stop — which on Android cancels all of an app's AlarmManager alarms until next launch — or an OEM kill, every reminder is dead until the user happens to re-save a schedule. Nothing calls `notifee.getTriggerNotificationIds()` anywhere.
5. **Cold-start Accept is double-handled.** When the app is killed and the user taps Accept, both `onBackgroundEvent` (runs `handleAcceptCall` with `skipNavigation`) and `getInitialNotification` (runs `handleAcceptCall` again without it) execute — two Vapi session starts can race. Also, accept/decline navigation readiness polling (`useIncomingCall.navigateWhenReady`, ~20×150 ms) silently drops the action on slow cold starts.
6. **Decline and the 60 s ring timeout write no state anywhere.** A declined or missed habit call leaves the server-side habit `PENDING` forever; no missed-call follow-up notification is shown; for habits, the (one-shot) reminder lifetime simply ends.
7. **Unparseable habit times schedule a ringing call at 08:00 AM.** `parseReminderTime` silently defaults to `{hour: 8, minute: 0}` on regex miss. Wrong-time delivery, not a skip. Fail loudly instead, and prefer structured time data over string parsing end-to-end.

## Required behaviors (acceptance criteria)

### A. Scheduling model and recurrence

- A single **source-of-truth schedule intent** per reminder: wall-clock `{hour, minute}` plus recurrence (daily for meals; `repeatDays`-aware for habits). Epoch trigger timestamps are always *derived*, never authoritative.
- Habit reminders recur correctly per their `repeatDays`, surviving each fire. Choose the mechanism (Notifee weekly repeats per day, or reconciliation-driven re-arming) with the platform caps budgeted: **50 pending trigger notifications on Android (Notifee), 64 pending requests on iOS, ~500 AlarmManager alarms system-wide per app**. A rolling window (schedule the next N occurrences, top up at reconciliation) is acceptable.
- Reschedules ("call me back in 20 minutes") must work across midnight (the current same-day-only rejection in both schedulers is a product bug, not a safeguard), must be replayed if the app restarts before they fire, and must live in one store — today meal reschedules sit in AsyncStorage while habit reschedules sit server-side in `rescheduledTime` with no device path consuming them.

### B. Survival matrix (Android)

Implement a **reconciliation pass** that runs at every cold start and every foreground resume (AppState → active), plus after boot. It recomputes desired triggers from schedule intent (AsyncStorage + server habits), diffs against `notifee.getTriggerNotificationIds()`, re-arms what's missing, prunes orphans, and resolves missed occurrences. This single mechanism is the recovery path for most of the matrix below — build it first and build it well.

| Scenario | Required behavior |
|---|---|
| Reboot, trigger still in future | Fires on time. Declare `RECEIVE_BOOT_COMPLETED` in the app manifest explicitly (today it exists only via Notifee's manifest merge) and verify re-arming. |
| Reboot or power-off past a trigger's time | Notifee re-arms elapsed one-shots with a past timestamp, so they fire **immediately at boot** — a 3 a.m. ringing "incoming call" for yesterday's 8 p.m. meal is wrong. Embed the intended fire time in the notification `data`; at handling time, if it's stale beyond a threshold, suppress the call UI and show a quiet "missed reminder" notification instead, then arm the next occurrence. |
| Swipe-away from recents | Process dies, alarms survive; headless `onBackgroundEvent` must fully work (see §E). |
| Force-stop / OEM task killer (MIUI, Samsung sleeping apps, OnePlus, Huawei) | Alarms are cancelled by the OS until next launch — nothing can fire in between; the reconciliation pass recovers on next open, and missed occurrences are surfaced as missed, not dropped silently. Add best-effort OEM guidance (autostart/battery settings deep links per manufacturer) to the health surface (§H). |
| Deep Doze | Keep `allowWhileIdle` (exact even in Doze). Know the constraint: at most ~one while-idle alarm per 9 minutes per app — if a meal and habit alarm land within that window, one slips. Consider `AlarmType.SET_ALARM_CLOCK` for call-type reminders (strongest semantics, shows the lockscreen alarm icon) and justify your choice either way. |
| Battery optimization enabled | Detect via `notifee.isBatteryOptimizationEnabled()`, offer `openBatteryOptimizationSettings()`, degrade gracefully on refusal. |
| App data cleared / reinstall | Meal schedule must survive — add server-side persistence (§F). On first launch post-restore, reconcile from server. |

### C. Permissions and degraded modes (Android 13–16)

- **POST_NOTIFICATIONS**: check at every launch/resume, not just mid-flow. Denied or revoked → persistent in-app "reminders are off" state with `openNotificationSettings()` deep link. Scheduling while denied must be visibly flagged. (Note: `MealScheduleScreen` already early-returns on denial; `OnboardingMealScheduleScreen` schedules anyway; habit creation never checks — unify.)
- **Exact alarms**: the manifest currently declares both `SCHEDULE_EXACT_ALARM` and `USE_EXACT_ALARM`. `USE_EXACT_ALARM` makes `canScheduleExactAlarms()` true on all 13+ devices today, but it is Play-policy-restricted to alarm/calendar apps — **flag this as a launch-blocking policy decision and implement the compliant path**: rely on `SCHEDULE_EXACT_ALARM`, check `notifee.getNotificationSettings().android.alarm` at launch (revocation force-stops the app, so a broadcast receiver can't catch it — launch-time detection is the only reliable hook), deep-link `openAlarmPermissionSettings()`, and fall back to inexact triggers plus a visible "reminders may be a few minutes late" state when not granted. Know that a revoked grant silently terminates an established DAILY chain at its next fire — reconciliation must catch this.
- **Full-screen intent (Android 14+)**: check availability; when revoked, fall back to a high-priority heads-up notification rather than a broken call screen.
- **Channel health**: users can mute, lower, or delete channels, and channel settings are immutable after creation. Detect (`getChannel()`, blocked/importance) and prompt; keep the existing channel-id versioning pattern (`meal-call-v2` → `-v3`) when settings must change. `ensureHabitChannels` in `habitScheduler.ts` is dead code — wire it or remove it.
- **`bypassDnd` is currently a no-op** for most users: honoring it requires user-granted DND access (`ACCESS_NOTIFICATION_POLICY`), which nothing requests. Either implement the DND-access flow or stop claiming DND bypass and degrade honestly.
- **Android 14+ makes non-exempt `ongoing` notifications user-dismissible** — combined with `timeoutAfter: 60s` there are two paths to a vanished call; both must produce a missed-call record (§E).
- If you ever add a foreground service (e.g. for in-call audio), targetSdk 34+ requires a typed `foregroundServiceType` plus its companion permission — the bare `FOREGROUND_SERVICE` declaration alone will crash.

### D. Time, timezone, and clock correctness

- Recompute all epoch triggers from wall-clock intent at every reconciliation pass; this plus reconciliation-on-resume is your baseline defense. Additionally handle timezone/clock changes promptly on Android (`ACTION_TIMEZONE_CHANGED` / `ACTION_TIME_CHANGED` via a small native receiver or an equivalent RN listener) — a traveler must not get the 8 p.m. call at 3 a.m.
- DST: spring-forward (the scheduled minute may not exist; Notifee's DAILY repeat advances by fixed 24 h epochs, so it drifts an hour after transitions — your wall-clock recompute must correct it), fall-back (fire exactly once, not twice).
- Off-by-one-day: saving a schedule at exactly the reminder minute currently pushes it to tomorrow (`fire <= now`); near-midnight saves race the +1-day logic. Make boundary behavior deterministic and tested.
- Backend: `Habit.reminderTime` is a zoneless `LocalTime` and the server evaluates `LocalTime.now()`/`LocalDate.now()` in server time, so client and server can disagree on "today" near midnight or across zones. Add a user timezone field, send it from the client, and make server-side "today's habits" computations timezone-aware.

### E. Event handling and the call lifecycle

- **Registration hardening**: notification handlers (`onBackgroundEvent` at minimum) must be registered in `index.js` before `registerComponent`, outside the `try/catch` whose fallback currently registers no handlers at all — a JS bundle-load failure must not orphan a ringing, looping call notification.
- **Exactly-once semantics**: dedupe `onBackgroundEvent` vs `getInitialNotification` handling of the same notification (e.g. a processed-id registry). Note `getInitialNotification` is deprecated on iOS and double-fires there with `onForegroundEvent` — guard per platform. Remove the ~3 s cap on accept-navigation readiness; a pending accept must survive until navigation is possible.
- **Full state machine per occurrence**: ringing → accepted / declined / missed (60 s timeout or dismissed). Every terminal state updates the server (habits: no more eternal `PENDING`; add a missed/declined record), shows a missed-call follow-up notification ("You missed your meal call — log now or snooze") for missed, and never breaks the next occurrence.
- **Foreground delivery**: keep the in-app banner takeover, minus defect #2. If a reminder fires during an active Vapi call, queue or suppress it — no second ringing UI over a live call.
- **Auth guard**: notification taps must not navigate into authenticated screens after logout or during onboarding. Logout cancels all local triggers; login (including a second device) rebuilds them from server state.
- Multi-habit time slots: keep the consolidated one-call-per-slot design, and fix the stale-closure race where two rapid deletes of same-slot habits both see the other as remaining and orphan the shared `habit-call-<slot>` trigger. Cancel device triggers only after (or transactionally with) successful server deletes; surface failures.

### F. Data integrity, multi-device, and the backend

- **Meal schedule moves server-side** (model + CRUD endpoints + client sync on login/save), with AsyncStorage as the offline cache. Reinstall, data-clear (`allowBackup=false`), and second devices must converge to the server's schedule.
- Reconciliation treats divergence explicitly: storage says enabled but no trigger pending → re-arm; trigger pending but storage/server disabled → cancel; corrupted storage → rebuild from server, never crash.
- `timeSlotKey` is whitespace-and-case-naive; normalize through parsed time (canonical 24 h key), not string munging. All schedule writes (`HabitCreationScreen` currently `console.error`s scheduling failures) must surface failures to the user.

### G. iOS — best-effort parity (compile-verified; be honest about what you can't test)

- Register notification categories via `notifee.setNotificationCategories` — `ios.categoryId: 'meal-call'` is referenced today but never registered, so Accept/Decline buttons don't exist on iOS; habit notifications set no `categoryId` at all. Wire action handling: a background action press launches the app in background and delivers the event to JS — sync server state immediately, don't queue.
- Add the time-sensitive entitlement (`com.apple.developer.usernotifications.time-sensitive`) — `interruptionLevel: 'timeSensitive'` is already set in payloads but inert without it. Handle the iOS permission lifecycle: `NOT_DETERMined`/provisional/denied, re-check at launch, settings deep link. Critical alerts: treat as unavailable.
- Recurrence on iOS uses calendar semantics (Notifee discards the date portion of repeating timestamp triggers — the "schedule tomorrow" epoch logic is a harmless no-op there, but keep cross-platform intent identical). One-shots that elapse while the device is off are **dropped** on iOS (unlike Android's late delivery) — launch reconciliation covers this.
- Foreground duplicates: Notifee's default `foregroundPresentationOptions` shows an OS banner + sound on top of the in-app banner; suppress per-notification.
- Missed-call detection can't rely on DELIVERED (foreground-only on iOS): compute at next launch, or pre-schedule a companion follow-up trigger at creation time and cancel it on answer.
- `react-native-callkeep` is dead code (`setup()` never called, no calls ever reported). Decide: wire it properly behind a flag, or remove it. Recommend removal unless true CallKit UI is a product goal.
- Fix the user-visible `CFBundleDisplayName` typo: "Nutritoin Tracker".

### H. Observability and honest UX

- A **reminder-health surface** (Profile or settings): notification permission, exact-alarm grant, full-screen grant, battery optimization, channel state — each with status and a one-tap fix. This is also where degraded modes ("reminders may be inexact") are explained.
- **Zero silent failures**: every scheduling refusal, parse failure, permission gap, or reconciliation repair is at minimum logged through one structured logging path, and user-visible whenever it changes whether or when a reminder will fire.

## Scope and constraints

- **In scope**: everything above, including the listed backend additions (meal-schedule model/endpoints, user timezone, habit missed/declined state). Backend changes should be the minimum that serves reminder reliability — no broader refactors.
- **Design-only (write a short proposal, don't build)**: FCM/remote-push fallback and a server device registry; a habit edit endpoint (its absence forces delete+recreate, multiplying trigger churn — note the dependency).
- **Don't regress** the Vapi voice-call flow, the in-app banner/full-screen call UX, or existing screens beyond what these requirements demand. No drive-by refactors or formatting churn outside files you must touch.
- Keep platform guards: `alarmManager` and most of §B/§C are Android-only; never let Android-only options leak into iOS payload paths or vice versa.

## Verification — define "done"

- **Unit tests** for all pure logic: next-occurrence computation (incl. DST spring/fall, midnight saves, `repeatDays` filtering, leap day), reschedule-across-midnight, staleness classification, reconciliation diffing (desired vs pending → re-arm/prune/missed sets), time parsing/normalization. Extract this logic pure so it's testable without Notifee.
- **A manual device runbook** (commit as `frontend/NOTIFICATION_TESTING.md`) with exact adb sequences for the survival matrix: `adb shell am force-stop`, `adb reboot`, `adb shell dumpsys deviceidle force-idle`, `adb shell cmd appops` / settings toggles for each permission, timezone/clock changes via `adb shell service call alarm` or settings, plus the expected observable outcome for each row of §B/§C. Run every scenario you can on the available emulator/device and record actual results honestly — including the ones you couldn't run.
- Type-check, lint, and existing test suites pass on both `frontend/` and `backend/`.
- Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for; if something is not yet verified, say so explicitly. If tests fail, say so with the output.

## Working agreements

- You are operating with a full specification — act on it. For minor choices (naming, file placement, which of two equivalent mechanisms), pick a reasonable option and note it rather than asking. Ask only for genuine scope changes or destructive actions. The two decisions worth pausing on are flagged above: the `USE_EXACT_ALARM` Play-policy posture and CallKeep removal — make a recommendation and proceed with it unless told otherwise.
- Don't add features, abstractions, or error handling beyond what these requirements need. A reliability fix doesn't need surrounding cleanup.
- Work in priority order: P0 defects → reconciliation pass (§B) → recurrence (§A) → permissions/degraded modes (§C) → time correctness (§D) → call lifecycle (§E) → backend/data (§F) → iOS (§G) → health surface (§H). Commit in reviewable units along those seams.
- Lead your final summary with the outcome: what now survives that didn't before, what's verified versus compile-only, and the exact list of scenarios from the runbook you executed. Write it for someone who didn't watch you work — complete sentences, no shorthand from your working context.
