import apiClient from '../../../shared/api/client';
import { User } from '../../../types/types';

interface UserDto {
  id: string | number;
  name: string;
  email: string;
  age?: string;
  gender?: string;
  timezone?: string;
}

interface LoginDto extends UserDto {
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  name: string;
  age: string;
  gender: string;
  timezone: string;
}

export interface UpdateProfileRequest {
  name: string;
  age: string;
  gender: string;
  timezone: string;
}

export interface AuthenticatedSession {
  user: User;
  token: string;
}

const toUser = ({ id, name, email, age, gender, timezone }: UserDto): User => ({
  id: String(id),
  name,
  email,
  age,
  gender,
  timezone,
});

export const authApi = {
  async login(request: LoginRequest): Promise<AuthenticatedSession> {
    const { data } = await apiClient.post<LoginDto>('/auth/login', request);

    if (!data.token) {
      throw new Error('No access token received from server');
    }

    return { user: toUser(data), token: data.token };
  },

  async register(request: RegisterRequest): Promise<void> {
    await apiClient.post('/auth/register', request);
  },

  async getCurrentUser(): Promise<User> {
    const { data } = await apiClient.get<UserDto>('/auth/me');
    return toUser(data);
  },

  async updateProfile(request: UpdateProfileRequest): Promise<User> {
    const { data } = await apiClient.put<UserDto>('/profile', request);
    return toUser(data);
  },
};
