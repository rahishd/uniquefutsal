// Auth Module - Domain Transfer Object (DTO)

export interface LoginDTO {
  identifier: string; // email or phone number
  password: string;
}

export interface SignupDTO {
  email?: string;
  password: string;
  name: string;
  phoneNumber: string;
}

export interface RefreshTokenDTO {
  refreshToken: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    name: string;
    phoneNumber: string;
    role: string;
    avatar?: string;
    freeMatchesAvailable?: number;
    isVerified?: boolean;
  };
}

export interface MeResponse {
  id: string;
  email: string | null;
  name: string;
  phoneNumber: string;
  role: string;
  avatar?: string;
  freeMatchesAvailable?: number;
  isVerified?: boolean;
}

export interface UpdateMeDTO {
  name?: string;
  avatar?: string; // base64 data URL or remote URL
}

export interface ForgotPasswordDTO {
  phoneNumber: string;
}

export interface ResetPasswordDTO {
  phoneNumber: string;
  otp: string;
  newPassword: string;
}

export interface ChangePasswordDTO {
  currentPassword?: string;
  newPassword: string;
}
