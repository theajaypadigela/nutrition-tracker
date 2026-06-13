# Notification reliability — manual device runbook

This runbook validates that reminders behave like alarm-clock alarms across the survival
matrix in `NOTIFICATION_RELIABILITY_PROMPT.md` §B/§C. Each scenario lists the exact
commands and the **expected observable outcome**.

> Status of execution: at the time these changes were authored, **no Android device or
> emulator was attached** (`adb devices` returned an empty list, and the `emulator` CLI
> was not on PATH), so none of the device scenarios below were executed here. The pure
> scheduling/recurrence/DST/staleness/reconciliation logic is covered by automated unit
> tests (`npm test`, 47 passing). Run the scenarios below on a real device before release
> and record actual results in the "Result" column.

## Setup

```bash
# Build & install a debug build
cd frontend
npm install
npm run android            # or: npx react-native run-android

# Identify the package + main activity
adb shell dumpsys package com.<yourapp> | grep -A2 "android.intent.action.MAIN"
PKG=com.habitbuilder            # adjust to the real applicationId
```

Helpful log filter (the reminder system logs through one structured path, prefix `[reminders]`):

```bash
adb logcat | grep -iE "reminders|notifee|AlarmManager|$PKG"
```

To inspect scheduled alarms held by the app:

```bash
adb shell dumpsys alarm | grep -A4 "$PKG"
```

---

## A. Permissions / degraded modes (§C)

| # | Scenario | Commands | Expected outcome | Result |
|---|----------|----------|------------------|--------|
| A1 | POST_NOTIFICATIONS denied | `adb shell cmd appops set $PKG POST_NOTIFICATION ignore` then cold-start app | Profile → Reminder health shows **Notifications: Action required** with an "Open settings" fix. Saving a meal reminder shows "Saved — but notifications are off". | |
| A2 | POST_NOTIFICATIONS granted | `adb shell cmd appops set $PKG POST_NOTIFICATION allow` then reopen | Health shows **Notifications: OK**. | |
| A3 | Exact alarm revoked | `adb shell cmd appops set $PKG SCHEDULE_EXACT_ALARM ignore` then cold-start | Health shows **Exact alarms: Needs attention** ("may be a few minutes late"); scheduler falls back to inexact (`SET_AND_ALLOW_WHILE_IDLE`). Verify via `dumpsys alarm` the alarm is windowed, not exact. | |
| A4 | Exact alarm granted | `adb shell cmd appops set $PKG SCHEDULE_EXACT_ALARM allow` | Health shows **Exact alarms: OK**; `dumpsys alarm` shows an exact/alarm-clock entry. | |
| A5 | Battery optimization ON | `adb shell dumpsys deviceidle whitelist -$PKG` (remove from whitelist) | Health shows **Battery optimization: Needs attention** with a "Fix" deep link. | |
| A6 | Battery optimization exempt | `adb shell dumpsys deviceidle whitelist +$PKG` | Health shows **Battery optimization: OK**. | |
| A7 | Channel lowered/blocked | Settings → App → Notifications → lower "Meal Logging Calls" importance | Health shows **Notification categories: Needs attention / Action required** with "Open settings". | |

---

## B. Survival matrix (§B)

| # | Scenario | Commands | Expected outcome | Result |
|---|----------|----------|------------------|--------|
| B1 | Reboot, trigger still in future | Schedule a meal call ~10 min out, then `adb reboot`. Wait for the time without opening the app. | Call fires on time after reboot (Notifee boot receiver re-arms; `RECEIVE_BOOT_COMPLETED` is declared in the app manifest). | |
| B2 | Reboot/power-off PAST a trigger | Schedule a call ~2 min out, immediately `adb reboot`, keep device off long enough that the time passes, then power on. | **No 3 a.m. ringing call.** The elapsed alarm is classified stale (>5 min late), suppressed, and a quiet "You missed your …" follow-up appears instead. The next occurrence is armed. | |
| B3 | Swipe-away from recents | Open app, swipe it from recents. Keep a scheduled call due soon. | Call still fires; tapping Accept/Decline works via the headless background handler. | |
| B4 | Force-stop, then reopen | `adb shell am force-stop $PKG`. Wait past a scheduled occurrence, then reopen the app. | While force-stopped nothing fires (OS cancels alarms). On reopen, reconciliation re-arms future triggers and surfaces the missed occurrence as a missed follow-up (not silently dropped). | |
| B5 | Deep Doze | `adb shell dumpsys deviceidle force-idle`, keep a call due soon, observe; then `adb shell dumpsys deviceidle unforce`. | Call-type reminders use `SET_ALARM_CLOCK` and fire in Doze. Note the ~1-per-9-min while-idle limit: if a meal and habit alarm land within that window one may slip. | |
| B6 | App data cleared / reinstall | `adb shell pm clear $PKG`, reopen, log in. | Meal schedule reconverges from the server (`GET /meal-schedule`); habits reconverge from `GET /habit`; reminders are re-armed. (`allowBackup=false`, so only server state restores them.) | |
| B7 | Second device | Log into the same account on a second device. | Both devices arm the same meal + habit reminders from server state. | |

---

## C. Time / timezone / DST (§D)

| # | Scenario | Commands | Expected outcome | Result |
|---|----------|----------|------------------|--------|
| C1 | Timezone travel | `adb shell setprop persist.sys.timezone America/New_York` then resume the app (it reconciles on AppState→active). | The 8 p.m. call fires at 8 p.m. **local**, not at the old zone's 8 p.m. The resume reconciliation recomputes epochs from wall-clock intent. | |
| C2 | Manual clock change | Settings → System → Date & time → set time forward past a trigger, reopen app. | Stale fires are suppressed/marked missed; future triggers re-armed at the correct wall-clock minute. | |
| C3 | DST spring-forward (logic) | Covered by unit tests (`scheduleIntent.test.ts`, `time.test.ts`): a daily 8 a.m. reminder keeps firing at 8 a.m. local across the transition (no 1-hour drift). | Tests pass. | |
| C4 | Near-midnight save | Save a 00:05 reminder at 23:59. | Fires at 00:05 the next calendar day (deterministic; covered by `scheduleIntent.test.ts`). | |

---

## D. Call lifecycle (§E)

| # | Scenario | Commands | Expected outcome | Result |
|---|----------|----------|------------------|--------|
| D1 | Answer / decline doesn't wipe reminders | Trigger a meal call, Accept it (or Decline). Then check `adb shell dumpsys alarm \| grep $PKG`. | The DAILY meal trigger is **still scheduled** afterward (display-only cancellation; P0 #1/#2). | |
| D2 | 60s ring timeout while killed | Force-stop the app, let a call fire and go unanswered for >60s, reopen. | A missed follow-up is shown on reopen (pending-answer marker expired → recorded missed). Habit calls also report MISSED to the server (no eternal PENDING). | |
| D3 | Cold-start Accept dedupe | Kill the app, tap **Accept** on a fired call. | Exactly one Vapi session starts (background handler + getInitialNotification dedupe via the processed-action registry; P0 #5). | |
| D4 | Reschedule across midnight | During a call near midnight, ask to be called back in N minutes that crosses midnight. | The reschedule is armed for the correct absolute time the next day and replays if the app restarts first (persisted in the reschedule store). | |
| D5 | Habit fires more than once | Create a daily habit call; let it fire today; confirm it fires again tomorrow. | Recurs (native DAILY repeat + reconciliation re-arm), unlike the previous one-shot behavior (P0 #3). | |
| D6 | Two rapid same-slot habit deletes | Create two call habits at the same time; delete both quickly. | The shared slot trigger is correctly pruned (server delete first, then reconcile — no stale-closure orphan; §E). | |
| D7 | Logout / login | Log out. | All local triggers cancelled (`dumpsys alarm` shows none for the app). Logging back in rebuilds them from server state. | |

---

## E. iOS (compile-verified only)

No iOS build exists in this repo (no `Podfile.lock`), so the following are **not** runtime-verified:

- Accept/Decline action buttons (categories registered via `setNotificationCategories`).
- Time-Sensitive delivery (entitlement file added; must be linked via `CODE_SIGN_ENTITLEMENTS` in Xcode).
- Foreground duplicate suppression (`foregroundPresentationOptions`).
- Elapsed one-shots are dropped on iOS; launch reconciliation surfaces them as missed.

Run these on a physical iOS device once a build pipeline exists.
