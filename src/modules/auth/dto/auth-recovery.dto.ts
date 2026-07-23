import { z } from 'zod';

export const ForgotCredentialSchema = z.object({
  email: z.string().email(),
});

export const ResetCredentialSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().length(6).regex(/^\d+$/, 'OTP must be numeric'),
  newSecret: z.string().min(4), // Will be checked specifically for pin/password in service
});

export type ForgotCredentialDto = z.infer<typeof ForgotCredentialSchema>;
export type ResetCredentialDto = z.infer<typeof ResetCredentialSchema>;
