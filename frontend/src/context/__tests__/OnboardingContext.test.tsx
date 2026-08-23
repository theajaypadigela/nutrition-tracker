import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingProvider, useOnboarding } from '../OnboardingContext';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi } from '@/services/api/authApi';

// Only needed by the provider-order tests below: AuthProvider is the one real consumer
// of this context, and mounting it drags in its own service edges. OnboardingContext
// itself has no edges to mock.
jest.mock('@/services/api/authApi', () => ({
  authApi: {
    me: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

jest.mock('@/services/notifications/reminderService', () => ({
  onLoginReminders: jest.fn(() => Promise.resolve()),
  onLogoutReminders: jest.fn(() => Promise.resolve()),
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

type OnboardingApi = ReturnType<typeof useOnboarding>;
type AuthApi = ReturnType<typeof useAuth>;

/**
 * Mounts the provider under a parent that owns unrelated state, and records the context
 * value seen on every render of the consumer. The recorded list is what lets the
 * memoisation tests distinguish "did not re-render" from "re-rendered with the same
 * value object".
 */
function setup() {
  const seen: OnboardingApi[] = [];
  let bumpParent: () => void = () => {};

  const Capture = () => {
    seen.push(useOnboarding());
    return null;
  };

  const Root = () => {
    const [, setTick] = React.useState(0);
    bumpParent = () => setTick(t => t + 1);
    return (
      <OnboardingProvider>
        <Capture />
      </OnboardingProvider>
    );
  };

  act(() => {
    ReactTestRenderer.create(<Root />);
  });

  return {
    seen,
    current: () => seen[seen.length - 1],
    /** Re-renders the tree from above the provider, changing nothing it owns. */
    rerenderFromAbove: () => {
      act(() => {
        bumpParent();
      });
    },
    run: (fn: (ctx: OnboardingApi) => void) => {
      act(() => {
        fn(seen[seen.length - 1]);
      });
    },
  };
}

/** OnboardingProvider > AuthProvider, exactly as App.tsx mounts them. */
function setupWithAuth() {
  let onboarding: OnboardingApi | undefined;
  let auth: AuthApi | undefined;

  const Capture = () => {
    onboarding = useOnboarding();
    auth = useAuth();
    return null;
  };

  act(() => {
    ReactTestRenderer.create(
      <OnboardingProvider>
        <AuthProvider>
          <Capture />
        </AuthProvider>
      </OnboardingProvider>,
    );
  });

  return {
    onboarding: () => onboarding as OnboardingApi,
    auth: () => auth as AuthApi,
  };
}

let errSpy: jest.SpyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
});

describe('OnboardingContext', () => {
  it('throws a named error when useOnboarding is called outside the provider', () => {
    const Bare = () => {
      useOnboarding();
      return null;
    };

    expect(() => {
      act(() => {
        ReactTestRenderer.create(<Bare />);
      });
    }).toThrow('useOnboarding must be used within an OnboardingProvider');
  });

  it('starts with the flow disarmed and no call time', () => {
    const ctx = setup();
    expect(ctx.current().needsOnboarding).toBe(false);
    expect(ctx.current().onboardingCallTime).toBeNull();
  });

  it('beginOnboarding arms the one-time flow without touching the call time', () => {
    const ctx = setup();
    ctx.run(c => c.beginOnboarding());

    expect(ctx.current().needsOnboarding).toBe(true);
    expect(ctx.current().onboardingCallTime).toBeNull();
  });

  it('exposes completeOnboarding and resetOnboarding as the same clear callback', () => {
    const ctx = setup();
    // Documented aliasing: two names, one implementation. A future change that gives
    // them different bodies has to change this line deliberately.
    expect(ctx.current().completeOnboarding).toBe(ctx.current().resetOnboarding);
  });

  it('completeOnboarding clears the flag and the stored call time', () => {
    const ctx = setup();
    ctx.run(c => {
      c.beginOnboarding();
      c.setOnboardingCallTime('8:00 PM');
    });
    expect(ctx.current().needsOnboarding).toBe(true);
    expect(ctx.current().onboardingCallTime).toBe('8:00 PM');

    ctx.run(c => c.completeOnboarding());

    expect(ctx.current().needsOnboarding).toBe(false);
    expect(ctx.current().onboardingCallTime).toBeNull();
  });

  it('resetOnboarding clears the flag and the stored call time (abandon path)', () => {
    const ctx = setup();
    ctx.run(c => {
      c.beginOnboarding();
      c.setOnboardingCallTime('7:30 AM');
    });

    ctx.run(c => c.resetOnboarding());

    expect(ctx.current().needsOnboarding).toBe(false);
    expect(ctx.current().onboardingCallTime).toBeNull();
  });

  it('setOnboardingCallTime stores a formatted time, and null clears it, without arming the flow', () => {
    const ctx = setup();

    ctx.run(c => c.setOnboardingCallTime('8:00 PM'));
    expect(ctx.current().onboardingCallTime).toBe('8:00 PM');
    expect(ctx.current().needsOnboarding).toBe(false);

    ctx.run(c => c.setOnboardingCallTime(null));
    expect(ctx.current().onboardingCallTime).toBeNull();
    expect(ctx.current().needsOnboarding).toBe(false);
  });

  describe('memoisation (the point of the F14 split)', () => {
    it('keeps the callbacks stable across a re-render from above the provider', () => {
      const ctx = setup();
      const before = ctx.current();

      ctx.rerenderFromAbove();

      const after = ctx.current();
      // The consumer really did render again — mount + the parent bump, no more.
      expect(ctx.seen.length).toBe(2);
      // ...with identical callback identities.
      expect(after.beginOnboarding).toBe(before.beginOnboarding);
      expect(after.completeOnboarding).toBe(before.completeOnboarding);
      expect(after.resetOnboarding).toBe(before.resetOnboarding);
      expect(after.setOnboardingCallTime).toBe(before.setOnboardingCallTime);
    });

    it('hands out the same context value object when nothing it owns changed', () => {
      const ctx = setup();
      const before = ctx.current();

      ctx.rerenderFromAbove();

      expect(ctx.seen.length).toBe(2);
      expect(ctx.current()).toBe(before);
    });

    it('produces a new context value only when needsOnboarding or onboardingCallTime change', () => {
      const ctx = setup();
      const initial = ctx.current();

      ctx.run(c => c.beginOnboarding());
      const armed = ctx.current();
      expect(armed).not.toBe(initial);
      expect(armed.needsOnboarding).toBe(true);

      // Re-arming an already-armed flow is not a change.
      ctx.run(c => c.beginOnboarding());
      expect(ctx.current()).toBe(armed);

      ctx.run(c => c.setOnboardingCallTime('8:00 PM'));
      const timed = ctx.current();
      expect(timed).not.toBe(armed);

      // Same string again is not a change.
      ctx.run(c => c.setOnboardingCallTime('8:00 PM'));
      expect(ctx.current()).toBe(timed);

      ctx.run(c => c.completeOnboarding());
      expect(ctx.current()).not.toBe(timed);

      // Clearing already-clear state is not a change either.
      const cleared = ctx.current();
      ctx.run(c => c.completeOnboarding());
      expect(ctx.current()).toBe(cleared);
    });
  });

  describe('provider order: OnboardingProvider must sit above AuthProvider', () => {
    it('throws if AuthProvider is mounted without an OnboardingProvider above it', () => {
      // The regression that returns the moment someone reorders App.tsx.
      expect(() => {
        act(() => {
          ReactTestRenderer.create(
            <AuthProvider>
              <React.Fragment />
            </AuthProvider>,
          );
        });
      }).toThrow('useOnboarding must be used within an OnboardingProvider');
    });

    it('lets AuthProvider arm the flow through the provider above it on register', async () => {
      const ctx = setupWithAuth();
      expect(ctx.onboarding().needsOnboarding).toBe(false);

      mockAuthApi.register.mockResolvedValueOnce({});
      mockAuthApi.login.mockResolvedValueOnce({
        token: 'tok-1',
        id: '7',
        name: 'Bo',
        email: 'bo@x.io',
      });

      await act(async () => {
        await ctx.auth().register('Bo', 'bo@x.io', 'pw', '2000-05-15', 'm');
      });

      expect(ctx.auth().isAuthenticated).toBe(true);
      expect(ctx.onboarding().needsOnboarding).toBe(true);
    });

    it('lets AuthProvider reset the flow when registration fails', async () => {
      const ctx = setupWithAuth();
      mockAuthApi.register.mockRejectedValueOnce(new Error('email taken'));

      await act(async () => {
        await expect(
          ctx.auth().register('Bo', 'bo@x.io', 'pw', '2000-05-15', 'm'),
        ).rejects.toThrow('email taken');
      });

      expect(mockAuthApi.login).not.toHaveBeenCalled();
      expect(ctx.onboarding().needsOnboarding).toBe(false);
    });

    it('lets AuthProvider reset the flow on logout', async () => {
      const ctx = setupWithAuth();

      act(() => {
        ctx.onboarding().beginOnboarding();
        ctx.onboarding().setOnboardingCallTime('8:00 PM');
      });
      expect(ctx.onboarding().needsOnboarding).toBe(true);

      await act(async () => {
        await ctx.auth().logout();
      });

      expect(ctx.onboarding().needsOnboarding).toBe(false);
      expect(ctx.onboarding().onboardingCallTime).toBeNull();
    });
  });
});
