export interface TokenPayload {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface RefreshTokenResult {
  refreshToken: string;
  expiresAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}
