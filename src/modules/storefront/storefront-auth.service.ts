import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { customers, customerRefreshTokens, staffProfile } from '../../database/schema';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import type {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './dto/storefront-auth.dto';

@Injectable()
export class StorefrontAuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, dto.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [customer] = await this.db
      .insert(customers)
      .values({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
      })
      .returning();

    return this.issueTokens(customer);
  }

  async login(dto: LoginDto) {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.email, dto.email.toLowerCase()))
      .limit(1);

    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!customer.isActive) throw new UnauthorizedException('Account is deactivated');

    return this.issueTokens(customer);
  }

  async refresh(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [stored] = await this.db
      .select()
      .from(customerRefreshTokens)
      .where(eq(customerRefreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, stored.customerId))
      .limit(1);

    if (!customer || !customer.isActive) {
      throw new UnauthorizedException('Account deactivated');
    }

    await this.db
      .update(customerRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(customerRefreshTokens.id, stored.id));

    return this.issueTokens(customer);
  }

  async logout(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.db
      .update(customerRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(customerRefreshTokens.tokenHash, tokenHash));
    return { success: true };
  }

  async getProfile(customerId: string) {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    if (!customer) throw new NotFoundException('Customer not found');
    const { role } = await this.getEffectiveRoleAndStore(customer.email);
    return this.toPublicProfile(customer, role);
  }

  async updateProfile(customerId: string, dto: UpdateProfileDto) {
    const [customer] = await this.db
      .update(customers)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(customers.id, customerId))
      .returning();
    if (!customer) throw new NotFoundException('Customer not found');

    if (customer.email) {
      const staffUpdates: any = { updatedAt: new Date() };
      if (dto.firstName) staffUpdates.firstName = dto.firstName;
      if (dto.lastName) staffUpdates.lastName = dto.lastName;
      if (dto.phone !== undefined) staffUpdates.phone = dto.phone;
      if (dto.avatarUrl !== undefined) staffUpdates.avatarUrl = dto.avatarUrl;

      await this.db
        .update(staffProfile)
        .set(staffUpdates)
        .where(eq(staffProfile.email, customer.email.toLowerCase()));
    }

    const { role } = await this.getEffectiveRoleAndStore(customer.email);
    return this.toPublicProfile(customer, role);
  }

  async changePassword(customerId: string, dto: ChangePasswordDto) {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!customer || !customer.passwordHash) throw new NotFoundException('Customer not found');

    const valid = await bcrypt.compare(dto.currentPassword, customer.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.db
      .update(customers)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(customers.id, customerId));

    return { success: true };
  }

  private async getEffectiveRoleAndStore(email?: string | null) {
    if (!email) return { role: 'customer', storeId: '' };
    const [staff] = await this.db
      .select({ role: staffProfile.role, storeId: staffProfile.storeId })
      .from(staffProfile)
      .where(and(eq(staffProfile.email, email.toLowerCase()), eq(staffProfile.isActive, true)))
      .limit(1);
    return {
      role: (staff?.role ?? 'customer') as string,
      storeId: staff?.storeId ?? '',
    };
  }

  private toPublicProfile(customer: typeof customers.$inferSelect, role = 'customer') {
    const { passwordHash: _passwordHash, ...rest } = customer;
    return {
      ...rest,
      role,
    };
  }

  private async issueTokens(customer: typeof customers.$inferSelect) {
    const { role, storeId } = await this.getEffectiveRoleAndStore(customer.email);

    const payload: JwtPayload = {
      sub: customer.id,
      role,
      storeId,
      type: role === 'customer' ? 'customer' : 'staff',
    };

    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');

    const refreshExpiresIn = this.config.getOrThrow<string>('jwt.refreshExpiresIn');
    const days = parseInt(refreshExpiresIn.replace(/\D/g, ''), 10) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.db.insert(customerRefreshTokens).values({
      customerId: customer.id,
      tokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.config.getOrThrow<string>('jwt.expiresIn'),
      customer: this.toPublicProfile(customer, role),
    };
  }
}
