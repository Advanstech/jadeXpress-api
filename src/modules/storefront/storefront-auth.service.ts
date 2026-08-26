import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { customers, customerRefreshTokens } from '../../database/schema';
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

  async logout(refreshTokenString: string) {
    const tokenHash = createHash('sha256').update(refreshTokenString).digest('hex');
    await this.db
      .delete(customerRefreshTokens)
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
    return this.toPublicProfile(customer);
  }

  async updateProfile(customerId: string, dto: UpdateProfileDto) {
    const [customer] = await this.db
      .update(customers)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(customers.id, customerId))
      .returning();
    if (!customer) throw new NotFoundException('Customer not found');
    return this.toPublicProfile(customer);
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

  private toPublicProfile(customer: typeof customers.$inferSelect) {
    const { passwordHash: _passwordHash, ...rest } = customer;
    return rest;
  }

  private async issueTokens(customer: typeof customers.$inferSelect) {
    const payload: JwtPayload = {
      sub: customer.id,
      role: 'customer',
      storeId: '',
      type: 'customer',
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
      customer: this.toPublicProfile(customer),
    };
  }
}
