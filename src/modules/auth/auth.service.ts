import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { staffProfile, refreshTokens, otpTokens } from '../../database/schema';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import type { LoginDto, PinLoginDto, PinVerifyDto, ChangePinDto } from './dto/auth.dto';

import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ── Email + Password login (manager/owner web portal) ─────────────────────
  async login(dto: LoginDto) {
    const [staff] = await this.db
      .select()
      .from(staffProfile)
      .where(eq(staffProfile.email, dto.email.toLowerCase()))
      .limit(1);

    if (!staff || !staff.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, staff.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!staff.isActive) throw new UnauthorizedException('Account is deactivated');

    return this.issueTokens(staff);
  }

  // ── PIN login (POS cashier login — fastest path) ──────────────────────────
  async pinLogin(dto: PinLoginDto) {
    const [staff] = await this.db
      .select()
      .from(staffProfile)
      .where(
        and(
          eq(staffProfile.id, dto.staffId),
          eq(staffProfile.storeId, dto.storeId),
        ),
      )
      .limit(1);

    if (!staff) throw new NotFoundException('Staff not found');
    if (!staff.isActive) throw new UnauthorizedException('Account is deactivated');

    const valid = await bcrypt.compare(dto.pin, staff.pinHash);
    if (!valid) throw new UnauthorizedException('Invalid PIN');

    return this.issueTokens(staff);
  }

  // ── PIN verify — manager override (does NOT issue tokens, just validates) ─
  async verifyPin(dto: PinVerifyDto): Promise<{ valid: boolean; role: string }> {
    const [staff] = await this.db
      .select()
      .from(staffProfile)
      .where(eq(staffProfile.id, dto.staffId))
      .limit(1);

    if (!staff || !staff.isActive) return { valid: false, role: '' };

    const valid = await bcrypt.compare(dto.pin, staff.pinHash);
    return { valid, role: staff.role };
  }

  // ── Refresh token ─────────────────────────────────────────────────────────
  async refresh(token: string) {
    const [stored] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, token))
      .limit(1);

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const [staff] = await this.db
      .select()
      .from(staffProfile)
      .where(eq(staffProfile.id, stored.staffId))
      .limit(1);

    if (!staff || !staff.isActive) throw new UnauthorizedException('Account deactivated');

    // Rotate — revoke old, issue new
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, stored.id));

    return this.issueTokens(staff);
  }

  // ── Revoke refresh token (logout) ─────────────────────────────────────────
  async logout(refreshTokenString: string) {
    await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, refreshTokenString));
    return { success: true };
  }

  // ── PIN Change ──────────────────────────────────────────────────────────────
  async changePin(staffId: string, storeId: string, dto: ChangePinDto) {
    const [staff] = await this.db
      .select()
      .from(staffProfile)
      .where(
        and(
          eq(staffProfile.id, staffId),
          eq(staffProfile.storeId, storeId),
        ),
      )
      .limit(1);

    if (!staff) throw new NotFoundException('Staff not found');

    const valid = await bcrypt.compare(dto.currentPin, staff.pinHash);
    if (!valid) throw new UnauthorizedException('Incorrect current PIN');

    const newPinHash = await bcrypt.hash(dto.newPin, 12);
    
    await this.db
      .update(staffProfile)
      .set({ pinHash: newPinHash, requiresPinChange: false })
      .where(eq(staffProfile.id, staffId));

    return { success: true };
  }

  // ── Password Change ─────────────────────────────────────────────────────────
  async changePassword(staffId: string, storeId: string, dto: any) { // using any for brevity here, should be ChangePasswordDto
    const [staff] = await this.db
      .select()
      .from(staffProfile)
      .where(
        and(
          eq(staffProfile.id, staffId),
          eq(staffProfile.storeId, storeId),
        ),
      )
      .limit(1);

    if (!staff || !staff.passwordHash) throw new NotFoundException('Staff not found');

    const valid = await bcrypt.compare(dto.currentPassword, staff.passwordHash);
    if (!valid) throw new UnauthorizedException('Incorrect current Password');

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    
    await this.db
      .update(staffProfile)
      .set({ passwordHash: newPasswordHash, requiresPasswordChange: false })
      .where(eq(staffProfile.id, staffId));

    return { success: true };
  }

  // ── Credential Recovery (Forgot / Reset) ──────────────────────────────────
  async forgotCredential(email: string, type: 'pin' | 'password') {
    const [staff] = await this.db
      .select()
      .from(staffProfile)
      .where(eq(staffProfile.email, email.toLowerCase()))
      .limit(1);

    if (!staff) {
      // Return success anyway to prevent email enumeration
      return { success: true };
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(otpCode, 12);

    // Expire in 15 mins
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.db.insert(otpTokens).values({
      staffId: staff.id,
      codeHash,
      channel: 'email',
      expiresAt,
    });

    await this.emailService.sendOtpEmail({
      to: staff.email!,
      firstName: staff.firstName,
      otpCode,
      type,
    });

    return { success: true };
  }

  async resetCredential(email: string, otpCode: string, newSecret: string, type: 'pin' | 'password') {
    const [staff] = await this.db
      .select()
      .from(staffProfile)
      .where(eq(staffProfile.email, email.toLowerCase()))
      .limit(1);

    if (!staff) throw new UnauthorizedException('Invalid or expired OTP');

    // Find valid OTP
    const tokens = await this.db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.staffId, staff.id),
          eq(otpTokens.channel, 'email'),
        )
      );

    const now = new Date();
    let validToken = null;

    for (const token of tokens) {
      if (token.usedAt || token.expiresAt < now) continue;
      const isValid = await bcrypt.compare(otpCode, token.codeHash);
      if (isValid) {
        validToken = token;
        break;
      }
    }

    if (!validToken) throw new UnauthorizedException('Invalid or expired OTP');

    // Mark as used
    await this.db.update(otpTokens).set({ usedAt: now }).where(eq(otpTokens.id, validToken.id));

    // Update credential
    const newHash = await bcrypt.hash(newSecret, 12);
    if (type === 'pin') {
      if (newSecret.length < 4 || newSecret.length > 6 || !/^\d+$/.test(newSecret)) {
        throw new UnauthorizedException('Invalid PIN format');
      }
      await this.db.update(staffProfile).set({ pinHash: newHash, requiresPinChange: false }).where(eq(staffProfile.id, staff.id));
    } else {
      if (newSecret.length < 8) {
        throw new UnauthorizedException('Password must be at least 8 characters');
      }
      await this.db.update(staffProfile).set({ passwordHash: newHash, requiresPasswordChange: false }).where(eq(staffProfile.id, staff.id));
    }

    return { success: true };
  }

  // ── Internal: sign access + refresh tokens ────────────────────────────────
  private async issueTokens(staff: typeof staffProfile.$inferSelect) {
    const payload: JwtPayload = {
      sub: staff.id,
      role: staff.role,
      storeId: staff.storeId,
    };

    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = uuidv4();

    // Parse refreshExpiresIn (e.g. "7d", "30d") into a Date
    const refreshExpiresIn = this.config.getOrThrow<string>('jwt.refreshExpiresIn');
    const days = parseInt(refreshExpiresIn.replace(/\D/g, ''), 10) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.db.insert(refreshTokens).values({
      staffId: staff.id,
      tokenHash: rawRefreshToken, // raw UUID — rotated on every use
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.config.getOrThrow<string>('jwt.expiresIn'), // e.g. "15m"
      staff: {
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        storeId: staff.storeId,
        avatarUrl: staff.avatarUrl,
        requiresPinChange: staff.requiresPinChange,
        requiresPasswordChange: staff.requiresPasswordChange,
      },
    };
  }
}
