# Incoming Call Service Implementation

This document explains how incoming call reminders are implemented in the frontend app, with emphasis on call notifications and ringtone behavior.

## Scope

- Meal voice reminder calls (`IncomingMealCall`)
- Habit voice reminder calls (`IncomingHabitCall`)
- Notifee notification lifecycle (scheduled, delivered, pressed, action buttons)
- In-app banner and full-screen incoming call UI
- Ringtone and vibration lifecycle

## Main Implementation Files

- `src/App.tsx`
  - Registers Notifee background and foreground handlers
  - Handles cold start (`getInitialNotification`)
  - Shows in-app banner and routes to full-screen call UI
- `src/services/notifee.bootstrap.ts`
  - Creates notification channels at app boot
- `src/services/mealScheduler.ts`
  - Schedules meal call notifications
- `src/services/habitScheduler.ts`
  - Schedules habit call notifications
- `src/hooks/useIncomingCall.ts`
  - Central accept/decline handlers
  - Notification cleanup, ringtone stop, vibration cancel, navigation
- `src/hooks/useRingtone.ts`
  - Singleton ringtone start/stop logic via `react-native-sound`
- `src/components/IncomingCallBanner.tsx`
  - Foreground in-app mini incoming-call UI
- `src/components/IncomingCallScreen.tsx`
  - Full-screen incoming-call UI
- `src/navigation/AppNavigator.tsx`
  - Defines `IncomingMealCall` and `IncomingHabitCall` routes

## Notification Channel Setup

At app startup, `setupNotifeeChannels()` is called from `App.tsx`.

Channels created in `notifee.bootstrap.ts`:

- `meal-call-v2` for meal incoming call notifications
- `habit-call-v1` for habit incoming call notifications
- `habit-push-v1` for standard non-call habit reminders

Call channels are configured with high importance, public visibility, vibration, sound, and `bypassDnd`.

## How Call Notifications Are Scheduled

### Meal calls (`mealScheduler.ts`)

Scheduled notification IDs:

- Daily: `meal-alarm-daily`
- Reschedule: `meal-reschedule-once`

Notification payload includes:

- `data.screen = IncomingMealCall`
- `data.mealSlotId` (`daily` or `rescheduled`)

Android call-style options include:

- `category: CALL`
- `fullScreenAction`
- action buttons: `Accept` and `Decline`
- `ongoing: true`, `loopSound: true`, `autoCancel: false`, `timeoutAfter: 60000`

### Habit calls (`habitScheduler.ts`)

For call-type habits, notifications are consolidated by reminder time:

- Base: `habit-call-${timeSlotKey(reminderTime)}`
- Reschedule: `habit-reschedule-call-${timeSlotKey(reminderTime)}`

Notification payload includes:

- `data.screen = IncomingHabitCall`
- `data.habitTime`
- optional `habitId` and `habitName` for non-consolidated paths

Android call-style options mirror meal call behavior (CALL category, full-screen action, action buttons, looping call-style sound/vibration settings).

## Runtime Notification Handling (`App.tsx`)

### 1) Background / killed app action handling

`notifee.onBackgroundEvent` handles action presses when app is backgrounded or killed.

- For `accept`:
  - calls `handleAcceptCall(payload, { skipNavigation: true })`
  - stores `pendingAcceptNavigation` for route handoff when app becomes active
- For `decline`:
  - calls `handleDeclineCall(payload, { skipNavigation: true })`

When app resumes (`AppState` changes to `active`), pending navigation pushes to:

- `VoiceMealLog` for meal calls
- `VoiceHabit` for habit calls

### 2) Cold start handling

`notifee.getInitialNotification()` handles launch caused by tapping notification or action buttons.

- If action was `accept`, shared accept handler runs immediately.
- Otherwise, app resets stack and navigates to `IncomingMealCall` or `IncomingHabitCall` full-screen UI.

### 3) Foreground handling

`notifee.onForegroundEvent` handles three key event types:

- `DELIVERED`
  - call notifications are canceled immediately
  - custom in-app `IncomingCallBanner` is shown (to avoid duplicate OS + custom UI)
- `PRESS`
  - navigates to full-screen incoming call screen
- `ACTION_PRESS` (`accept` / `decline`)
  - dispatches to shared handlers

## In-App Incoming Call UI Layers

### Banner (`IncomingCallBanner.tsx`)

Used for foreground call delivery.

Behavior when visible:

- slide-in animation
- starts ringtone (`startRingtone()`)
- starts vibration
- auto-declines after 30 seconds (`AUTO_DISMISS_MS = 30000`)

Behavior when hidden:

- slide-out animation
- clears timers
- vibration cleanup is handled unless handoff to full-screen is in progress

### Full-screen (`IncomingCallScreen.tsx`)

Used when:

- user taps notification
- user expands banner
- app is opened into incoming call route

Behavior on mount:

- stores `notificationId` via `setActiveCallNotificationId`
- starts ringtone
- starts vibration pattern

Behavior on unmount:

- cancels vibration timers/pattern

Accept/decline buttons call shared handlers from `useIncomingCall.ts`.

## Shared Accept / Decline Handlers (`useIncomingCall.ts`)

Centralized logic ensures consistent cleanup regardless of where action originates (banner, full-screen screen, notification buttons, cold start, background).

Common sequence in both handlers:

1. hide banner
2. cancel active call notification(s)
3. stop ringtone
4. cancel vibration
5. invoke optional CallKeep action
6. navigate (unless `skipNavigation`)

Notification cleanup:

- cancels the specific `notificationId` if available
- falls back to tracked `activeCallNotificationId`
- then runs `notifee.cancelAllNotifications()` as a safety net

CallKeep behavior:

- `react-native-callkeep` is loaded only on iOS in this implementation
- if methods are unavailable, handlers continue without failing

Navigation after accept:

- Meal call -> `VoiceMealLog` (`autoStart: true`)
- Habit call -> `VoiceHabit` (`autoStart: true`)

Navigation after decline:

- go back if possible
- otherwise navigate to `MainTabs`

## Ringtone Implementation (`useRingtone.ts`)

Ringtone playback uses `react-native-sound` with a module-level singleton:

- `ringtone: Sound | null`
- prevents duplicate starts if already playing

Start logic:

- `Sound.setCategory('Playback', true)`
- loads `ringtone.mp3` from `Sound.MAIN_BUNDLE`
- loops forever (`setNumberOfLoops(-1)`)

Stop logic:

- `ringtone.stop(...)`
- releases native resource (`release()`)
- clears singleton reference

Where ringtone starts:

- `IncomingCallBanner` when banner becomes visible
- `IncomingCallScreen` on mount

Where ringtone stops:

- `handleAcceptCall`
- `handleDeclineCall`

## Ringtone Asset Requirement

The code expects `ringtone.mp3` to exist in the native main bundle.

If the asset is missing:

- `new Sound(...)` returns an error
- ringtone reference is reset to `null`
- call flow still works, but custom ringtone audio does not play

## End-to-End Flow Summary

1. Scheduler creates call-style Notifee notification (meal/habit).
2. App receives Notifee event.
3. If app is foreground:
   - native notification is canceled
   - custom banner is shown
   - ringtone/vibration starts
4. User accepts/declines from banner, full-screen, or notification action.
5. Shared handlers run cleanup and route navigation.
6. Ringtone and vibration are always stopped in shared handlers.

## Operational Notes

- `activeCallNotificationId` is tracked to clean up notifications from multiple entry points.
- `cancelAllNotifications()` in shared handlers is intentional safety behavior for sticky call notifications.
- Meal accept path clears stored meal reschedule timestamp (`clearMealRescheduleTime`).
