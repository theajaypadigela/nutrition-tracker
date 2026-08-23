/**
 * Turns schedule intent into a concrete desired-trigger set and arms it via Notifee.
 *
 * Recurrence strategy (cap-aware, §A/§B):
 *  - Daily reminders (meal; habits repeating every day) arm ONE native DAILY-repeating
 *    trigger. The OS re-arms it automatically, so it survives normal process death.
 *  - Weekly habits (a subset of weekdays) arm one native WEEKLY-repeating trigger per
 *    selected weekday. WEEKLY repeats every 7 days, staying on that weekday.
 *  - Reschedules arm a single one-shot trigger.
 * Reconciliation re-arms everything from wall-clock intent on launch/resume, which both
 * recovers force-stopped alarms and corrects DST epoch drift.
 *
 * Platform pending-trigger caps are respected: Android allows 50 pending triggers. We
 * cap arming and LOG any overflow (never silently truncate, §H).
 */

import notifee from '@notifee/react-native';
import { Habit } from '@/types/types';
import { reminderLog } from './logger';
import { DAY_CODES_SUNDAY_FIRST, DayCode } from '@/utils/dayCode';
import { canonicalSlotKey, parseClockTime, WallClockTime } from './clockTime';
import {
  ScheduleIntent,
  dailyRecurrence,
  weeklyRecurrence,
  nextOccurrence,
} from './scheduleIntent';
import { normalizeWeekdayCode } from './time';
import {
  MEAL_DAILY_ID,
  habitCallDailyId,
  habitCallWeeklyId,
  habitPushDailyId,
  habitPushWeeklyId,
} from './ids';
import { DesiredTrigger } from './reconcileDiff';
import {
  buildReminderNotification,
  buildTrigger,
  ReminderKind,
  RepeatMode,
} from './notificationBuilder';
import { MealSchedule } from './mealScheduleStore';
import { RescheduleEntry } from './rescheduleStore';

/** Soft cap below Android's hard limit of 50 pending triggers, leaving headroom. */
export const MAX_PENDING_TRIGGERS = 48;

export type ArmSpec = {
  id: string;
  kind: ReminderKind;
  fireAt: number;
  repeat: RepeatMode;
  isCall: boolean;
  slotKey?: string;
  habit?: { habitId?: string; habitName?: string; habitTime?: string };
  isReschedule?: boolean;
};

export type DesiredPlan = {
  desired: DesiredTrigger[];
  specs: Map<string, ArmSpec>;
  /** Habits whose reminderTime could not be parsed (surfaced, never scheduled at 8am). */
  unparseableHabits: { habitId: string; habitName: string; reminderTime: string }[];
};

export type DesiredInput = {
  meal: MealSchedule;
  habits: Habit[];
  reschedules: RescheduleEntry[];
  nowEpoch: number;
  timeZone: string;
};

function allWeekdays(days: Set<DayCode>): boolean {
  return DAY_CODES_SUNDAY_FIRST.every(c => days.has(c));
}

function addArmSpec(plan: DesiredPlan, spec: ArmSpec): void {
  plan.specs.set(spec.id, spec);
  plan.desired.push({ id: spec.id, fireAt: spec.fireAt });
}

/**
 * Computes the full desired trigger set from intent. Pure with respect to Notifee
 * (only reads the inputs); side effects happen in `applyPlan`.
 */
export function computeDesiredTriggers(input: DesiredInput): DesiredPlan {
  const plan: DesiredPlan = {
    desired: [],
    specs: new Map(),
    unparseableHabits: [],
  };

  // ── Meal: single daily call ────────────────────────────────────────────────
  if (input.meal.enabled) {
    const intent: ScheduleIntent = {
      time: { hour: input.meal.hour, minute: input.meal.minute },
      recurrence: dailyRecurrence(),
    };
    const fireAt = nextOccurrence(intent, input.nowEpoch, input.timeZone);
    if (fireAt != null) {
      addArmSpec(plan, {
        id: MEAL_DAILY_ID,
        kind: 'meal-call',
        fireAt,
        repeat: 'daily',
        isCall: true,
      });
    }
  }

  // ── Habits ─────────────────────────────────────────────────────────────────
  // Call-type habits consolidate per canonical time slot; push-type stay per-habit.
  const callSlots = new Map<
    string,
    { days: Set<DayCode>; sample: Habit }
  >();

  for (const habit of input.habits) {
    const parsed = parseClockTime(habit.reminderTime);
    if (!parsed) {
      plan.unparseableHabits.push({
        habitId: habit.id,
        habitName: habit.name,
        reminderTime: habit.reminderTime,
      });
      reminderLog.warn('parse.failed', 'Habit has an unparseable reminderTime', {
        habitId: habit.id,
        reminderTime: habit.reminderTime,
      });
      continue;
    }
    // Only 'call' and 'notification' habits carry a reminder; anything else (e.g. 'none').
    // Log it: this was the one habit gate that skipped silently, so a malformed/legacy
    // reminderType (null, 'none', an unexpected string) dropped the habit with no trace —
    // indistinguishable from "working" in the logs. Now it surfaces like the other gates.
    if (habit.reminderType !== 'call' && habit.reminderType !== 'notification') {
      reminderLog.warn('habit.invalid_type', 'Habit has an unsupported reminderType; skipping', {
        habitId: habit.id,
        reminderType: habit.reminderType,
      });
      continue;
    }

    const days = normalizeRepeatDays(habit.repeatDays);
    if (days.size === 0) {
      reminderLog.warn('habit.no_days', 'Habit has no valid repeatDays; skipping', {
        habitId: habit.id,
        repeatDays: habit.repeatDays,
      });
      continue;
    }

    if (habit.reminderType === 'call') {
      const key = canonicalSlotKey(habit.reminderTime)!;
      const existing = callSlots.get(key);
      if (existing) {
        days.forEach(d => existing.days.add(d));
      } else {
        callSlots.set(key, { days: new Set(days), sample: habit });
      }
    } else {
      armHabitRecurrence(plan, {
        days,
        time: parsed,
        nowEpoch: input.nowEpoch,
        timeZone: input.timeZone,
        kind: 'habit-push',
        dailyId: habitPushDailyId(habit.id),
        weeklyId: wd => habitPushWeeklyId(habit.id, wd),
        slotKey: key24(parsed),
        habit: { habitId: habit.id, habitName: habit.name, habitTime: habit.reminderTime },
      });
    }
  }

  for (const [slotKey, slot] of callSlots) {
    armHabitRecurrence(plan, {
      days: slot.days,
      time: parseClockTime(slot.sample.reminderTime)!,
      nowEpoch: input.nowEpoch,
      timeZone: input.timeZone,
      kind: 'habit-call',
      dailyId: habitCallDailyId(slotKey),
      weeklyId: wd => habitCallWeeklyId(slotKey, wd),
      slotKey,
      habit: { habitTime: slot.sample.reminderTime },
    });
  }

  // ── Reschedules: one-shot, future only ──────────────────────────────────────
  for (const r of input.reschedules) {
    if (r.fireAt <= input.nowEpoch) continue;
    addArmSpec(plan, {
      id: r.id,
      kind: r.kind,
      fireAt: r.fireAt,
      repeat: 'none',
      isCall: r.kind !== 'habit-push',
      slotKey: r.slotKey,
      habit: r.habit,
      isReschedule: true,
    });
  }

  // ── Cap guard (no silent truncation) ────────────────────────────────────────
  if (plan.desired.length > MAX_PENDING_TRIGGERS) {
    const dropped = plan.desired
      .sort((a, b) => a.fireAt - b.fireAt)
      .slice(MAX_PENDING_TRIGGERS);
    for (const d of dropped) {
      plan.specs.delete(d.id);
    }
    plan.desired = plan.desired.slice(0, MAX_PENDING_TRIGGERS);
    reminderLog.warn(
      'schedule.cap_exceeded',
      `Desired triggers exceeded ${MAX_PENDING_TRIGGERS}; armed the soonest and dropped ${dropped.length}`,
      { dropped: dropped.map(d => d.id) },
    );
  }

  return plan;
}

function key24(time: WallClockTime): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

function normalizeRepeatDays(raw: string[] | undefined): Set<DayCode> {
  const out = new Set<DayCode>();
  for (const r of raw ?? []) {
    const code = normalizeWeekdayCode(r);
    if (code) out.add(code);
  }
  return out;
}

function armHabitRecurrence(
  plan: DesiredPlan,
  args: {
    days: Set<DayCode>;
    time: WallClockTime;
    nowEpoch: number;
    timeZone: string;
    kind: ReminderKind;
    dailyId: string;
    weeklyId: (wd: DayCode) => string;
    slotKey: string;
    habit: { habitId?: string; habitName?: string; habitTime?: string };
  },
): void {
  const isCall = args.kind !== 'habit-push';

  if (allWeekdays(args.days)) {
    const intent: ScheduleIntent = { time: args.time, recurrence: dailyRecurrence() };
    const fireAt = nextOccurrence(intent, args.nowEpoch, args.timeZone);
    if (fireAt != null) {
      addArmSpec(plan, {
        id: args.dailyId,
        kind: args.kind,
        fireAt,
        repeat: 'daily',
        isCall,
        slotKey: args.slotKey,
        habit: args.habit,
      });
    }
    return;
  }

  for (const wd of args.days) {
    const intent: ScheduleIntent = {
      time: args.time,
      recurrence: weeklyRecurrence([wd]),
    };
    const fireAt = nextOccurrence(intent, args.nowEpoch, args.timeZone);
    if (fireAt != null) {
      addArmSpec(plan, {
        id: args.weeklyId(wd),
        kind: args.kind,
        fireAt,
        repeat: 'weekly',
        isCall,
        slotKey: args.slotKey,
        habit: args.habit,
      });
    }
  }
}

// ─── Side-effecting arm/cancel ────────────────────────────────────────────────

export async function armSpec(spec: ArmSpec, exact: boolean): Promise<void> {
  const notification = buildReminderNotification({
    id: spec.id,
    kind: spec.kind,
    intendedFireAt: spec.fireAt,
    slotKey: spec.slotKey,
    habit: spec.habit,
    isReschedule: spec.isReschedule,
  });
  const trigger = buildTrigger({
    fireAt: spec.fireAt,
    repeat: spec.repeat,
    exact,
    isCall: spec.isCall,
  });
  // Explicitly tear down any trigger already armed under this id before re-arming. Notifee
  // is documented to "replace" a same-id trigger, but for a RepeatFrequency.DAILY/WEEKLY
  // alarm armed via AlarmManager.SET_ALARM_CLOCK the already-committed OS alarm is not
  // reliably cancelled by the overwrite on every OEM — so after a time change (e.g. 10:43 ->
  // 11:15) the old wall-clock occurrence could still fire once. Cancelling first guarantees a
  // clean re-arm. For a brand-new id this is a harmless no-op.
  await notifee.cancelTriggerNotification(spec.id).catch(() => {});
  await notifee.createTriggerNotification(notification, trigger);
  reminderLog.debug('schedule.armed', `Armed ${spec.id}`, {
    id: spec.id,
    fireAt: spec.fireAt,
    repeat: spec.repeat,
    exact,
  });
}

export async function cancelTrigger(id: string): Promise<void> {
  await notifee.cancelTriggerNotification(id).catch(() => {});
}
