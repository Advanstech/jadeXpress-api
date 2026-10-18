import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters'),
  code: z.string().min(2).max(10),
  address: z.string().optional().nullable(),
  city: z.string().default('Accra'),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  status: z.enum(['active', 'inactive', 'coming_soon']).default('active'),
  rxEnabled: z.boolean().default(false),
  terminalConfig: z.record(z.any()).optional().default({}),
});

export type CreateBranchDto = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema.partial();
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;
