import { z } from 'zod';

export const CreateStaffSchema = z.object({
  storeId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  role: z.enum(['owner','manager','supervisor','cashier','pharmacist','stock_officer']).default('cashier'),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be numeric').optional(),
  password: z.string().min(8).optional(),
  avatarUrl: z.string().url().optional(),
  idDocumentUrl: z.string().url().optional(),
  licenseNumber: z.string().optional(),
});

export const UpdateStaffSchema = CreateStaffSchema.omit({ pin: true, password: true }).partial();

export const ChangePinSchema = z.object({
  staffId: z.string().uuid(),
  currentPin: z.string().min(4).max(6),
  newPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be numeric'),
});

export const ClockInSchema = z.object({
  storeId: z.string().uuid(),
  openingFloat: z.number().int().min(0).default(0),
});

export const ClockOutSchema = z.object({
  shiftId: z.string().uuid(),
});

export type CreateStaffDto = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffDto = z.infer<typeof UpdateStaffSchema>;
export type ChangePinDto = z.infer<typeof ChangePinSchema>;
export type ClockInDto = z.infer<typeof ClockInSchema>;
export type ClockOutDto = z.infer<typeof ClockOutSchema>;
