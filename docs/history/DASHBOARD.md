# Dashboard Screen Overview

This document explains how the dashboard works from the frontend side in the React Native app.

## Purpose

The dashboard is the first screen shown in the main tab flow. It gives the user a quick view of:

- the selected day on the calendar
- habit completion progress for that day
- food intake totals for that day
- a bottom drawer with detailed habits and food log entries

## Where It Lives

- Screen component: [frontend/src/screens/main/DashBoardScreen.tsx](src/screens/main/DashBoardScreen.tsx)
- Tab entry: [frontend/src/navigation/MainTabNavigator.tsx](src/navigation/MainTabNavigator.tsx)
- Dashboard response type: [frontend/src/types/types.ts](src/types/types.ts)

## Frontend Data Flow

1. The screen starts with today's date in `selectedDate`.
2. Whenever the selected date changes, the screen calls `GET /dashboard/{date}` through `apiClient`.
3. The response is stored in `dashboardData`.
4. The UI derives totals and lists from that response and renders them immediately.
5. Pull-to-refresh reuses the same request to reload the current date.

The response shape used by the screen is:

- `date`
- `foodSummary`
- `habits`

## Main UI Sections

### Calendar

The calendar comes from `react-native-calendars`.

- Tapping a day sets `selectedDate`
- The same tap also opens the bottom drawer
- Extra days are hidden to keep the layout compact

### Habit Progress Card

This card is calculated entirely on the frontend from the `habits` array.

- `completedHabits` counts items where `completed === true`
- `totalHabits` is the length of the array
- `habitProgress` is rendered as a percentage and as a progress bar

The card also includes a plus button that navigates to `HabitCreation`.

### Food Summary Card

This card reads totals from `dashboardData.foodSummary.totals`.

- calories
- protein
- carbs
- fat

If the API has not loaded yet, the component falls back to zero values so the UI remains stable.

## Bottom Drawer Behavior

The drawer opens when a calendar day is pressed.

It contains:

- the formatted date label
- a habit list with completed and incomplete icons
- a food log summary header
- a compact macro breakdown row
- the food log entries for the selected day

The drawer is anchored to the bottom and can be closed with the close button or by dismissing the backdrop.

## Local Formatting Logic

The screen keeps formatting logic close to the UI:

- `formatDate()` converts the selected ISO date into `Today`, `Yesterday`, or a long date string
- `getOrdinal()` renders dates like `1st`, `2nd`, `3rd`, `4th`
- macro values are rounded before display so the cards stay visually clean

## Loading And Refreshing

The screen uses a standard `RefreshControl` inside the `ScrollView`.

- dragging down triggers `handleRefresh()`
- refresh calls the same fetch function used by the date effect
- there is no separate loading screen; the current dashboard stays visible while refreshing

## Navigation Hooks

The dashboard connects into the main tab navigator as the `Home` tab.

From the dashboard, the user can:

- open habit creation from the plus button
- switch to Habits, Food, Reports, or Profile using the bottom navigation

## Frontend Notes

- The screen is intentionally presentation-heavy and keeps the data transformation small.
- Most derived values are computed with `useMemo` or plain local helpers for readability.
- The dashboard depends on the backend response being shaped correctly, but the frontend provides safe fallbacks for empty or missing data.
- The current implementation opens the drawer on every date tap, even if the selected date is already active.

## Common Extension Points

If this screen needs to evolve, the usual frontend changes are:

- add more summary cards to the main scroll view
- add empty states for days with no habits or food logs
- highlight the selected calendar day
- add loading skeletons for the dashboard cards
- make the drawer content filter by the selected date if the backend response becomes multi-day
