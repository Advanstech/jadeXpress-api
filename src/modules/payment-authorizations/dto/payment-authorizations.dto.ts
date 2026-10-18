import { z } from 'zod';

export const createPaymentAuthorizationSchema = z.object({
  storeId: z.string().uuid(),
  title: z.string().min(2, 'Title is required'),
  category: z
    .enum([
      'supplier_invoice',
      'operational_expense',
      'inter_branch_settlement',
      'refund_payout',
      'payroll_advance',
      'utility',
      'general',
    ])
    .default('operational_expense'),

  referenceType: z.string().optional().nullable(),
  referenceId: z.string().uuid().optional().nullable(),

  payeeName: z.string().min(2, 'Payee name is required'),
  amountPesewas: z.number().int().positive('Amount must be positive'),
  currencyCode: z.string().default('GHS'),

  paymentMethod: z
    .enum(['momo', 'bank_transfer', 'cash', 'card', 'cheque'])
    .default('momo'),
  momoPhoneNumber: z.string().optional().nullable(),
  momoNetwork: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),

  notes: z.string().optional().nullable(),

  // Optional AI receipt data
  receiptUrl: z.string().optional().nullable(),
  receiptOcrExtracted: z.boolean().default(false),
  receiptOcrConfidence: z.number().optional().nullable(),
  receiptOcrData: z.record(z.any()).optional().nullable(),
});

export type CreatePaymentAuthorizationDto = z.infer<
  typeof createPaymentAuthorizationSchema
>;

export const approvePaymentAuthorizationSchema = z.object({
  notes: z.string().optional().nullable(),
  managerPin: z.string().optional().nullable(),
});

export type ApprovePaymentAuthorizationDto = z.infer<
  typeof approvePaymentAuthorizationSchema
>;

export const rejectPaymentAuthorizationSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required'),
});

export type RejectPaymentAuthorizationDto = z.infer<
  typeof rejectPaymentAuthorizationSchema
>;

export const disbursePaymentAuthorizationSchema = z.object({
  transactionReference: z.string().min(2, 'Transaction reference is required'),
  notes: z.string().optional().nullable(),
});

export type DisbursePaymentAuthorizationDto = z.infer<
  typeof disbursePaymentAuthorizationSchema
>;
