import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, desc, ilike, or, and, sql, count } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { contactMessages } from '../../database/schema';
import type { CreateContactMessageDto, UpdateContactMessageDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createContactMessage(dto: CreateContactMessageDto, customerId?: string) {
    const [msg] = await this.db
      .insert(contactMessages)
      .values({
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        subject: dto.subject?.trim() || 'General Inquiry',
        message: dto.message.trim(),
        customerId: customerId || undefined,
        status: 'unread',
      })
      .returning();

    return {
      success: true,
      message: 'Your message has been received! Our team will get back to you shortly.',
      data: msg,
    };
  }

  async getMessages(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (params.status && params.status !== 'all') {
      conditions.push(eq(contactMessages.status, params.status));
    }

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(contactMessages.name, q),
          ilike(contactMessages.email, q),
          ilike(contactMessages.subject, q),
          ilike(contactMessages.message, q),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRes, unreadRes] = await Promise.all([
      this.db
        .select()
        .from(contactMessages)
        .where(whereClause)
        .orderBy(desc(contactMessages.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(contactMessages)
        .where(whereClause),
      this.db
        .select({ count: count() })
        .from(contactMessages)
        .where(eq(contactMessages.status, 'unread')),
    ]);

    const total = Number(totalRes[0]?.count ?? 0);
    const unreadCount = Number(unreadRes[0]?.count ?? 0);

    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        subject: r.subject,
        message: r.message,
        status: r.status,
        read: r.status !== 'unread',
        adminNotes: r.adminNotes,
        adminReply: r.adminReply,
        repliedAt: r.repliedAt,
        customerId: r.customerId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
      },
    };
  }

  async getMessageById(id: string) {
    const [msg] = await this.db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.id, id));

    if (!msg) throw new NotFoundException('Message not found');

    return {
      id: msg.id,
      name: msg.name,
      email: msg.email,
      phone: msg.phone,
      subject: msg.subject,
      message: msg.message,
      status: msg.status,
      read: msg.status !== 'unread',
      adminNotes: msg.adminNotes,
      adminReply: msg.adminReply,
      repliedAt: msg.repliedAt,
      customerId: msg.customerId,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    };
  }

  async updateMessage(id: string, dto: UpdateContactMessageDto) {
    await this.getMessageById(id);

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (dto.status !== undefined) {
      updatePayload.status = dto.status;
    }

    if (dto.adminNotes !== undefined) {
      updatePayload.adminNotes = dto.adminNotes;
    }

    if (dto.adminReply !== undefined) {
      updatePayload.adminReply = dto.adminReply;
      updatePayload.repliedAt = new Date();
      if (!dto.status) {
        updatePayload.status = 'replied';
      }
    }

    const [updated] = await this.db
      .update(contactMessages)
      .set(updatePayload)
      .where(eq(contactMessages.id, id))
      .returning();

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      subject: updated.subject,
      message: updated.message,
      status: updated.status,
      read: updated.status !== 'unread',
      adminNotes: updated.adminNotes,
      adminReply: updated.adminReply,
      repliedAt: updated.repliedAt,
      customerId: updated.customerId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteMessage(id: string) {
    await this.getMessageById(id);
    await this.db.delete(contactMessages).where(eq(contactMessages.id, id));
    return { success: true, message: 'Message deleted successfully' };
  }
}
