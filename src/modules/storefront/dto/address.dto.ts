import { z } from 'zod';

export const CreateAddressSchema = z.object({
  label: z.string().min(1).max(50).default('Home'),
  recipientName: z.string().min(1).max(150),
  phone: z.string().min(1).max(30),
  country: z.string().min(1).max(100).default('Ghana'),
  region: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  street: z.string().min(1),
  digitalAddress: z.string().max(30).optional(),
  isDefault: z.boolean().default(false),
});

export const UpdateAddressSchema = CreateAddressSchema.partial();

export type CreateAddressDto = z.infer<typeof CreateAddressSchema>;
export type UpdateAddressDto = z.infer<typeof UpdateAddressSchema>;
