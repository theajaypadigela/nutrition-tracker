import React, { createContext, useState, useContext, ReactNode } from 'react';
import { User } from '../types/types';
import apiClient from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    age: string,
    gender: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient({
        method: 'POST',
        url: '/auth/login',
        data: { email, password },
      });

      const data = response.data;

      // Set user data from response
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        age: data.age,
        gender: data.gender,
      });
    } catch (error: any) {
      console.error('Login error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code,
      });
      const errorMessage =
        error.response?.data?.message || error.message || 'Login failed';
      throw new Error(errorMessage);
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

      // Auto-login after registration
      const loginResponse = await apiClient({
        method: 'POST',
        url: '/auth/login',
        data: { email, password },
      });

      const data = loginResponse.data;

      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        age: data.age,
        gender: data.gender,
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Registration failed';
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
