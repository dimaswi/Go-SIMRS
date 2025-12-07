import { api } from './client';
import type { User } from './types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: (data: LoginRequest) => 
    api.post<LoginResponse>('/auth/login', data),
  
  getProfile: () => 
    api.get<User>('/auth/profile'),
};