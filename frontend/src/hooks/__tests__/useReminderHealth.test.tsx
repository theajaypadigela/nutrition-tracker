import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useReminderHealth } from '../useReminderHealth';
import { buildReminderHealthReport } from '../../services/notifications/reminderHealth';

jest.mock('../../services/notifications/reminderHealth', () => ({
  buildReminderHealthReport: jest.fn(),
}));

const mockBuild = buildReminderHealthReport as jest.Mock;

function renderHook() {
  const ref: { current: ReturnType<typeof useReminderHealth> } = {
    current: null as any,
  };
  function Harness() {
    ref.current = useReminderHealth();
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return ref;
}

beforeEach(() => jest.clearAllMocks());

describe('useReminderHealth', () => {
  it('load fetches the report and clears loading', async () => {
    const report = { degraded: false, items: [] };
    mockBuild.mockResolvedValueOnce(report);
    const hook = renderHook();

    await act(async () => {
      await hook.current.load();
    });

    expect(hook.current.report).toBe(report);
    expect(hook.current.loading).toBe(false);
  });

  it('runFix runs the item fix and reloads', async () => {
    const report = { degraded: false, items: [] };
    mockBuild.mockResolvedValue(report);
    const hook = renderHook();
    await act(async () => {
      await hook.current.load();
    });

    const run = jest.fn(() => Promise.resolve());
    const item = { id: 'x', title: 't', detail: 'd', status: 'warn', fix: { label: 'Fix', run } };

    mockBuild.mockClear();
    await act(async () => {
      await hook.current.runFix(item as any);
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(hook.current.busyId).toBeNull();
    expect(mockBuild).toHaveBeenCalledTimes(1); // reloaded after fix
  });

  it('runFix is a no-op when the item has no fix', async () => {
    const hook = renderHook();
    const item = { id: 'y', title: 't', detail: 'd', status: 'ok' };
    await act(async () => {
      await hook.current.runFix(item as any);
    });
    expect(hook.current.busyId).toBeNull();
  });
});
