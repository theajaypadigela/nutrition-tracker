import apiClient from '../../api/client';
import { HttpClient } from './types';
import { User } from '../../types/types';

export interface LoginResponse {
  token: string;
  id: string;
  name: string;
  email: string;
  age?: string;
  gender?: string;
}

/**
 * Auth + profile endpoints. `client` is injectable for testing; production code uses the
 * default singleton (`authApi`).
 */
export const createAuthApi = (client: HttpClient = apiClient) => ({
  /** Current authenticated user (GET /auth/me). */
  me: () => client.get<User>('/auth/me').then(r => r.data),

  /** Authenticate and receive a token + user fields (POST /auth/login). */
  login: (email: string, password: string) =>
    client
      .post<LoginResponse>('/auth/login', { email, password })
      .then(r => r.data),

  /** Create an account (POST /auth/register). */
  register: (
    name: string,
    email: string,
    password: string,
    age: string,
    gender: string,
  ) =>
    client
      .post('/auth/register', { name, email, password, age, gender })
      .then(r => r.data),

  /** Update the current user's profile (PUT /profile); returns the updated user. */
  updateProfile: (name: string, age: string, gender: string) =>
    client.put<User>('/profile', { name, age, gender }).then(r => r.data),
});

export const authApi = createAuthApi();
