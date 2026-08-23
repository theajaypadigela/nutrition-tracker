import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { useOnboardingMealScheduleForm } from '../useOnboardingMealScheduleForm';
import {
  defaultMealSchedule,
  saveMealSchedule,
} from '@/services/notifications/reminderService';
import { formatLocaleTimeFromParts } from '@/utils/timeFormatter';

// Only the two edges the hook touches. The real module pulls Notifee + AsyncStorage
// + the reconciliation chain; none of that is under test here.
jest.mock('@/services/notifications/reminderService', () => ({
  defaultMealSchedule: jest.fn(),
  saveMealSchedule: jest.fn(),
}));

// @notifee/react-native is mocked globally in jest.setup.js; requestPermission there
// resolves AUTHORIZED, which is the happy path for every test that does not override it.
const mockRequestPermission = notifee.requestPermission as jest.Mock;
const mockDefaultSchedule = defaultMealSchedule as jest.MockedFunction<
  typeof defaultMealSchedule
>;
const mockSave = saveMealSchedule as jest.Mock;

type Hook = ReturnType<typeof useOnboardingMealScheduleForm>;

function renderForm(onSaved: jest.Mock = jest.fn()) {
  const ref: { current: Hook } = { current: null as any };
  function Harness() {
    ref.current = useOnboardingMealScheduleForm({ onSaved });
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return { ref, onSaved };
}

/** Drives the picker's onChange the way @react-native-community/datetimepicker does. */
const pick = (ref: { current: Hook }, date: Date) =>
  act(() => {
    ref.current.onTimeChange({ type: 'set' }, date);
  });

// 06:05 local — deliberately different from the seeded default so every assertion about
// hour/minute distinguishes "came from the pick" from "came from defaultMealSchedule()".
const PICKED = new Date(2026, 4, 17, 6, 5, 30, 500);

let errSpy: jest.SpyInstance;
let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockDefaultSchedule.mockReturnValue({ hour: 7, minute: 45, enabled: false });
  mockRequestPermission.mockResolvedValue({
    authorizationStatus: AuthorizationStatus.AUTHORIZED,
  });
  mockSave.mockResolvedValue(undefined);
});
afterEach(() => {
  errSpy.mockRestore();
  alertSpy.mockRestore();
});

describe('useOnboardingMealScheduleForm', () => {
  it('seeds hour/minute from defaultMealSchedule() and starts unpicked', () => {
    const { ref } = renderForm();

    expect(mockDefaultSchedule).toHaveBeenCalled();
    expect(ref.current.hour).toBe(7);
    expect(ref.current.minute).toBe(45);
    expect(ref.current.hasPicked).toBe(false);
    expect(ref.current.showPicker).toBe(false);
    expect(ref.current.saving).toBe(false);
    expect(ref.current.formattedTime).toBe(formatLocaleTimeFromParts(7, 45));
    expect(ref.current.pickerValue.getHours()).toBe(7);
    expect(ref.current.pickerValue.getMinutes()).toBe(45);
  });

  it('openPicker shows the picker without picking anything', () => {
    const { ref } = renderForm();
    act(() => ref.current.openPicker());

    expect(ref.current.showPicker).toBe(true);
    expect(ref.current.hasPicked).toBe(false);
    expect(ref.current.hour).toBe(7);
  });

  // The reason this hook exists (see its doc comment): an unpicked default must never
  // be saved silently, so the first press of the primary button is a picker-opener.
  it('first press only opens the picker: nothing is requested, saved or reported', async () => {
    const { ref, onSaved } = renderForm();

    await act(async () => {
      await ref.current.submit();
    });

    expect(ref.current.showPicker).toBe(true);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(ref.current.saving).toBe(false);
    expect(ref.current.hasPicked).toBe(false);
  });

  it('a dismissed picker closes without picking, keeps the time, and keeps the first-press rule armed', async () => {
    const { ref, onSaved } = renderForm();
    act(() => ref.current.openPicker());

    // A dismissal can still carry a date; the hook must ignore it.
    act(() => {
      ref.current.onTimeChange({ type: 'dismissed' }, PICKED);
    });

    expect(ref.current.showPicker).toBe(false);
    expect(ref.current.hasPicked).toBe(false);
    expect(ref.current.hour).toBe(7);
    expect(ref.current.minute).toBe(45);

    // Still unpicked, so submit re-opens the picker rather than saving 7:45.
    await act(async () => {
      await ref.current.submit();
    });
    expect(mockSave).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(ref.current.showPicker).toBe(true);
  });

  it('a picked Date sets the local hour/minute, flips hasPicked and closes the picker', () => {
    const { ref } = renderForm();
    act(() => ref.current.openPicker());

    pick(ref, PICKED);

    expect(ref.current.hour).toBe(PICKED.getHours()); // 6, local clock
    expect(ref.current.minute).toBe(PICKED.getMinutes()); // 5
    expect(ref.current.hasPicked).toBe(true);
    expect(ref.current.showPicker).toBe(false);
  });

  it('formattedTime and pickerValue track the picked time', () => {
    const { ref } = renderForm();
    const before = ref.current.formattedTime;

    pick(ref, PICKED);

    // Exact copy: the Done screen renders this string verbatim (device-locale clock,
    // non-padded hour — "6:05 AM" under the en-US default this repo tests against).
    expect(ref.current.formattedTime).toBe('6:05 AM');
    expect(ref.current.formattedTime).not.toBe(before);
    expect(ref.current.pickerValue.getHours()).toBe(6);
    expect(ref.current.pickerValue.getMinutes()).toBe(5);
    expect(ref.current.pickerValue.getSeconds()).toBe(0);
    expect(ref.current.pickerValue.getMilliseconds()).toBe(0);
  });

  it('after picking, submit requests permission, saves the enabled schedule and reports the formatted time', async () => {
    const { ref, onSaved } = renderForm();
    pick(ref, PICKED);

    await act(async () => {
      await ref.current.submit();
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith({
      hour: 6,
      minute: 5,
      enabled: true, // picking a time is what enables the reminder
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(formatLocaleTimeFromParts(6, 5));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(ref.current.saving).toBe(false);

    // Permission is asked for before the schedule is written.
    expect(mockRequestPermission.mock.invocationCallOrder[0]).toBeLessThan(
      mockSave.mock.invocationCallOrder[0],
    );
  });

  // Product decision: a denied permission does NOT abort the save. The call time is
  // persisted anyway, onboarding continues, and the user is told it cannot ring yet.
  it('saves and reports anyway when notification permission is denied, adding the warning alert', async () => {
    mockRequestPermission.mockResolvedValueOnce({
      authorizationStatus: AuthorizationStatus.DENIED,
    });
    const { ref, onSaved } = renderForm();
    pick(ref, PICKED);

    await act(async () => {
      await ref.current.submit();
    });

    expect(mockSave).toHaveBeenCalledWith({ hour: 6, minute: 5, enabled: true });
    expect(onSaved).toHaveBeenCalledWith(formatLocaleTimeFromParts(6, 5));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Reminders are off',
      'Your call time is saved, but it can’t ring until you enable notifications. You can fix this anytime from Profile → Reminder health.',
    );
    // The warning comes after the write, and does not stop the report to the screen.
    expect(mockSave.mock.invocationCallOrder[0]).toBeLessThan(
      alertSpy.mock.invocationCallOrder[0],
    );
    expect(ref.current.saving).toBe(false);
  });

  it('treats only DENIED as denied: a provisional authorization saves silently', async () => {
    mockRequestPermission.mockResolvedValueOnce({
      authorizationStatus: AuthorizationStatus.PROVISIONAL,
    });
    const { ref, onSaved } = renderForm();
    pick(ref, PICKED);

    await act(async () => {
      await ref.current.submit();
    });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('holds saving true while the write is in flight and clears it once it resolves', async () => {
    let release!: () => void;
    mockSave.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve();
        }),
    );
    const { ref, onSaved } = renderForm();
    pick(ref, PICKED);

    let inFlight!: Promise<void>;
    await act(async () => {
      inFlight = ref.current.submit();
    });

    expect(ref.current.saving).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();

    await act(async () => {
      release();
      await inFlight;
    });

    expect(ref.current.saving).toBe(false);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('clears saving and reports nothing when the write rejects, letting the rejection propagate', async () => {
    mockSave.mockRejectedValueOnce(new Error('offline'));
    const { ref, onSaved } = renderForm();
    pick(ref, PICKED);

    await act(async () => {
      await expect(ref.current.submit()).rejects.toThrow('offline');
    });

    expect(ref.current.saving).toBe(false); // the finally block
    expect(onSaved).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(ref.current.hasPicked).toBe(true); // the pick survives a failed save
  });
});
