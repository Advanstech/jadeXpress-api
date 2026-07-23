import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
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
    // Return mock data for now or query audit_logs if fully populated.
    // Assuming audit_logs exist:
    const { auditLogs } = await import('../../database/schema');
    const { desc } = await import('drizzle-orm');
    const logs = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.staffId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);
      
    return logs;
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
    return shift;
  }

  async clockOut(staffId: string, dto: ClockOutDto) {
    const [shift] = await this.db
      .update(shiftReconciliation)
      .set({ status: 'closed', clockOut: new Date(), updatedAt: new Date() })
      .where(and(eq(shiftReconciliation.id, dto.shiftId), eq(shiftReconciliation.staffId, staffId)))
      .returning();
    if (!shift) throw new NotFoundException('Active shift not found');
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
