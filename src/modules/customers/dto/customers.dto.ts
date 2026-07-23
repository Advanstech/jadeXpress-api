import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.string().max(20).optional(),
  address: z.string().optional(),
  healthNotes: z.string().optional(),
  allergens: z.array(z.string()).default([]),
  preferredBrands: z.array(z.string()).default([]),
  dietaryRestrictions: z.array(z.string()).default([]),
  storeId: z.string().uuid().optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

// Natural-language search → structured filters (AI endpoint)
export const NlSearchSchema = z.object({
  query: z.string().min(1).max(500),
  storeId: z.string().uuid().optional(),
});

export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerSchema>;
export type NlSearchDto = z.infer<typeof NlSearchSchema>;
