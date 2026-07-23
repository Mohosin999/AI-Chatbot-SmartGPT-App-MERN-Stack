import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(5).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

export const googleLoginSchema = z.object({
  credential: z.string().min(1, "Google credential is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
