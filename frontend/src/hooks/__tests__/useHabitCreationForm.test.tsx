import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useHabitCreationForm } from '../useHabitCreationForm';
import { habitApi } from '@/services/api/habitApi';
import {
  requestReminderPermissions,
  scheduleHabitReminder,
} from '@/services/notifications/reminderService';

jest.mock('@/services/api/habitApi', () => ({
  habitApi: { create: jest.fn() },
}));
jest.mock('@/services/notifications/reminderService', () => ({
  requestReminderPermissions: jest.fn(() =>
    Promise.resolve({ notificationsAuthorized: true }),
  ),
  scheduleHabitReminder: jest.fn(() => Promise.resolve()),
}));

const mockCreate = habitApi.create as jest.Mock;
const mockSchedule = scheduleHabitReminder as jest.Mock;
const mockPerms = requestReminderPermissions as jest.Mock;

function renderForm(onSaved = jest.fn()) {
  const ref: { current: ReturnType<typeof useHabitCreationForm> } = {
    current: null as any,
  };
  function Harness() {
    ref.current = useHabitCreationForm(onSaved);
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return { ref, onSaved };
}

const fill = (ref: any) =>
  act(() => {
    ref.current.setHabitName('Morning Run');
    ref.current.toggleDay('Mon');
    ref.current.setReminderType('notification');
  });

let errSpy: jest.SpyInstance;
let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockPerms.mockResolvedValue({ notificationsAuthorized: true });
});
afterEach(() => {
  errSpy.mockRestore();
  alertSpy.mockRestore();
});

describe('useHabitCreationForm', () => {
  it('isFormValid reflects required fields', () => {
    const { ref } = renderForm();
    expect(ref.current.isFormValid).toBe(false);
    fill(ref);
    expect(ref.current.isFormValid).toBe(true);
  });

  it('does not create when the form is invalid', async () => {
    const { ref } = renderForm();
    await act(async () => {
      await ref.current.handleSave();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the habit, schedules the reminder, and calls onSaved', async () => {
    mockCreate.mockResolvedValueOnce({ id: 42, name: 'Morning Run' });
    const { ref, onSaved } = renderForm();
    fill(ref);

    await act(async () => {
      await ref.current.handleSave();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const payload = mockCreate.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: 'Morning Run',
      repeatDays: ['Mon'],
      reminderType: 'notification',
    });
    expect(payload.reminderTime).toMatch(/^\d{2}:\d{2} (AM|PM)$/);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('flags a permission denial but still creates the habit', async () => {
    mockPerms.mockResolvedValueOnce({ notificationsAuthorized: false });
    mockCreate.mockResolvedValueOnce({ id: 1, name: 'Morning Run' });
    const { ref } = renderForm();
    fill(ref);

    await act(async () => {
      await ref.current.handleSave();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Notifications are off',
      expect.any(String),
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('sets an error and does not call onSaved when create fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('boom'));
    const { ref, onSaved } = renderForm();
    fill(ref);

    await act(async () => {
      await ref.current.handleSave();
    });

    expect(ref.current.error).toBe('boom');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
