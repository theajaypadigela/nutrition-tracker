# UI Redesign Audit

This document is the implementation checklist for the frontend redesign. It focuses on the current UI/UX problems in the app and the specific fixes needed to make the experience consistent, clearer, and easier to extend screen by screen.

## Scope

Reviewed screens and route surfaces:

- Auth: Login, Register, Developer Settings
- Onboarding: Meal Schedule
- Main tabs: Dashboard, Habits, Habit Creation, Food Log, Nutrition Report, Profile
- Nested screens: Manual Food Log, Voice Meal Log, Voice Habit
- Overlays and modals: Incoming Meal Call, Incoming Habit Call
- Shared layout components that affect multiple screens: AppBar, BottomNavigation, MealGroup, FoodItem, NutritionDisplay, CaloriesSummaryCard, report cards, VoiceSessionScreen

## Design Direction

The app should move to a single design language instead of screen-by-screen styling.

### Visual System

- Base background: white for every surface
- Primary action color: emerald
- Secondary info color: blue
- Warning color: amber
- Destructive color: red
- Surfaces: white cards with subtle borders and light shadows
- Corners: one consistent radius system across the app
- Shadows: restrained and used only for elevation, not decoration

### Typography

- Use one hierarchy across the app
- Large titles for screen headers, medium titles for card sections, regular body text for content
- Labels should always sit above inputs
- Avoid mixing too many font weights on the same screen
- Use consistent capitalization rules for labels, helper text, and empty states

### Layout and Spacing

- Screen padding should be consistent across all main screens
- Card padding should be uniform
- Button heights and touch targets should be standardized
- Every action row should be aligned to a common rhythm
- Empty states, loading states, and errors should all use the same component language

### Core Interaction Rules

- Every async action needs a visible loading state
- Every destructive action needs confirmation or undo
- Every empty screen needs a clear CTA
- Every modal or overlay needs a clear dismissal path
- Every icon-only control must have a large tap target and a clear affordance

## Global Problems To Fix First

These are the issues that affect multiple screens and should be standardized before individual screen polish.

- Loading feedback is inconsistent. Some screens use text only, some use spinners, and some have no loading state at all.
- Empty states are missing on several primary screens.
- Button sizes, tap targets, and icon buttons are too inconsistent.
- Form fields do not all follow the same label, placeholder, and error pattern.
- Some screens rely on native styling while others use the app UI components, which creates visual drift.
- Success and error messaging are handled differently across flows.
- Calendar, select, and date/time picker interactions are not visually aligned across the app.
- The app uses multiple styles for cards, banners, and progress indicators.

## Screen-by-Screen Audit

### Auth Flow

#### Login

Current issues:

- The form relies on inline text feedback and does not show a strong loading state.
- Error messages stay visible until the user manually changes input.
- The developer bypass is exposed in the UI flow and feels like a hardcoded shortcut.
- There is no dedicated forgot-password flow.
- The screen lacks a more intentional form hierarchy and visual rhythm.

Required UI improvements:

- Add a proper loading state for the submit button and disable all actions while logging in.
- Auto-clear validation and login errors when the user edits the related field.
- Replace the developer bypass with a hidden environment-based path or remove it from the normal login experience.
- Add a visible forgot-password action below the password field.
- Standardize the form card with stronger spacing, clearer input labels, and consistent field styling.

#### Register

Current issues:

- The screen asks for too much information at once.
- There is no sense of progress or grouping, so the form feels heavy.
- The gender selector is functional but visually flat.
- Success handling is not communicated to the user in a polished way.
- The screen still uses the same basic single-column form pattern as login, which makes the whole auth flow feel repetitive.

Required UI improvements:

- Split registration into two steps or at least group the fields into clear sections.
- Add a progress indicator for the form flow.
- Use stronger visual affordances for selects and required fields.
- Add a polished success state or success transition after submission.
- Keep the main CTA fixed and prominent, with a loading state while registering.

#### Developer Settings

Current issues:

- The screen uses a different visual style than the rest of the app.
- It is more text-heavy than the other settings screens and feels less integrated.
- The custom URL state is not visually obvious enough when saved.
- The clear action is always present when it should be conditional.

Required UI improvements:

- Align this screen to the same card, header, and spacing system used elsewhere.
- Show clear saved-state feedback for the active URL.
- Only show destructive actions when they are relevant.
- Make the header and back navigation feel native to the app, not like a separate utility screen.

### Onboarding

#### Meal Schedule

Current issues:

- The onboarding screen is functional but visually minimal.
- The date/time picker behavior is inconsistent across platforms.
- The screen does not feel like part of a guided onboarding journey.
- The copy is informative, but the visual layout does not support the message strongly enough.

Required UI improvements:

- Add a stronger onboarding hero section with an icon or illustration.
- Normalize the time picker interaction so it behaves consistently on iOS and Android.
- Add a step indicator or clear onboarding context.
- Keep the skip action secondary but visible.
- Make the continue action feel like a transition into the product, not just a settings save.

### Main Tabs

#### Dashboard

Current issues:

- The calendar is visually dominant, but selected-date feedback is not strong enough.
- The page has no robust empty state for days with no habits or food.
- The wording around habits is too generic for different dates.
- The add-habit action is small and easy to miss.
- The drawer content is useful, but the open/close state does not feel polished.

Required UI improvements:

- Make selected date state much more obvious in the calendar.
- Add empty states for both habits and food sections.
- Rename titles so they match the selected date context.
- Turn the habit add action into a more visible control.
- Improve drawer backdrop, motion, and hierarchy so it feels like a deliberate layer.

#### Habits

Current issues:

- The list lacks an empty state.
- Toggle feedback is too subtle for a habit completion action.
- Delete is too easy and does not protect the user from accidental removal.
- Completed and pending habits are not visually distinct enough.
- Reminder type and status are conveyed with small text and tiny icons that are easy to miss.

Required UI improvements:

- Add an empty state with a strong create-habit CTA.
- Use immediate optimistic feedback for completion toggles.
- Add confirmation or undo for delete.
- Make completed habits visibly different from pending ones.
- Improve the progress summary so it reads as a complete status card, not just a count.

#### Habit Creation

Current issues:

- The day-of-week selector is compact but not especially readable.
- Quick-select presets are useful, but the hierarchy is not strong enough.
- Time selection is still platform-specific and visually separate from the rest of the form.
- Reminder type selection is clear enough functionally, but the design is too plain for such an important decision.
- The summary at the bottom appears only when the form is valid, which makes the screen feel inconsistent.

Required UI improvements:

- Rework the day selector into a clearer grouped control.
- Make quick presets visually distinct and place them closer to the day controls.
- Standardize the time picker presentation.
- Upgrade reminder type into a more obvious card or pill selection.
- Add a stronger save state with loading and success feedback.

#### Food Log

Current issues:

- Empty content is not handled clearly.
- Meal sections can feel dense and the expand/collapse interaction is not visually obvious enough.
- Nutrition totals compete with each other instead of building a hierarchy.
- The two floating actions are useful, but they are not presented as a coherent action cluster.
- Edit and delete controls are small for mobile use.

Required UI improvements:

- Add a clear empty state with a direct log-food CTA.
- Improve the meal group headers so the expand affordance is unmistakable.
- Rebuild the nutrition summary as a stronger hero card.
- Make manual log and voice log actions feel like a paired entry point.
- Increase tap targets for item actions and consider swipe actions with undo.

#### Nutrition Report

Current issues:

- Loading is improved compared with other screens, but the overall section hierarchy still feels fragmented.
- AI insights and fallback insights are not clearly distinguished enough.
- The report has a lot of data density without a strong visual path for the eye.
- The micro-nutrient list depends on horizontal scrolling, which is easy to miss.
- There is no obvious date-range control at the screen level.

Required UI improvements:

- Create a stronger top-level report summary hierarchy.
- Clearly label AI-generated insights versus fallback recommendations.
- Add a visible date-range selector.
- Make the micro-nutrient section look intentionally scrollable.
- Consider a stronger empty state when the selected date range has no meaningful data.

#### Profile

Current issues:

- The profile mode changes are subtle and not visually obvious enough.
- The avatar is static and does not communicate a personal profile state.
- The meal reminder row looks like a separate settings item rather than part of the profile flow.
- Logout is available but not treated as a high-attention action.
- Save and cancel states are functional but not styled as a strong edit flow.

Required UI improvements:

- Make view mode and edit mode look obviously different.
- Promote the profile identity area with stronger hierarchy.
- Turn settings rows into a consistent settings list pattern.
- Style logout as a clear destructive action with confirmation.
- Add a more complete account section if profile is meant to be a true settings hub.

### Nested and Secondary Screens

#### Manual Food Log

Current issues:

- The form is long and relies on scrolling without a strong first-error focus pattern.
- Success feedback is easy to miss once the user scrolls.
- The meal type and unit inputs are usable but not especially polished.
- The layout is dense for a data-entry screen that needs speed.

Required UI improvements:

- Move to a stronger form-card layout with better section separation.
- Focus the first invalid field on validation failure.
- Replace inline success messaging with a more visible success pattern.
- Make select fields feel more intentional and easier to scan.

#### Voice Meal Log

Current issues:

- The voice session experience is functional but still feels technical.
- The user cannot easily review what happened after the call in a structured way.
- Error states are generic.
- There is no obvious summary or verification step before the user returns to Food Log.

Required UI improvements:

- Add a post-call summary or review step.
- Make error and retry states friendlier and more explicit.
- Use a clearer success completion state that confirms what was logged.
- Make the transition back into the food log feel like part of one flow.

#### Voice Habit

Current issues:

- The screen is trying to support multiple habits at once, but the UI does not clearly show that complexity.
- The result state is not strongly differentiated.
- Fallback behavior for failed interpretation is not visually robust enough.
- The voice interaction is still too text-centric for a high-trust confirmation flow.

Required UI improvements:

- Show which habit or habits are being checked in a more explicit way.
- Add a manual fallback path when interpretation is uncertain.
- Make completion, reschedule, and miss states look distinct.
- Use stronger confirmation messaging before leaving the screen.

### Overlays and Call Screens

#### Incoming Meal Call and Incoming Habit Call

Current issues:

- The screen is visually strong but still very similar between meal and habit calls.
- The affordance hierarchy is simple, but there is little context beyond accept or decline.
- The overlay is functional, but the interaction is abrupt.

Required UI improvements:

- Make meal and habit calls more clearly differentiated.
- Add stronger contextual copy for the reason the call is happening.
- Keep accept and decline as the main actions, but refine the supporting hierarchy and motion.
- Ensure the incoming screen still feels consistent with the rest of the app brand.

### Shared Layout and Component Issues

#### AppBar

Current issues:

- The app bar is visually consistent, but the action area is sometimes underused.
- Some screens still rely on custom headers instead of the shared header pattern.

Required UI improvements:

- Standardize all main screens on the shared app bar pattern.
- Use the action slot more intentionally for settings, profile, or contextual actions.

#### BottomNavigation

Current issues:

- The active tab is visible, but the control still feels slightly generic.
- The experience would benefit from stronger active-state emphasis and cleaner spacing.

Required UI improvements:

- Keep the shared tab bar as the standard for all main tabs.
- Strengthen active-state contrast and interaction feedback.
- Make sure the tab bar remains visually balanced across devices.

#### FoodItem and MealGroup

Current issues:

- Action buttons are too small.
- The information hierarchy inside each card is good enough functionally, but not polished.
- The meal groups need stronger collapse and expansion cues.

Required UI improvements:

- Increase action hit areas.
- Give meal sections a clearer header hierarchy.
- Make the card system feel like one unified component family.

#### NutritionDisplay and CaloriesSummaryCard

Current issues:

- These components use different visual weights and different hierarchy rules.
- Nutrition information is split into multiple presentation styles.

Required UI improvements:

- Standardize all nutrition summary components into one card language.
- Use one definition for headline values, supporting values, and progress bars.

#### Report Cards and Insight Badges

Current issues:

- Report cards have useful content, but their spacing, borders, and colors are not fully unified.
- Insight badges rely on color, but the surrounding structure is still lightweight.

Required UI improvements:

- Make all report cards feel like part of the same family.
- Use consistent iconography, spacing, and typography.
- Keep insight states readable without depending only on color.

#### VoiceSessionScreen

Current issues:

- This component is a strong base, but it still reads like a technical session view rather than a polished consumer feature.
- Transcript bubbles and status states are better than the rest of the app, which makes the mismatch with other screens more obvious.
- The timer, status, and primary control hierarchy should be the reference pattern for all voice flows.

Required UI improvements:

- Keep using this component as the shared voice shell.
- Make sure both voice screens align to the same states, labels, and button language.
- Preserve the transcript bubble styling as the baseline for conversational UI.

## Consistency Rules For Future Screen Updates

Use these rules when implementing screens one at a time:

- Every screen needs a clear top-level title and one dominant primary action.
- Every card should use the same border radius, padding, and spacing rhythm.
- Every form should use labels above fields, with helper text and errors below.
- Every loading state should use the same spinner and tone.
- Every destructive action should be treated as dangerous.
- Every empty state should explain what to do next.
- Every icon-only action should be at least 44 by 44 points.
- Every screen should feel like it belongs to the same product family, not a different template.

## Recommended Implementation Order

1. Shared design system primitives: cards, buttons, inputs, empty states, banners, loading states
2. Auth flow: Login, Register, Developer Settings
3. Main navigation chrome: AppBar and BottomNavigation refinements
4. Food and habit core screens: Dashboard, Habits, Food Log, Manual Food Log, Habit Creation
5. Profile and settings: Profile, Meal Schedule, Onboarding Meal Schedule
6. Voice and call flows: Incoming call screens, Voice Meal Log, Voice Habit, VoiceSessionScreen polish
7. Reports: Nutrition Report and the report card family

## Outcome Target

After these changes, the app should feel like one cohesive product with:

- one card system
- one form system
- one button system
- one loading and empty-state language
- one navigation shell
- one voice interaction style

That is the baseline to use before implementing each screen individually.
