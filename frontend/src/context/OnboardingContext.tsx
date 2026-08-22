import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

interface OnboardingContextType {
  /**
   * True for the duration of an app session right after a fresh registration, so the
   * authenticated navigator opens on the one-time call-setup flow instead of MainTabs.
   * Deliberately not persisted: it resets on app reload, so it only ever fires for the
   * session that did the registering.
   */
  needsOnboarding: boolean;
  /**
   * Formatted call time chosen during registration (e.g. "8:00 PM"), or null. When set,
   * the onboarding gate skips Call Setup and opens directly on the Done screen.
   *
   * NOTE: no caller sets this today — the onboarding screens pass the chosen time to the
   * Done screen as a navigation param instead (see OnboardingMealScheduleScreen ->
   * OnboardingDone). It is carried across unchanged from AuthContext rather than removed,
   * because removing it also removes a navigator branch; flagged for a decision.
   */
  onboardingCallTime: string | null;
  setOnboardingCallTime: (time: string | null) => void;
  /** Arms the one-time flow. Called by registration, before isAuthenticated flips. */
  beginOnboarding: () => void;
  /** The user finished the flow. */
  completeOnboarding: () => void;
  /** The flow was abandoned rather than finished — registration failed, or logout. */
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined,
);

/**
 * First-run flow state, split out of AuthContext (F14).
 *
 * It lived there because registration arms it, but it is not session or identity: any
 * onboarding change used to re-render every single useAuth() consumer in the app. Kept
 * separate, and mounted *above* AuthProvider so AuthProvider can arm and reset it while
 * the two navigator/screen consumers subscribe only to this.
 */
export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingCallTime, setOnboardingCallTime] = useState<string | null>(
    null,
  );

  const beginOnboarding = useCallback(() => setNeedsOnboarding(true), []);

  // Finishing and abandoning clear the same state; they are separate names because the
  // call sites mean different things and the log/trace reads better for it.
  const clear = useCallback(() => {
    setNeedsOnboarding(false);
    setOnboardingCallTime(null);
  }, []);

  const value = useMemo<OnboardingContextType>(
    () => ({
      needsOnboarding,
      onboardingCallTime,
      setOnboardingCallTime,
      beginOnboarding,
      completeOnboarding: clear,
      resetOnboarding: clear,
    }),
    [needsOnboarding, onboardingCallTime, beginOnboarding, clear],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
