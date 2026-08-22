import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from 'react';
import { User } from '../types/types';
import { registerUnauthorizedHandler } from '../api/client';
import { authApi } from '../services/api/authApi';
import {
  onLoginReminders,
  onLogoutReminders,
} from '../services/notifications/reminderService';
import {
  clearToken,
  getToken,
  setToken,
} from '../services/storage/tokenStorage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  /**
   * True for the duration of an app session right after a fresh registration, so the
   * authenticated navigator opens on the one-time call-setup flow instead of MainTabs.
   * Resets to false on app reload and once onboarding is finished.
   */
  needsOnboarding: boolean;
  /**
   * Formatted call time chosen during registration (e.g. "8:00 PM"), or null. When set,
   * the onboarding gate skips Call Setup and opens directly on the Done screen.
   */
  onboardingCallTime: string | null;
  setOnboardingCallTime: (t: string | null) => void;
  completeOnboarding: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    dob: string,
    gender: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, age: string, gender: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingCallTime, setOnboardingCallTime] = useState<string | null>(
    null,
  );

  const completeOnboarding = () => {
    setNeedsOnboarding(false);
    setOnboardingCallTime(null);
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
    setNeedsOnboarding(false);
    setOnboardingCallTime(null);
    // Cancel all local triggers and clear device-local reminder state on logout.
    await onLogoutReminders().catch(() => {});
  };

  // Register the logout handler the API client calls on a 401.
  useEffect(() => {
    registerUnauthorizedHandler(logout);
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = await getToken();

        if (!token) return;

        const me = await authApi.me();
        setUser(me);
        // Converge reminders from server state on every authenticated launch
        // (covers reinstall / data-clear / second device).
        onLoginReminders().catch(() => {});
      } catch (error) {
        console.error(error);
        await clearToken();
        setUser(null);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const data = await authApi.login(email, password);

      if (data.token) {
        await setToken(data.token);
      } else {
        throw new Error('No access token received from server');
      }

      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        age: data.age,
        dob: data.dob,
        gender: data.gender,
      });

      // Rebuild reminders from server state for this account (incl. a second device).
      onLoginReminders().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    dob: string,
    gender: string,
  ) => {
    setIsLoading(true);
    // Flag onboarding before login flips isAuthenticated, so the authenticated
    // navigator mounts on the call-setup flow rather than MainTabs.
    setNeedsOnboarding(true);
    try {
      await authApi.register(name, email, password, dob, gender);

      await login(email, password);
    } catch (error) {
      setNeedsOnboarding(false);
      setOnboardingCallTime(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (name: string, age: string, gender: string) => {
    setIsLoading(true);
    try {
      const updated = await authApi.updateProfile(name, age, gender);

      setUser(updated);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isInitializing,
        isLoading,
        needsOnboarding,
        onboardingCallTime,
        setOnboardingCallTime,
        completeOnboarding,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
