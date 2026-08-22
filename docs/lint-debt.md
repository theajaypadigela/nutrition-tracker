# Lint debt

`npm run lint` reports zero errors, and `react-hooks/exhaustive-deps` is configured
as an **error** — but it is switched off inline at nine sites, all of them in the
voice and incoming-call screens, which is exactly where a stale closure does the
most damage. A suppressed rule reports clean, so these sites would otherwise be
invisible to the gate.

`npm run lint:debt` counts them and fails if the number grows, if a new rule is
suppressed without a baseline, or if a count drops without
`lint-debt-baseline.json` following it down. The counts may only go down.

## Current debt: 9 suppressions

| Site | Dependency array | Why it is suppressed | Removed by |
| --- | --- | --- | --- |
| [IncomingHabitCallScreen.tsx:142](../frontend/src/screens/main/IncomingHabitCallScreen.tsx#L142) | `[]` | Ringtone/vibration setup with a matching teardown, intended to run once per mount. | Stage 6 |
| [IncomingMealCallScreen.tsx:148](../frontend/src/screens/main/IncomingMealCallScreen.tsx#L148) | `[]` | Same effect as above — the two screens are ~89% identical (X7). | Stage 6 |
| [IncomingHabitCallScreen.tsx:150](../frontend/src/screens/main/IncomingHabitCallScreen.tsx#L150) | `[autoAccept]` | Calls `handleAccept`, whose identity changes every render; including it would re-fire the accept. | Stage 6 |
| [IncomingMealCallScreen.tsx:156](../frontend/src/screens/main/IncomingMealCallScreen.tsx#L156) | `[autoAccept]` | Same as above. | Stage 6 |
| [VoiceMealLogScreen.tsx:239](../frontend/src/screens/main/VoiceMealLogScreen.tsx#L239) | `[autoStart]` | Calls `startVoiceLog` and reads `status`; including either would restart the call mid-session. | Stage 6 |
| [VoiceHabitScreen.tsx:232](../frontend/src/screens/main/VoiceHabitScreen.tsx#L232) | `[autoStart]` | Same as above, for `startVoiceCall`. | Stage 6 |
| [VoiceMealLogScreen.tsx:305](../frontend/src/screens/main/VoiceMealLogScreen.tsx#L305) | `[requestMicPermission, user?.id]` | `startVoiceLog` closes over Vapi handles and screen params that the rule wants in the array; adding them recreates the callback on every render. | Stage 6 |
| [VoiceHabitScreen.tsx:299](../frontend/src/screens/main/VoiceHabitScreen.tsx#L299) | `[requestMicPermission, user?.id, habitName, habitTime]` | Same as above, for `startVoiceCall`. | Stage 6 |
| [gluestack-ui-provider/index.tsx:22](../frontend/src/components/ui/gluestack-ui-provider/index.tsx#L22) | `[mode]` | Generated gluestack provider; `setColorScheme` is omitted upstream. | Vendor — exempt |

## Why Stage 6 and not sooner

Eight of the nine are the same two patterns duplicated across four screens:
*run-once-on-mount with cleanup*, and *fire-once-when-a-flag-flips*. Stage 6
consolidates the incoming-call screens and extracts a shared Vapi lifecycle hook
(see X7 in the refactoring plan). Fixing them in place first would mean writing
the same fix four times and then deleting three copies. The ratchet exists so the
count cannot grow in the meantime.

The gluestack provider is generated vendor UI under the same exception boundary
that `src/components/ui` has elsewhere; it is not scheduled for removal.

## Warning ratchet

`npm run lint` runs with `--max-warnings 67`, today's exact baseline, so the
warning count can only go down. The breakdown:

| Rule | Warnings |
| --- | --- |
| `react-native/no-inline-styles` | 59 |
| `@typescript-eslint/no-shadow` | 4 |
| `react/self-closing-comp` | 2 |
| `no-unused-vars` | 1 |
| `react/no-unstable-nested-components` | 1 |
