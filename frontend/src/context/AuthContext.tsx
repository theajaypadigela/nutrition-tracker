import React, {
  createContext,
  useCallback,
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
import { useOnboarding } from './OnboardingContext';
import { unregisterCurrentIosVoipToken } from '../services/notifications/voipTokenService';
import { setPendingAcceptNavigation } from '../navigation/pendingNavigation';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
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

/**
 * Session and identity only. First-run flow state lives in OnboardingContext, which
 * must be mounted above this provider: registration arms that flow, so this consumes it
 * rather than owning it (F14).
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { beginOnboarding, resetOnboarding } = useOnboarding();

  const logout = useCallback(async () => {
    // The DELETE endpoint is authenticated, so unregister before removing the JWT.
    await unregisterCurrentIosVoipToken().catch(() => false);
    await setPendingAcceptNavigation(null);
    await clearToken();
    setUser(null);
    resetOnboarding();
    // Cancel all local triggers and clear device-local reminder state on logout.
    await onLogoutReminders().catch(() => {});
  }, [resetOnboarding]);

  // Register the logout handler the API client calls on a 401. Re-registers if the
  // callback's identity changes, so the client never holds a stale closure.
  useEffect(() => {
    registerUnauthorizedHandler(logout);
  }, [logout]);

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
    beginOnboarding();
    try {
      await authApi.register(name, email, password, dob, gender);

      await login(email, password);
    } catch (error) {
      resetOnboarding();
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
