import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/types';
import apiClient from '../api/client';
import { setLogoutHandler } from '../services/authService';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setUser(null);
  };

  // Set the logout handler for the API client
  useEffect(() => {
    setLogoutHandler(logout);
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');

        if (!token) return;

        const response = await apiClient.get('/auth/me');
        setUser(response.data);
      } catch (error) {
        console.error(error);
        await AsyncStorage.removeItem('token');
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
      const response = await apiClient({
        method: 'POST',
        url: '/auth/login',
        data: { email, password },
      });

      const data = response.data;

      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      } else {
        throw new Error('No access token received from server');
      }

      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        age: data.age,
        gender: data.gender,
      });
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
      await apiClient({
        method: 'POST',
        url: '/auth/register',
        data: { name, email, password, age, gender },
      });

      await login(email, password);
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
