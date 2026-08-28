import { z } from 'zod';

export const CreateContactMessageSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(150),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().max(50).optional().nullable(),
  subject: z.string().max(255).optional().nullable(),
  message: z.string().min(5, 'Message must be at least 5 characters').max(3000),
});

export const UpdateContactMessageSchema = z.object({
  status: z.enum(['unread', 'read', 'in_progress', 'replied', 'archived']).optional(),
  adminNotes: z.string().optional().nullable(),
  adminReply: z.string().optional().nullable(),
});

export type CreateContactMessageDto = z.infer<typeof CreateContactMessageSchema>;
export type UpdateContactMessageDto = z.infer<typeof UpdateContactMessageSchema>;
