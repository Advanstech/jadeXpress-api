import { z } from 'zod';

// Standard email + password login (web/manager portal)
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  storeId: z.string().uuid().optional(),
});

// PIN login — POS touchscreen cashier login
export const PinLoginSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be numeric'),
  staffId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  email: z.string().email().optional(),
}).refine(
  (data) => (data.staffId && data.storeId) || data.email,
  { message: 'Provide either staffId + storeId or email', path: ['email'] },
);

// Manager PIN verification — for overrides/refunds/discounts without full re-login
export const PinVerifySchema = z.object({
  staffId: z.string().uuid(),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be numeric'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const ChangePinSchema = z.object({
  currentPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be numeric'),
  newPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be numeric'),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type PinLoginDto = z.infer<typeof PinLoginSchema>;
export type PinVerifyDto = z.infer<typeof PinVerifySchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
export type ChangePinDto = z.infer<typeof ChangePinSchema>;
