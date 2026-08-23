import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  useVoiceHabitSession,
  type UseVoiceHabitSessionOptions,
  type UseVoiceHabitSessionResult,
} from '../useVoiceHabitSession';
import {
  useVapiSession,
  type UseVapiSessionOptions,
  type UseVapiSessionResult,
} from '../useVapiSession';
import { habitApi } from '@/services/api/habitApi';
import { rescheduleHabit } from '@/services/notifications/reminderService';
import { VOICE_LANE_COPY } from '@/components/voice/voiceSessionCopy';
import { FOLLOW_UP_INVALID_MESSAGE } from '@/utils/followUp';
import { formatEpochTime12h } from '@/utils/timeFormatter';
import type { CallStatus } from '@/components/voice/VoiceSessionScreen';
import type { Habit } from '@/types/types';

// Mocked at the hook's real edges, mirroring useVoiceMealSession.test.tsx. useVapiSession is
// replaced wholesale so the Vapi SDK never loads and the call lifecycle can be driven by
// hand. utils/followUp, utils/timeFormatter and voiceSessionCopy are deliberately NOT
// mocked — their output is the contract the screen renders verbatim.
jest.mock('../useVapiSession', () => ({ useVapiSession: jest.fn() }));
jest.mock('@/services/api/habitApi', () => ({
  habitApi: {
    getToday: jest.fn(),
    interpretVoice: jest.fn(),
    submitVoiceResult: jest.fn(),
  },
}));
jest.mock('@/services/notifications/reminderService', () => ({
  rescheduleHabit: jest.fn(),
}));

const mockApi = habitApi as jest.Mocked<typeof habitApi>;
const mockReschedule = rescheduleHabit as jest.MockedFunction<
  typeof rescheduleHabit
>;
const mockUseVapiSession = useVapiSession as jest.MockedFunction<
  typeof useVapiSession
>;

// 2026-06-14 10:00 local, constructed from local parts so the follow-up clock strings are
// stable in any timezone.
const FROZEN_NOW = new Date(2026, 5, 14, 10, 0, 0, 0).getTime();
const SLOT_TIME = '08:30 AM';

function habit(overrides: Partial<Habit> & Pick<Habit, 'id' | 'name'>): Habit {
  return {
    completed: false,
    repeatDays: [],
    reminderTime: SLOT_TIME,
    reminderType: 'call',
    ...overrides,
  };
}

// --- the fake Vapi lane -----------------------------------------------------------
// A real, stateful stand-in: status lives in React state so setStatus() from inside the
// hook actually re-renders and statusText updates, and transcriptRef is a real ref the
// test writes the conversation into before firing onCallEnd.
type Lane = {
  options: UseVapiSessionOptions | null;
  transcriptRef: React.MutableRefObject<string[]> | null;
  transcript: string[];
  isSpeaking: boolean;
  startSession: jest.Mock<Promise<void>, []>;
  stopSession: jest.Mock<void, []>;
};

let lane: Lane;

function laneOptions(): UseVapiSessionOptions {
  const options = lane.options;
  if (!options) {
    throw new Error('useVapiSession was never called');
  }
  return options;
}

function setTranscriptLines(lines: string[]): void {
  const ref = lane.transcriptRef;
  if (!ref) {
    throw new Error('the lane has not rendered yet');
  }
  ref.current = lines;
}

const TRANSCRIPT = ['Assistant: Did you finish your walk?', 'You: Yes I did.'];

type Rendered = {
  current: UseVoiceHabitSessionResult;
  onRescheduled: jest.Mock<void, []>;
};

/**
 * Mounts the hook. The slot-resolution effect fires an async habitApi.getToday(), so the
 * mount is awaited to let that settle before the test asserts.
 */
async function renderSession(
  options: Partial<UseVoiceHabitSessionOptions> = {},
): Promise<Rendered> {
  const onRescheduled = jest.fn<void, []>();
  const rendered: Rendered = {
    current: null as unknown as UseVoiceHabitSessionResult,
    onRescheduled,
  };
  function Harness() {
    rendered.current = useVoiceHabitSession({
      habitName: '',
      habitTime: SLOT_TIME,
      autoStart: false,
      onRescheduled,
      ...options,
    });
    return null;
  }
  await act(async () => {
    ReactTestRenderer.create(<Harness />);
  });
  return rendered;
}

/** Fires the lane's onCallEnd and drains the whole post-call pipeline. */
async function endCall(lines: string[] = TRANSCRIPT): Promise<void> {
  setTranscriptLines(lines);
  await act(async () => {
    laneOptions().onCallEnd();
  });
}

let logSpy: jest.SpyInstance;
let errSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(FROZEN_NOW);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  lane = {
    options: null,
    transcriptRef: null,
    transcript: [],
    isSpeaking: false,
    startSession: jest.fn(() => Promise.resolve()),
    stopSession: jest.fn(),
  };

  mockUseVapiSession.mockImplementation(
    (options: UseVapiSessionOptions): UseVapiSessionResult => {
      lane.options = options;
      const [status, setStatus] = React.useState<CallStatus>('idle');
      const transcriptRef = React.useRef<string[]>([]);
      const volumeLevelRef = React.useRef(0);
      lane.transcriptRef = transcriptRef;
      return {
        status,
        setStatus,
        transcript: lane.transcript,
        isSpeaking: lane.isSpeaking,
        transcriptRef,
        volumeLevelRef,
        startSession: lane.startSession,
        stopSession: lane.stopSession,
      };
    },
  );

  mockApi.getToday.mockResolvedValue([]);
  mockApi.submitVoiceResult.mockResolvedValue(undefined);
  mockReschedule.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe('useVoiceHabitSession — lane wiring', () => {
  it('configures the habit lane', async () => {
    await renderSession();
    const options = laneOptions();

    expect(options.purpose).toBe('habit');
    expect(options.logTag).toBe('VapiHabit');
    expect(options.permissionDeniedMessage).toBe(
      'Microphone access is needed for your habit check-in by voice.',
    );
  });

  it('builds the assistant variables from the resolved slot, not the route param', async () => {
    mockApi.getToday.mockResolvedValue([
      habit({ id: 'h1', name: 'Walk' }),
      habit({ id: 'h2', name: 'Stretch' }),
    ]);

    await renderSession({ habitName: 'Stale route name', userName: 'Ada' });

    expect(laneOptions().getVariableValues()).toEqual({
      name: 'Ada',
      habit: 'Walk',
      habit_name: 'Walk',
      habits: 'Walk, Stretch',
      habit_time: SLOT_TIME,
    });
  });

  it('falls back to the route habit name and "User" when nothing resolved', async () => {
    await renderSession({ habitName: 'Drink water' });

    expect(laneOptions().getVariableValues()).toEqual({
      name: 'User',
      habit: 'Drink water',
      habit_name: 'Drink water',
      habits: 'Drink water',
      habit_time: SLOT_TIME,
    });
  });

  it('re-exposes the lane transcript, isSpeaking and the session controls', async () => {
    lane.transcript = ['You: hi'];
    lane.isSpeaking = true;
    const hook = await renderSession();

    expect(hook.current.transcript).toEqual(['You: hi']);
    expect(hook.current.isSpeaking).toBe(true);
    expect(hook.current.startSession).toBe(lane.startSession);
    expect(hook.current.stopSession).toBe(lane.stopSession);
  });
});

describe('useVoiceHabitSession — slot resolution', () => {
  it('keeps only call-type, time-matching, not-COMPLETED habits', async () => {
    mockApi.getToday.mockResolvedValue([
      habit({ id: 'keep-1', name: 'Walk' }),
      habit({ id: 'keep-2', name: 'Stretch', status: 'PENDING' }),
      habit({ id: 'drop-done', name: 'Done', status: 'COMPLETED' }),
      habit({ id: 'drop-type', name: 'Silent', reminderType: 'notification' }),
      habit({ id: 'drop-time', name: 'Later', reminderTime: '09:45 PM' }),
    ]);

    const hook = await renderSession();

    expect(hook.current.title).toBe('Habit Check-in');
    expect(laneOptions().getVariableValues().habits).toBe('Walk, Stretch');
  });

  it('matches the slot time through timesMatch rather than string equality', async () => {
    mockApi.getToday.mockResolvedValue([
      habit({ id: 'h1', name: 'Walk', reminderTime: '8:30 am' }),
    ]);

    const hook = await renderSession({ habitTime: '08:30 AM' });

    expect(hook.current.title).toBe('Walk');
  });

  it('falls back to the route habit when nothing matches', async () => {
    mockApi.getToday.mockResolvedValue([
      habit({ id: 'other', name: 'Later', reminderTime: '09:45 PM' }),
    ]);

    const hook = await renderSession({ habitId: 'route-1', habitName: 'Walk' });

    expect(hook.current.title).toBe('Walk');
    expect(laneOptions().getVariableValues().habits).toBe('Walk');
  });

  it('falls back to the route habit when the fetch rejects', async () => {
    mockApi.getToday.mockRejectedValue(new Error('offline'));

    const hook = await renderSession({ habitId: 'route-1', habitName: 'Walk' });

    expect(hook.current.title).toBe('Walk');
    await endCall();
    // The fallback habit really is in the slot, not just in the title.
    expect(mockApi.submitVoiceResult).toHaveBeenCalledTimes(1);
  });

  it('leaves the slot empty when nothing matches and there is no route habitId', async () => {
    const hook = await renderSession({ habitName: 'Walk' });

    await endCall();

    expect(mockApi.interpretVoice).not.toHaveBeenCalled();
    expect(hook.current.statusText).toBe('Call completed');
  });
});

describe('useVoiceHabitSession — auto-start gate', () => {
  it('does not start while the habit context is unresolved', async () => {
    // habitName 'Habit' is the sentinel for "unresolved", and the fetch found nothing.
    await renderSession({ autoStart: true, habitName: 'Habit' });

    expect(lane.startSession).not.toHaveBeenCalled();
  });

  it('starts once the fetch resolves a habit', async () => {
    mockApi.getToday.mockResolvedValue([habit({ id: 'h1', name: 'Walk' })]);

    await renderSession({ autoStart: true, habitName: 'Habit' });

    expect(lane.startSession).toHaveBeenCalledTimes(1);
  });

  it('starts immediately when the route already named the habit', async () => {
    await renderSession({ autoStart: true, habitName: 'Walk' });

    expect(lane.startSession).toHaveBeenCalledTimes(1);
  });

  it('starts only once even as the slot resolves after the first render', async () => {
    mockApi.getToday.mockResolvedValue([habit({ id: 'h1', name: 'Walk' })]);

    await renderSession({ autoStart: true, habitName: 'Walk' });

    expect(lane.startSession).toHaveBeenCalledTimes(1);
  });

  it('never starts when autoStart is false', async () => {
    mockApi.getToday.mockResolvedValue([habit({ id: 'h1', name: 'Walk' })]);

    await renderSession({ habitName: 'Walk' });

    expect(lane.startSession).not.toHaveBeenCalled();
  });
});

describe('useVoiceHabitSession — title', () => {
  it('uses the single resolved habit name', async () => {
    mockApi.getToday.mockResolvedValue([habit({ id: 'h1', name: 'Walk' })]);
    const hook = await renderSession();
    expect(hook.current.title).toBe('Walk');
  });

  it('collapses a multi-habit slot to "Habit Check-in"', async () => {
    mockApi.getToday.mockResolvedValue([
      habit({ id: 'h1', name: 'Walk' }),
      habit({ id: 'h2', name: 'Stretch' }),
    ]);
    const hook = await renderSession();
    expect(hook.current.title).toBe('Habit Check-in');
  });

  it('falls back to the route habit name when the slot is empty', async () => {
    const hook = await renderSession({ habitName: 'Drink water' });
    expect(hook.current.title).toBe('Drink water');
  });
});

describe('useVoiceHabitSession — transcript interpretation', () => {
  beforeEach(() => {
    mockApi.getToday.mockResolvedValue([habit({ id: 'h1', name: 'Walk' })]);
  });

  it('sends the transcript lines with the joined habit names and the slot time', async () => {
    mockApi.getToday.mockResolvedValue([
      habit({ id: 'h1', name: 'Walk' }),
      habit({ id: 'h2', name: 'Stretch' }),
    ]);
    mockApi.interpretVoice.mockResolvedValue({ habitStatus: 'completed' });

    await renderSession();
    await endCall();

    expect(mockApi.interpretVoice).toHaveBeenCalledWith(
      TRANSCRIPT,
      'Walk, Stretch',
      SLOT_TIME,
    );
  });

  it('does not call the backend for an empty transcript', async () => {
    await renderSession();
    await endCall([]);

    expect(mockApi.interpretVoice).not.toHaveBeenCalled();
  });

  it.each([
    ['COMPLETED', 'completed'],
    ['  completed  ', 'completed'],
    ['Rescheduled', 'rescheduled'],
  ])('normalises the backend status %p to %p', async (raw, normalized) => {
    mockApi.interpretVoice.mockResolvedValue({
      habitStatus: raw as never,
      rescheduleMinutes: null,
    });

    await renderSession();
    await endCall();

    expect(mockApi.submitVoiceResult).toHaveBeenCalledWith(
      expect.objectContaining({ habitStatus: normalized }),
    );
  });

  it.each([['nonsense'], [undefined]])(
    'normalises the unrecognised status %p to not_completed',
    async raw => {
      mockApi.interpretVoice.mockResolvedValue({
        habitStatus: raw as never,
      });

      await renderSession();
      await endCall();

      expect(mockApi.submitVoiceResult).toHaveBeenCalledWith(
        expect.objectContaining({ habitStatus: 'not_completed' }),
      );
    },
  );

  it('swallows an interpretation failure and completes the call', async () => {
    mockApi.interpretVoice.mockRejectedValue(new Error('boom'));

    const hook = await renderSession();
    await endCall();

    expect(mockApi.submitVoiceResult).not.toHaveBeenCalled();
    expect(hook.current.statusText).toBe('Call completed');
    expect(hook.current.status).toBe('completed');
  });

  it('drops rescheduleMinutes when the backend said not_completed', async () => {
    mockApi.interpretVoice.mockResolvedValue({
      habitStatus: 'not_completed',
      rescheduleMinutes: 15,
    });

    await renderSession();
    await endCall();

    // interpretVoiceTranscriptWithBackend builds a bare not_completed result with no
    // reschedule_minutes, so no follow-up is armed even though the backend named one.
    expect(mockReschedule).not.toHaveBeenCalled();
    expect(mockApi.submitVoiceResult).toHaveBeenCalledWith(
      expect.objectContaining({
        habitStatus: 'not_completed',
        rescheduleMinutes: null,
      }),
    );
  });
});

describe('useVoiceHabitSession — applying the result to the slot', () => {
  const walk = habit({ id: 'h1', name: 'Walk' });
  const stretch = habit({ id: 'h2', name: 'Stretch' });

  beforeEach(() => {
    mockApi.getToday.mockResolvedValue([walk, stretch]);
  });

  it('submits once per habit with that habit id and name and the shared status', async () => {
    mockApi.interpretVoice.mockResolvedValue({ habitStatus: 'completed' });

    await renderSession();
    await endCall();

    expect(mockApi.submitVoiceResult).toHaveBeenCalledTimes(2);
    expect(mockApi.submitVoiceResult).toHaveBeenNthCalledWith(1, {
      habitId: 'h1',
      habitName: 'Walk',
      habitStatus: 'completed',
      rescheduleMinutes: null,
      completedAt: undefined,
    });
    expect(mockApi.submitVoiceResult).toHaveBeenNthCalledWith(2, {
      habitId: 'h2',
      habitName: 'Stretch',
      habitStatus: 'completed',
      rescheduleMinutes: null,
      completedAt: undefined,
    });
  });

  it('keeps going when one habit submission fails', async () => {
    mockApi.interpretVoice.mockResolvedValue({ habitStatus: 'completed' });
    mockApi.submitVoiceResult.mockRejectedValueOnce(new Error('409'));

    const hook = await renderSession();
    await endCall();

    expect(mockApi.submitVoiceResult).toHaveBeenCalledTimes(2);
    expect(hook.current.statusText).toBe('"Walk", "Stretch" marked as completed!');
    expect(hook.current.status).toBe('completed');
  });

  it('reports completion with every habit name quoted', async () => {
    mockApi.interpretVoice.mockResolvedValue({ habitStatus: 'completed' });

    const hook = await renderSession();
    await endCall();

    expect(hook.current.statusText).toBe('"Walk", "Stretch" marked as completed!');
  });

  it('reports a miss with every habit name quoted', async () => {
    mockApi.interpretVoice.mockResolvedValue({ habitStatus: 'not_completed' });

    const hook = await renderSession();
    await endCall();

    expect(hook.current.statusText).toBe('"Walk", "Stretch" marked as missed.');
  });
});

describe('useVoiceHabitSession — reschedule', () => {
  const walk = habit({ id: 'h1', name: 'Walk' });
  const stretch = habit({ id: 'h2', name: 'Stretch' });
  const FIRE_AT = FROZEN_NOW + 20 * 60_000;

  beforeEach(() => {
    mockApi.getToday.mockResolvedValue([walk, stretch]);
  });

  it('arms exactly one consolidated follow-up for the whole slot', async () => {
    mockApi.interpretVoice.mockResolvedValue({
      habitStatus: 'rescheduled',
      rescheduleMinutes: 20,
    });
    mockReschedule.mockResolvedValue(FIRE_AT);

    const hook = await renderSession();
    await endCall();

    expect(mockReschedule).toHaveBeenCalledTimes(1);
    expect(mockReschedule).toHaveBeenCalledWith(
      {
        id: 'h1',
        name: 'Walk, Stretch',
        reminderTime: SLOT_TIME,
        reminderType: 'call',
        completed: false,
        repeatDays: [],
      },
      20,
    );
    expect(hook.current.statusText).toBe(
      `"Walk", "Stretch" rescheduled. Next call in 20 minutes at ${formatEpochTime12h(
        FIRE_AT,
      )}.`,
    );
  });

  it.each([[null], [0], [-5]])(
    'defaults to 30 minutes when the backend gave %p',
    async minutes => {
      mockApi.interpretVoice.mockResolvedValue({
        habitStatus: 'rescheduled',
        rescheduleMinutes: minutes,
      });
      mockReschedule.mockResolvedValue(FIRE_AT);

      await renderSession();
      await endCall();

      expect(mockReschedule).toHaveBeenCalledWith(expect.anything(), 30);
    },
  );

  it('surfaces the invalid-follow-up copy when nothing could be armed', async () => {
    mockApi.interpretVoice.mockResolvedValue({
      habitStatus: 'rescheduled',
      rescheduleMinutes: 20,
    });
    mockReschedule.mockResolvedValue(null);

    const hook = await renderSession();
    await endCall();

    expect(hook.current.statusText).toBe(FOLLOW_UP_INVALID_MESSAGE);
  });

  it('bounces back to the habit list 2s later, and not before', async () => {
    mockApi.interpretVoice.mockResolvedValue({
      habitStatus: 'rescheduled',
      rescheduleMinutes: 20,
    });
    mockReschedule.mockResolvedValue(FIRE_AT);

    const hook = await renderSession();
    await endCall();

    expect(hook.onRescheduled).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1999);
    });
    expect(hook.onRescheduled).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(hook.onRescheduled).toHaveBeenCalledTimes(1);
  });

  it('does not navigate back for a completed check-in', async () => {
    mockApi.interpretVoice.mockResolvedValue({ habitStatus: 'completed' });

    const hook = await renderSession();
    await endCall();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(hook.onRescheduled).not.toHaveBeenCalled();
  });
});

describe('useVoiceHabitSession — statusText', () => {
  it('renders the habit lane copy for each call status', async () => {
    const hook = await renderSession({ habitName: 'Walk' });
    const setStatus = (status: CallStatus) =>
      act(() => {
        hook.current.setStatus(status);
      });

    expect(hook.current.statusText).toBe(VOICE_LANE_COPY.habit.idle);

    setStatus('requesting');
    expect(hook.current.statusText).toBe('Starting session...');

    setStatus('active');
    expect(hook.current.statusText).toBe('Listening...');

    setStatus('processing');
    expect(hook.current.statusText).toBe(
      VOICE_LANE_COPY.habit.processingStatus,
    );

    setStatus('completed');
    expect(hook.current.statusText).toBe('Call completed');

    setStatus('error');
    expect(hook.current.statusText).toBe(VOICE_LANE_COPY.habit.genericError);
  });

  it('says the assistant is speaking while it holds the floor', async () => {
    lane.isSpeaking = true;
    const hook = await renderSession({ habitName: 'Walk' });

    act(() => {
      hook.current.setStatus('active');
    });

    expect(hook.current.statusText).toBe('Assistant is speaking...');
  });

  it('clears the previous result when a new session starts', async () => {
    mockApi.getToday.mockResolvedValue([habit({ id: 'h1', name: 'Walk' })]);
    mockApi.interpretVoice.mockResolvedValue({ habitStatus: 'completed' });

    const hook = await renderSession();
    await endCall();
    expect(hook.current.statusText).toBe('"Walk" marked as completed!');

    act(() => {
      laneOptions().onSessionReset?.();
    });
    act(() => {
      hook.current.setStatus('completed');
    });

    expect(hook.current.statusText).toBe('Call completed');
  });
});
