import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  useVoiceMealSession,
  type UseVoiceMealSessionOptions,
  type UseVoiceMealSessionResult,
} from '../useVoiceMealSession';
import {
  useVapiSession,
  type UseVapiSessionOptions,
  type UseVapiSessionResult,
} from '../useVapiSession';
import { foodLogApi } from '@/services/api/foodLogApi';
import { rescheduleMeal } from '@/services/notifications/reminderService';
import { VOICE_LANE_COPY } from '@/components/voice/voiceSessionCopy';
import { FOLLOW_UP_INVALID_MESSAGE } from '@/utils/followUp';
import type { CallStatus } from '@/components/voice/VoiceSessionScreen';
import type { FoodItem, MealsResponse, NutritionTotals } from '@/types/types';

// Mocked at the hook's real edges. useVapiSession is replaced wholesale so the Vapi SDK
// (and the RN/WebRTC tree behind it) never loads and the call lifecycle can be driven by
// hand. utils/followUp, utils/date and voiceSessionCopy are deliberately NOT mocked —
// their output is the contract the screen renders verbatim.
jest.mock('../useVapiSession', () => ({ useVapiSession: jest.fn() }));
jest.mock('@/services/api/foodLogApi', () => ({
  foodLogApi: {
    getLog: jest.fn(),
    interpretTranscript: jest.fn(),
    parseTranscript: jest.fn(),
  },
}));
jest.mock('@/services/notifications/reminderService', () => ({
  rescheduleMeal: jest.fn(),
}));

const mockApi = foodLogApi as jest.Mocked<typeof foodLogApi>;
const mockReschedule = rescheduleMeal as jest.MockedFunction<
  typeof rescheduleMeal
>;
const mockUseVapiSession = useVapiSession as jest.MockedFunction<
  typeof useVapiSession
>;

// 2026-06-14 10:00 local. Constructed from local parts so getTodayLocalDate() is
// '2026-06-14' and the follow-up clock strings are stable in any timezone.
const FROZEN_NOW = new Date(2026, 5, 14, 10, 0, 0, 0).getTime();
const TODAY = '2026-06-14';

const TOTALS: NutritionTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
};

/** A food-log payload with one entry per element; `null` means "not yet enriched". */
function mealsLog(calories: Array<number | null>): MealsResponse {
  return {
    meals: {
      breakfast: calories.map((cals, i) => {
        const item: FoodItem = {
          id: `item-${i}`,
          name: `food-${i}`,
          quantity: '1',
          servingSize: 'serving',
        };
        if (cals != null) {
          item.calories = cals;
        }
        return item;
      }),
    },
    totals: TOTALS,
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

function renderSession(
  options: Partial<UseVoiceMealSessionOptions> = {},
): { current: UseVoiceMealSessionResult } {
  const ref: { current: UseVoiceMealSessionResult } = {
    current: null as unknown as UseVoiceMealSessionResult,
  };
  function Harness() {
    ref.current = useVoiceMealSession({ autoStart: false, ...options });
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return ref;
}

/** Fires the lane's onCallEnd and drains the whole post-call pipeline. */
async function endCall(lines?: string[], advanceMs = 0): Promise<void> {
  if (lines) {
    setTranscriptLines(lines);
  }
  await act(async () => {
    laneOptions().onCallEnd();
    if (advanceMs > 0) {
      await jest.advanceTimersByTimeAsync(advanceMs);
    }
  });
}

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
let errSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(FROZEN_NOW);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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

  mockApi.getLog.mockResolvedValue(mealsLog([]));
  mockReschedule.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errSpy.mockRestore();
});

describe('useVoiceMealSession — lane wiring', () => {
  it('configures the meal lane and passes the caller name as the assistant variable', () => {
    renderSession({ userName: 'Ada' });
    const options = laneOptions();

    expect(options.purpose).toBe('meal');
    expect(options.logTag).toBe('Vapi');
    expect(options.permissionDeniedMessage).toBe(
      'Microphone access is needed to log meals by voice.',
    );
    expect(options.getVariableValues()).toEqual({ name: 'Ada' });
  });

  it('falls back to "User" when no display name is supplied', () => {
    renderSession();
    expect(laneOptions().getVariableValues()).toEqual({ name: 'User' });
  });

  it('re-exposes the lane transcript, isSpeaking and the session controls', () => {
    lane.transcript = ['You: hi', 'Assistant: hello'];
    lane.isSpeaking = true;
    const hook = renderSession();

    expect(hook.current.transcript).toEqual(['You: hi', 'Assistant: hello']);
    expect(hook.current.isSpeaking).toBe(true);
    expect(hook.current.startSession).toBe(lane.startSession);
    expect(hook.current.stopSession).toBe(lane.stopSession);
  });

  it('auto-starts the call only when autoStart is set', () => {
    renderSession({ autoStart: false });
    expect(lane.startSession).not.toHaveBeenCalled();

    renderSession({ autoStart: true });
    expect(lane.startSession).toHaveBeenCalledTimes(1);
  });
});

describe('useVoiceMealSession — title', () => {
  it.each([
    ['breakfast', 'Logging Breakfast'],
    ['lunch', 'Logging Lunch'],
    ['snack', 'Logging Snack'],
    ['snacks', 'Logging Snacks'],
    ['dinner', 'Logging Dinner'],
  ])('titles a %s slot "%s"', (mealSlotId, expected) => {
    expect(renderSession({ mealSlotId }).current.title).toBe(expected);
  });

  it('titles an unknown slot id "Logging Meals"', () => {
    expect(renderSession({ mealSlotId: 'brunch' }).current.title).toBe(
      'Logging Meals',
    );
  });

  it('titles a missing slot id "Logging Meals"', () => {
    expect(renderSession().current.title).toBe('Logging Meals');
  });
});

describe('useVoiceMealSession — statusText', () => {
  it('shows the meal-lane idle copy', () => {
    const hook = renderSession();
    expect(hook.current.status).toBe('idle');
    expect(hook.current.statusText).toBe(VOICE_LANE_COPY.meal.idle);
    expect(hook.current.statusText).toBe(
      'Tap Start Call to log your meals by voice',
    );
  });

  it('shows "Starting session..." while requesting', () => {
    const hook = renderSession();
    act(() => hook.current.setStatus('requesting'));
    expect(hook.current.statusText).toBe('Starting session...');
  });

  it('shows "Listening..." on an active call with a quiet assistant', () => {
    const hook = renderSession();
    act(() => hook.current.setStatus('active'));
    expect(hook.current.statusText).toBe('Listening...');
  });

  it('shows "Assistant is speaking..." on an active call while it speaks', () => {
    const hook = renderSession();
    lane.isSpeaking = true;
    act(() => hook.current.setStatus('active'));
    expect(hook.current.statusText).toBe('Assistant is speaking...');
  });

  it('shows the meal-lane processing copy', () => {
    const hook = renderSession();
    act(() => hook.current.setStatus('processing'));
    expect(hook.current.statusText).toBe(
      VOICE_LANE_COPY.meal.processingStatus,
    );
    expect(hook.current.statusText).toBe('Processing your meals…');
  });

  it('shows "Call completed" when nothing was logged and no message was built', () => {
    const hook = renderSession();
    act(() => hook.current.setStatus('completed'));
    expect(hook.current.statusText).toBe('Call completed');
  });

  it('shows the generic meal error when the error carries no message', () => {
    const hook = renderSession();
    act(() => hook.current.setStatus('error'));
    expect(hook.current.statusText).toBe(VOICE_LANE_COPY.meal.genericError);
    expect(hook.current.statusText).toBe(
      'Something went wrong while processing your meals. Please try again.',
    );
  });

  it('returns empty text for a status outside the union', () => {
    const hook = renderSession();
    act(() => hook.current.setStatus('paused' as CallStatus));
    expect(hook.current.statusText).toBe('');
  });
});

describe('useVoiceMealSession — empty transcript', () => {
  it('completes without touching the API when there are no lines', async () => {
    const hook = renderSession({ mealSlotId: 'breakfast' });
    await endCall([]);

    expect(hook.current.status).toBe('completed');
    expect(hook.current.statusText).toBe('Call completed');
    expect(mockApi.interpretTranscript).not.toHaveBeenCalled();
    expect(mockApi.parseTranscript).not.toHaveBeenCalled();
    expect(mockApi.getLog).not.toHaveBeenCalled();
  });

  it('completes without touching the API when every line is whitespace', async () => {
    const hook = renderSession();
    await endCall(['   ', '', '\n']);

    expect(hook.current.status).toBe('completed');
    expect(mockApi.interpretTranscript).not.toHaveBeenCalled();
  });
});

describe('useVoiceMealSession — selectedDate clamp', () => {
  beforeEach(() => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 0 });
  });

  const logDateFor = async (selectedDate?: string): Promise<unknown> => {
    renderSession({ selectedDate });
    await endCall(['You: eggs']);
    return mockApi.parseTranscript.mock.calls[0][1];
  };

  it('clamps a future date to today', async () => {
    expect(await logDateFor('2099-01-01')).toBe(TODAY);
  });

  it('keeps a past date', async () => {
    expect(await logDateFor('2026-06-01')).toBe('2026-06-01');
  });

  it('keeps today itself', async () => {
    expect(await logDateFor(TODAY)).toBe(TODAY);
  });

  it('falls back to today for a malformed date', async () => {
    expect(await logDateFor('14/06/2026')).toBe(TODAY);
  });

  it('falls back to today when no date is supplied', async () => {
    expect(await logDateFor(undefined)).toBe(TODAY);
  });

  it('reads the baseline snapshot for the same clamped date', async () => {
    renderSession({ selectedDate: '2099-12-31' });
    await endCall(['You: eggs']);
    expect(mockApi.getLog).toHaveBeenCalledWith(TODAY);
  });
});

describe('useVoiceMealSession — parse pipeline', () => {
  it('interprets the joined transcript, snapshots the baseline, then parses it', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 0 });
    renderSession({ mealSlotId: 'lunch', selectedDate: '2026-06-10' });

    await endCall(['  You: I had eggs  ', '', 'Assistant: Nice  ']);

    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(1);
    expect(mockApi.interpretTranscript).toHaveBeenCalledWith(
      'You: I had eggs\nAssistant: Nice',
      'lunch',
      { timeout: 60000 },
    );
    expect(mockApi.parseTranscript).toHaveBeenCalledTimes(1);
    expect(mockApi.parseTranscript).toHaveBeenCalledWith(
      'You: I had eggs\nAssistant: Nice',
      '2026-06-10',
      { timeout: 120000 },
    );
    // baseline snapshot is read before the parse, never after
    expect(mockApi.getLog.mock.invocationCallOrder[0]).toBeLessThan(
      mockApi.parseTranscript.mock.invocationCallOrder[0],
    );
  });

  it('passes an undefined meal slot straight through to the interpreter', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: false });
    renderSession();

    await endCall(['You: eggs']);

    expect(mockApi.interpretTranscript).toHaveBeenCalledWith(
      'You: eggs',
      undefined,
      { timeout: 60000 },
    );
  });

  it('never logs meals when the backend says shouldLogMeals is false', async () => {
    mockApi.interpretTranscript.mockResolvedValue({
      shouldLogMeals: false,
      rationale: 'user only asked to be called back',
    });
    const hook = renderSession();

    await endCall(['You: call me later']);

    expect(mockApi.parseTranscript).not.toHaveBeenCalled();
    expect(mockApi.getLog).not.toHaveBeenCalled();
    expect(hook.current.status).toBe('completed');
  });

  it('still parses when the baseline snapshot read fails', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.getLog.mockRejectedValueOnce(new Error('offline'));
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 0 });
    const hook = renderSession();

    await endCall(['You: eggs']);

    expect(mockApi.parseTranscript).toHaveBeenCalledTimes(1);
    expect(hook.current.status).toBe('completed');
    expect(hook.current.statusText).toBe('No meals were logged in this call.');
  });
});

describe('useVoiceMealSession — duplicate guards', () => {
  it('skips a second call-end while a parse is still in flight', async () => {
    let releaseInterpret: () => void = () => {};
    mockApi.interpretTranscript.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          releaseInterpret = () => resolve({ shouldLogMeals: false });
        }),
    );
    const hook = renderSession();

    await endCall(['You: eggs']);
    expect(hook.current.status).toBe('processing');
    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(1);

    // A DIFFERENT transcript, so only the in-flight guard can be what blocks it.
    await endCall(['You: and toast']);
    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseInterpret();
    });
    expect(hook.current.status).toBe('completed');
  });

  it('skips an identical transcript inside the 120s window, and re-parses after it', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: false });
    renderSession();

    await endCall(['You: eggs']);
    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(1);

    await endCall(['You: eggs']);
    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(119999);
    await endCall(['You: eggs']);
    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2);
    await endCall(['You: eggs']);
    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(2);
  });

  it('does not block a different transcript inside the guard window', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: false });
    renderSession();

    await endCall(['You: eggs']);
    await endCall(['You: eggs and toast']);

    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(2);
  });
});

describe('useVoiceMealSession — follow-up copy', () => {
  it('composes the "Meals logged." lead with the armed fire time', async () => {
    mockApi.interpretTranscript.mockResolvedValue({
      shouldLogMeals: true,
      rescheduleMinutes: 20,
    });
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 2 });
    mockApi.getLog
      .mockResolvedValueOnce(mealsLog([]))
      .mockResolvedValue(mealsLog([120, 340]));
    mockReschedule.mockResolvedValue(FROZEN_NOW + 20 * 60_000);
    const hook = renderSession();

    await endCall(['You: two eggs'], 5000);

    expect(mockReschedule).toHaveBeenCalledWith(20);
    expect(hook.current.status).toBe('completed');
    expect(hook.current.statusText).toBe(
      'Meals logged. Next call in 20 minutes at 10:20 AM.',
    );
  });

  it('omits the lead when nothing was logged, and says "1 minute" for a single minute', async () => {
    mockApi.interpretTranscript.mockResolvedValue({
      shouldLogMeals: false,
      rescheduleMinutes: 1,
    });
    mockReschedule.mockResolvedValue(FROZEN_NOW + 60_000);
    const hook = renderSession();

    await endCall(['You: call me back in a minute']);

    expect(hook.current.statusText).toBe(
      'Next call in 1 minute at 10:01 AM.',
    );
  });

  it('falls back to the invalid-follow-up copy when the reschedule cannot be armed', async () => {
    mockApi.interpretTranscript.mockResolvedValue({
      shouldLogMeals: false,
      rescheduleMinutes: 45,
    });
    mockReschedule.mockResolvedValue(null);
    const hook = renderSession();

    await endCall(['You: call me back later']);

    expect(mockReschedule).toHaveBeenCalledWith(45);
    expect(hook.current.status).toBe('completed');
    expect(hook.current.statusText).toBe(FOLLOW_UP_INVALID_MESSAGE);
    expect(hook.current.statusText).toBe(
      'Could not schedule a valid follow-up time.',
    );
  });

  it('does not reschedule for a zero or null delay', async () => {
    mockApi.interpretTranscript.mockResolvedValue({
      shouldLogMeals: false,
      rescheduleMinutes: 0,
    });
    renderSession();

    await endCall(['You: nothing to log']);

    expect(mockReschedule).not.toHaveBeenCalled();
  });

  it('reports a duplicate transcript when no reschedule was requested', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockResolvedValue({
      entriesLogged: 0,
      duplicateTranscript: true,
    });
    const hook = renderSession();

    await endCall(['You: eggs again']);

    expect(hook.current.statusText).toBe(
      'This conversation was already logged recently, so no duplicate meals were added.',
    );
  });

  it('prefers the reschedule message over the duplicate message', async () => {
    mockApi.interpretTranscript.mockResolvedValue({
      shouldLogMeals: true,
      rescheduleMinutes: 20,
    });
    mockApi.parseTranscript.mockResolvedValue({
      entriesLogged: 0,
      duplicateTranscript: true,
    });
    mockReschedule.mockResolvedValue(FROZEN_NOW + 20 * 60_000);
    const hook = renderSession();

    await endCall(['You: eggs again']);

    expect(hook.current.statusText).toBe(
      'Next call in 20 minutes at 10:20 AM.',
    );
  });

  it('reports that nothing was logged', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: false });
    const hook = renderSession();

    await endCall(['You: just checking in']);

    expect(hook.current.statusText).toBe('No meals were logged in this call.');
  });

  it('reports the logged count when there is no follow-up message', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 2 });
    mockApi.getLog
      .mockResolvedValueOnce(mealsLog([]))
      .mockResolvedValue(mealsLog([120, 340]));
    const hook = renderSession();

    await endCall(['You: eggs and toast'], 5000);

    expect(hook.current.statusText).toBe('2 meals logged successfully!');
  });

  it('uses the singular noun for a single logged entry', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 1 });
    mockApi.getLog
      .mockResolvedValueOnce(mealsLog([]))
      .mockResolvedValue(mealsLog([120]));
    const hook = renderSession();

    await endCall(['You: an egg'], 5000);

    expect(hook.current.statusText).toBe('1 meal logged successfully!');
  });
});

describe('useVoiceMealSession — enrichment polling', () => {
  it('polls the log until the new entries carry nutrition, then stops', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 2 });
    mockApi.getLog
      .mockResolvedValueOnce(mealsLog([500])) // baseline: 1 total, 1 enriched
      .mockResolvedValueOnce(mealsLog([500, null, null])) // grown, not enriched
      .mockResolvedValue(mealsLog([500, 120, 340])); // enriched
    renderSession();

    await endCall(['You: eggs and toast'], 20000);

    // 1 baseline + 2 polls; the loop stops as soon as the targets are met.
    expect(mockApi.getLog).toHaveBeenCalledTimes(3);
    expect(mockApi.getLog).toHaveBeenNthCalledWith(1, TODAY);
    expect(mockApi.getLog).toHaveBeenNthCalledWith(3, TODAY);
  });

  it('skips polling entirely when nothing was logged', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 0 });
    renderSession();

    await endCall(['You: nothing really'], 20000);

    expect(mockApi.getLog).toHaveBeenCalledTimes(1); // baseline only
  });

  it('gives up after 12 attempts and still completes', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 1 });
    mockApi.getLog.mockResolvedValue(mealsLog([])); // never grows
    const hook = renderSession();

    await endCall(['You: eggs'], 12 * 1500 + 1000);

    expect(mockApi.getLog).toHaveBeenCalledTimes(13); // baseline + 12 polls
    expect(hook.current.status).toBe('completed');
    expect(hook.current.statusText).toBe('1 meal logged successfully!');
  });

  it('keeps polling when a poll request throws', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockResolvedValue({ entriesLogged: 1 });
    mockApi.getLog
      .mockResolvedValueOnce(mealsLog([])) // baseline
      .mockRejectedValueOnce(new Error('flaky')) // poll 1
      .mockResolvedValue(mealsLog([120])); // poll 2
    const hook = renderSession();

    await endCall(['You: an egg'], 20000);

    expect(mockApi.getLog).toHaveBeenCalledTimes(3);
    expect(hook.current.status).toBe('completed');
  });
});

describe('useVoiceMealSession — failure path', () => {
  it('surfaces the trimmed backend error and moves to the error status', async () => {
    mockApi.interpretTranscript.mockRejectedValue({
      response: { data: { error: '  Daily voice quota reached.  ' } },
    });
    const hook = renderSession();

    await endCall(['You: eggs']);

    expect(hook.current.status).toBe('error');
    expect(hook.current.statusText).toBe('Daily voice quota reached.');
  });

  it('falls back to the generic meal error when the rejection carries no message', async () => {
    mockApi.interpretTranscript.mockRejectedValue(new Error('socket hang up'));
    const hook = renderSession();

    await endCall(['You: eggs']);

    expect(hook.current.status).toBe('error');
    expect(hook.current.statusText).toBe(VOICE_LANE_COPY.meal.genericError);
  });

  it('falls back to the generic meal error for a blank backend error string', async () => {
    mockApi.interpretTranscript.mockRejectedValue({
      response: { data: { error: '   ' } },
    });
    const hook = renderSession();

    await endCall(['You: eggs']);

    expect(hook.current.statusText).toBe(VOICE_LANE_COPY.meal.genericError);
  });

  it('surfaces an error raised by the meal-logging parse too', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: true });
    mockApi.parseTranscript.mockRejectedValue({
      response: { data: { error: 'Could not read the meals.' } },
    });
    const hook = renderSession();

    await endCall(['You: eggs']);

    expect(hook.current.status).toBe('error');
    expect(hook.current.statusText).toBe('Could not read the meals.');
  });

  it('releases the in-flight guard after a failure', async () => {
    mockApi.interpretTranscript.mockRejectedValueOnce(new Error('boom'));
    mockApi.interpretTranscript.mockResolvedValueOnce({
      shouldLogMeals: false,
    });
    const hook = renderSession();

    await endCall(['You: eggs']);
    expect(hook.current.status).toBe('error');

    await endCall(['You: eggs and toast']);

    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(2);
    expect(hook.current.status).toBe('completed');
  });

  it('does not remember a failed transcript, so retrying the same words re-parses', async () => {
    mockApi.interpretTranscript.mockRejectedValueOnce(new Error('boom'));
    mockApi.interpretTranscript.mockResolvedValueOnce({
      shouldLogMeals: false,
    });
    renderSession();

    await endCall(['You: eggs']);
    await endCall(['You: eggs']);

    expect(mockApi.interpretTranscript).toHaveBeenCalledTimes(2);
  });
});

describe('useVoiceMealSession — session reset', () => {
  it('clears the logged count and the follow-up message when a new call starts', async () => {
    mockApi.interpretTranscript.mockResolvedValue({ shouldLogMeals: false });
    const hook = renderSession();

    await endCall(['You: just checking in']);
    expect(hook.current.statusText).toBe('No meals were logged in this call.');

    act(() => {
      laneOptions().onSessionReset?.();
    });

    expect(hook.current.status).toBe('completed');
    expect(hook.current.statusText).toBe('Call completed');
  });
});
