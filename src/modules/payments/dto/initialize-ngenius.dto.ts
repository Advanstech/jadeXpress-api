import { z } from 'zod';

export const InitializeNgeniusSchema = z.object({
  amount: z.number().int().positive(), // pesewas — converted to GHS minor units (×100 already)
  currency: z.string().length(3).default('GHS'),
  reference: z.string().min(4).max(128),
  description: z.string().max(255).optional(),
  redirectUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type InitializeNgeniusDto = z.infer<typeof InitializeNgeniusSchema>;
