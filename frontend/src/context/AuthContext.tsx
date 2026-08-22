import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useCallback,
} from 'react';
import { AppState } from 'react-native';
import { User } from '../types/types';
import { authApi } from '../features/auth/api/authApi';
import { subscribeToUnauthorized } from '../shared/api/sessionEvents';
import { sessionStore } from '../shared/storage/sessionStore';
import { getDeviceTimeZone } from '../shared/date-time/deviceTimeZone';
import {
  cancelAllReminders,
  reconcileReminders,
} from '../services/reminderCoordinator';

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
    age: string,
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

  const logout = useCallback(async () => {
    setUser(null);
    await Promise.all([sessionStore.clearSession(), cancelAllReminders()]);
  }, []);

  // The API boundary publishes unauthorized events without importing React.
  useEffect(() => {
    return subscribeToUnauthorized(() => {
      logout().catch(error => {
        console.error('Failed to clear the expired session:', error);
      });
    });
  }, [logout]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = await sessionStore.getToken();

        if (!token) {
          await Promise.all([
            sessionStore.clearSession(),
            cancelAllReminders(),
          ]);
          return;
        }

        const currentUser = await authApi.getCurrentUser();
        await sessionStore.setUserId(currentUser.id);
        setUser(currentUser);
      } catch (error) {
        console.error(error);
        await Promise.all([sessionStore.clearSession(), cancelAllReminders()]);
        setUser(null);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    reconcileReminders(user.id).catch(error => {
      console.error('Failed to reconcile reminders after login:', error);
    });
  }, [user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active' || !user?.id) return;

      reconcileReminders(user.id).catch(error => {
        console.error('Failed to reconcile reminders on foreground:', error);
      });
    });

    return () => subscription.remove();
  }, [user?.id]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const session = await authApi.login({ email, password });
      await sessionStore.setSession(session.token, session.user.id);
      setUser(session.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    age: string,
    gender: string,
  ) => {
    setIsLoading(true);
    try {
      await authApi.register({
        name,
        email,
        password,
        age,
        gender,
        timezone: getDeviceTimeZone(),
      });

      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (name: string, age: string, gender: string) => {
    setIsLoading(true);
    try {
      setUser(
        await authApi.updateProfile({
          name,
          age,
          gender,
          timezone: user?.timezone ?? getDeviceTimeZone(),
        }),
      );
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
