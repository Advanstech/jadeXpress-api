import { z } from 'zod';

const ShippingAddressSchema = z.object({
  recipientName: z.string().min(1).max(150),
  phone: z.string().min(1).max(30),
  email: z.string().email(),
  country: z.string().min(1).max(100).default('Ghana'),
  region: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  street: z.string().min(1),
  digitalAddress: z.string().max(30).optional().nullable(),
  courier: z
    .object({
      provider: z.string().optional(),
      service: z.string().optional(),
      eta: z.string().optional(),
      trackingNumber: z.string().optional(),
    })
    .optional()
    .nullable(),
});

const OrderItemSchema = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().min(1),
  price: z.number().int().nonnegative(), // pesewas
  quantity: z.number().int().positive(),
  image: z.string().optional().nullable(),
});

export const CreateOrderSchema = z.object({
  email: z.string().email(),
  items: z.array(OrderItemSchema).min(1),
  shippingFeePesewas: z.number().int().nonnegative().default(0),
  shippingAddress: ShippingAddressSchema,
  paymentGateway: z.enum(['paystack', 'momo']).optional(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  note: z.string().optional(),
});

export const MarkPaidSchema = z.object({
  reference: z.string().min(1),
  gateway: z.string().min(1),
  method: z.string().optional(),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
export type MarkPaidDto = z.infer<typeof MarkPaidSchema>;
