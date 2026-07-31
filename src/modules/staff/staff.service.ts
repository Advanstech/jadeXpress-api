import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { staffProfile, shiftReconciliation } from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type { CreateStaffDto, UpdateStaffDto, ChangePinDto, ClockInDto, ClockOutDto } from './dto/staff.dto';

import { EmailService } from '../email/email.service';

// Safe staff select — never returns pinHash or passwordHash
const safeSelect = {
  id: staffProfile.id,
  storeId: staffProfile.storeId,
  firstName: staffProfile.firstName,
  lastName: staffProfile.lastName,
  email: staffProfile.email,
  phone: staffProfile.phone,
  role: staffProfile.role,
  isActive: staffProfile.isActive,
  requiresPinChange: staffProfile.requiresPinChange,
  requiresPasswordChange: staffProfile.requiresPasswordChange,
  biometricEnabled: staffProfile.biometricEnabled,
  avatarUrl: staffProfile.avatarUrl,
  licenseNumber: staffProfile.licenseNumber,
  permissionsOverride: staffProfile.permissionsOverride,
  createdAt: staffProfile.createdAt,
  updatedAt: staffProfile.updatedAt,
};

@Injectable()
export class StaffService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly emailService: EmailService,
  ) {}

  async list(storeId: string, query: PaginationDto) {
    const { page, limit } = query;
    const offset = (page - 1) * limit;
    const where = eq(staffProfile.storeId, storeId);

    const [data, [{ count }]] = await Promise.all([
      this.db.select(safeSelect).from(staffProfile).where(where)
        .orderBy(staffProfile.firstName).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(staffProfile).where(where),
    ]);
    return paginate(data, Number(count), page, limit);
  }

  async getRoster(storeId?: string) {
    let targetStoreId = storeId;
    if (!targetStoreId) {
      const [firstStore] = await this.db.select({ id: staffProfile.storeId }).from(staffProfile).limit(1);
      targetStoreId = firstStore?.id;
    }
    
    if (!targetStoreId) return [];

    return this.db.select(safeSelect).from(staffProfile).where(eq(staffProfile.storeId, targetStoreId)).orderBy(staffProfile.firstName);
  }

  async getById(id: string) {
    const [staff] = await this.db
      .select(safeSelect)
      .from(staffProfile)
      .where(eq(staffProfile.id, id))
      .limit(1);
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async create(dto: CreateStaffDto) {
    const generatedPin = dto.pin || Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit PIN
    const generatedPassword = dto.password || Math.random().toString(36).slice(-12);

    const pinHash = await bcrypt.hash(generatedPin, 12);
    const passwordHash = await bcrypt.hash(generatedPassword, 12);

    const [staff] = await this.db
      .insert(staffProfile)
      .values({ 
        ...dto, 
        pinHash, 
        passwordHash,
        requiresPinChange: !dto.pin,
        requiresPasswordChange: !dto.password,
      })
      .returning({
        id: staffProfile.id,
        storeId: staffProfile.storeId,
        firstName: staffProfile.firstName,
        lastName: staffProfile.lastName,
        email: staffProfile.email,
        role: staffProfile.role,
        isActive: staffProfile.isActive,
        createdAt: staffProfile.createdAt,
      });

    if (staff.email) {
      this.emailService.sendWelcomeEmail({
        to: staff.email,
        firstName: staff.firstName,
        temporaryPin: generatedPin,
        temporaryPassword: !dto.password ? generatedPassword : undefined,
      }).catch(err => {
        // Log but don't fail the request if email fails
        console.error('Failed to send welcome email', err);
      });
    }

    return staff;
  }

  async update(id: string, dto: UpdateStaffDto) {
    const [staff] = await this.db
      .update(staffProfile)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(staffProfile.id, id))
      .returning(safeSelect);
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async deactivate(id: string) {
    const [staff] = await this.db
      .update(staffProfile)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(staffProfile.id, id))
      .returning(safeSelect);
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async delete(id: string, reassignedToId?: string) {
    const [staff] = await this.db
      .select(safeSelect)
      .from(staffProfile)
      .where(eq(staffProfile.id, id))
      .limit(1);
    if (!staff) throw new NotFoundException('Staff member not found');

    // Resolve all foreign keys that reference staff_profile.id before deleting,
    // so the database doesn't throw a 500 FK violation.
    const fkResult = await this.db.execute(sql`
      SELECT tc.table_name, kcu.column_name, c.is_nullable
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      JOIN information_schema.columns c
        ON c.table_schema = tc.table_schema
        AND c.table_name = tc.table_name
        AND c.column_name = kcu.column_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'staff_profile'
        AND ccu.column_name = 'id'
        AND tc.table_schema = current_schema()
    `);
    const fkRows = ((fkResult as any).rows ?? []) as any[];

    const ownedChildTables = new Set([
      'refresh_token',
      'otp_token',
      'payslip',
      'shift_reconciliation',
    ]);
    const blocked: string[] = [];

    for (const row of fkRows) {
      const table = String(row.table_name);
      const column = String(row.column_name);
      const isNullable = String(row.is_nullable).toUpperCase() === 'YES';
      if (table === 'staff_profile') continue;

      if (ownedChildTables.has(table)) {
        await this.db.execute(sql`DELETE FROM ${sql.raw(`"${table}"`)} WHERE ${sql.raw(`"${column}"`)} = ${id}`);
      } else if (table === 'sale' && column === 'cashier_id' && reassignedToId) {
        await this.db.execute(sql`UPDATE "sale" SET "cashier_id" = ${reassignedToId} WHERE "cashier_id" = ${id}`);
      } else if (isNullable) {
        await this.db.execute(sql`UPDATE ${sql.raw(`"${table}"`)} SET ${sql.raw(`"${column}"`)} = NULL WHERE ${sql.raw(`"${column}"`)} = ${id}`);
      } else {
        const countResult = await this.db.execute(sql`SELECT count(*)::int as count FROM ${sql.raw(`"${table}"`)} WHERE ${sql.raw(`"${column}"`)} = ${id}`);
        const countRes = (countResult as any).rows?.[0];
        if (countRes && (countRes as any).count > 0) blocked.push(`${table}.${column}`);
      }
    }

    if (blocked.length > 0) {
      throw new ConflictException(
        `Cannot delete staff member because they are referenced by: ${blocked.join(', ')}`,
      );
    }

    await this.db
      .delete(staffProfile)
      .where(eq(staffProfile.id, id));

    return { success: true, message: 'Staff member deleted' };
  }

  async generateTemporaryPin(id: string) {
    const [staff] = await this.db.select().from(staffProfile).where(eq(staffProfile.id, id)).limit(1);
    if (!staff) throw new NotFoundException('Staff member not found');

    const rawPin = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
    const pinHash = await bcrypt.hash(rawPin, 12);

    await this.db
      .update(staffProfile)
      .set({ pinHash, updatedAt: new Date() })
      .where(eq(staffProfile.id, id));

    return { success: true, temporaryPin: rawPin };
  }

  async getActivities(id: string) {
    const { auditLogs } = await import('../../database/schema');

    // Fetch audit logs for this staff member
    const logs = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.staffId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    // Also fetch shift events as activity items
    const shifts = await this.db
      .select()
      .from(shiftReconciliation)
      .where(eq(shiftReconciliation.staffId, id))
      .orderBy(desc(shiftReconciliation.clockIn))
      .limit(20);

    const shiftEvents = shifts.flatMap((s) => {
      const events: any[] = [{
        id: `shift-in-${s.id}`,
        action: 'clock_in',
        entityType: 'shift',
        entityId: s.id,
        createdAt: s.clockIn,
        newData: { openingFloat: s.openingFloat },
      }];
      if (s.clockOut) {
        events.push({
          id: `shift-out-${s.id}`,
          action: 'clock_out',
          entityType: 'shift',
          entityId: s.id,
          createdAt: s.clockOut,
        });
      }
      return events;
    });

    // Merge and sort all activity events by date descending
    const combined = [...logs, ...shiftEvents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 60);

    return combined;
  }

  async getAllAuditLogs(storeId: string, query: PaginationDto) {
    const { auditLogs } = await import('../../database/schema');
    const { page, limit } = query;
    const offset = (page - 1) * limit;
    const where = eq(auditLogs.storeId, storeId);

    const [data, [{ count }]] = await Promise.all([
      this.db.query.auditLogs.findMany({
        where,
        with: { staff: true },
        orderBy: [desc(auditLogs.createdAt)],
        limit,
        offset,
      }),
      this.db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(where),
    ]);

    // sanitize staff inside logs to not leak passwordHash
    const sanitizedData = data.map((log: any) => {
      if (log.staff) {
        delete log.staff.pinHash;
        delete log.staff.passwordHash;
      }
      return log;
    });

    return paginate(sanitizedData, Number(count), page, limit);
  }

  async resendCredentials(id: string) {
    const [staff] = await this.db.select().from(staffProfile).where(eq(staffProfile.id, id)).limit(1);
    if (!staff) throw new NotFoundException('Staff member not found');
    if (!staff.email) throw new NotFoundException('Staff member has no email address on record');

    const rawPin = Math.floor(1000 + Math.random() * 9000).toString();
    const pinHash = await bcrypt.hash(rawPin, 12);

    await this.db
      .update(staffProfile)
      .set({ pinHash, requiresPinChange: true, updatedAt: new Date() })
      .where(eq(staffProfile.id, id));

    this.emailService.sendWelcomeEmail({
      to: staff.email,
      firstName: staff.firstName,
      temporaryPin: rawPin,
    }).catch((err) => {
      console.error('Failed to resend welcome email', err);
    });

    return { success: true, message: `Welcome email with new temporary PIN sent to ${staff.email}` };
  }

  async clockIn(staffId: string, dto: ClockInDto) {
    const [shift] = await this.db
      .insert(shiftReconciliation)
      .values({
        staffId,
        storeId: dto.storeId,
        status: 'open',
        clockIn: new Date(),
        openingFloat: dto.openingFloat,
      })
      .returning();

    const { auditLogs } = await import('../../database/schema');
    await this.db.insert(auditLogs).values({
      staffId,
      storeId: dto.storeId,
      action: 'CLOCK_IN',
      entityType: 'shift',
      entityId: shift.id,
      newData: { openingFloat: dto.openingFloat },
    });

    return shift;
  }

  async clockOut(staffId: string, dto: ClockOutDto) {
    const [shift] = await this.db
      .update(shiftReconciliation)
      .set({ status: 'closed', clockOut: new Date(), updatedAt: new Date() })
      .where(and(eq(shiftReconciliation.id, dto.shiftId), eq(shiftReconciliation.staffId, staffId)))
      .returning();
    if (!shift) throw new NotFoundException('Active shift not found');

    const { auditLogs } = await import('../../database/schema');
    await this.db.insert(auditLogs).values({
      staffId,
      storeId: shift.storeId,
      action: 'CLOCK_OUT',
      entityType: 'shift',
      entityId: shift.id,
      newData: { shiftId: shift.id },
    });

    return shift;
  }

  async getActiveShift(staffId: string, storeId: string) {
    const [shift] = await this.db
      .select()
      .from(shiftReconciliation)
      .where(
        and(
          eq(shiftReconciliation.staffId, staffId),
          eq(shiftReconciliation.storeId, storeId),
          eq(shiftReconciliation.status, 'open'),
        ),
      )
      .limit(1);
    return shift ?? null;
  }

  async getShiftHistory(staffId: string, limit = 20) {
    return this.db
      .select()
      .from(shiftReconciliation)
      .where(eq(shiftReconciliation.staffId, staffId))
      .orderBy(desc(shiftReconciliation.clockIn))
      .limit(limit);
  }
}
