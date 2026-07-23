import { z } from 'zod';

export const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1).max(150),
  storeId: z.string().uuid().optional(),
  systemCode: z
    .enum(['rent','utilities','salaries','supplies','marketing','maintenance','transport','regulatory','insurance','miscellaneous'])
    .optional(),
});

export const CreateExpenseSchema = z.object({
  storeId: z.string().uuid(),
  categoryId: z.string().uuid(),
  description: z.string().min(1).max(500),
  amountPesewas: z.number().int().min(1),
  expenseDate: z.string().datetime().optional(),
  receiptImageUrl: z.string().url().optional(),
  vendor: z.string().max(255).optional(),
  referenceNumber: z.string().max(100).optional(),
  ocrExtracted: z.boolean().default(false),
  notes: z.string().optional(),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export type CreateExpenseCategoryDto = z.infer<typeof CreateExpenseCategorySchema>;
export type CreateExpenseDto = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof UpdateExpenseSchema>;
