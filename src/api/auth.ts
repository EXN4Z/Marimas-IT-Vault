import api from './axios';
import type { User } from '../types/user';

interface AuthResponse {
  user: User;
  token: string;
}

interface ResetPasswordResponse {
  message: string;
  user: {
    id: number;
    name: string;
  }
  new_password: string;
}

interface SetPasswordResponse {
  message: string;
  user: {
    id: number;
    name: string;
  }
}

interface RegisterResponse {
  message: string;
  registration_id: string;
}

interface ImportKaryawanResponse {
  success: boolean;
  message?: string;
  errors?: string[];
}

export const login = async (loginIdentifier: string, password: string): Promise<AuthResponse> => {
  const res = await api.post('/login', { login: loginIdentifier, password });
  return res.data;
};

export const register = async (
  name: string,
  email: string,
  phone: string,
  password: string,
  password_confirmation: string
): Promise<RegisterResponse> => {
  const res = await api.post('/register', { name, email, phone, password, password_confirmation });
  return res.data;
};

export const verifyOtp = async (registration_id: string, otp_code: string): Promise<AuthResponse> => {
  const res = await api.post('/verify-otp', { registration_id, otp_code });
  return res.data;
};

export const resetKaryawanPassword = async(id: number): Promise<ResetPasswordResponse> => {
  const res = await api.post<ResetPasswordResponse>(`/admin/users/${id}/reset-password`);
  return res.data;
}

// BARU: admin nentuin sendiri password barunya (bukan random) buat akun manapun.
export const setKaryawanPassword = async(
  id: number,
  password: string,
  password_confirmation: string
): Promise<SetPasswordResponse> => {
  const res = await api.post<SetPasswordResponse>(`/admin/users/${id}/set-password`, {
    password,
    password_confirmation,
  });
  return res.data;
}

export const resendOtp = async (registration_id: string): Promise<{ message: string }> => {
  const res = await api.post('/resend-otp', { registration_id });
  return res.data;
};

export const updateProfile = async (payload: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<User> => {
  const res = await api.put<User>('/profile', payload);
  return res.data;
};

export const changePassword = async (payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> => {
  const res = await api.put('/change-password', payload);
  return res.data;
};

export const importKaryawan = async (file: File): Promise<ImportKaryawanResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post<ImportKaryawanResponse>('/import-karyawan', formData);
  return res.data;
};