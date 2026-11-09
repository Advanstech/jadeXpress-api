import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { staffProfile, refreshTokens as refreshTokenTable } from '../../database/schema';

vi.mock('uuid', () => ({ v4: () => 'replacement-refresh-token' }));

const staff = { id: 'staff-id', isActive: true, role: 'manager', storeId: 'store-id' };

function createService({ rotated = true, staffRows = [staff], failSelect = false } = {}) {
  const stored = {
    id: 'refresh-id', staffId: 'staff-id',
    tokenHash: createHash('sha256').update('original-refresh-token').digest('hex'),
    expiresAt: new Date('2099-01-01'), revokedAt: null as Date | null,
  };
  const selectWhere = vi.fn(() => ({
    limit: vi.fn(async () => {
      if (failSelect) throw new Error('Database unavailable');
      return staffRows;
    }),
  }));
  const tokenWhere = vi.fn(() => ({
    limit: vi.fn(async () => [stored]),
  }));
  const rotationWhere = vi.fn(() => ({
    returning: vi.fn(async () => rotated ? [{ id: stored.id }] : []),
  }));
  const staffWhere = selectWhere;
  const db = {
    select: vi.fn(() => ({ from: vi.fn((table) => ({ where: table === refreshTokenTable ? tokenWhere : staffWhere })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: rotationWhere })) })),
    transaction: vi.fn(async (callback) => callback({
      update: db.update,
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
  };
  const jwtService = { sign: vi.fn(() => 'access-token') };
  const config = { getOrThrow: vi.fn(() => '7d') };
  return { service: new AuthService(db as any, jwtService as any, config as any, {} as any), stored, tokenWhere, rotationWhere };
}

describe('AuthService.refresh', () => {


  it('rotates the stored token before issuing an access token', async () => {
    const { service } = createService();
    const result = await service.refresh('original-refresh-token');
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('replacement-refresh-token');
  });

  it('does not mint an access token if staff lookup fails after rotation', async () => {
    const { service } = createService({ failSelect: true });
    await expect(service.refresh('original-refresh-token')).rejects.toThrow('Database unavailable');
  });

  it('rejects missing staff without minting a token', async () => {
    const { service } = createService({ staffRows: [] });
    await expect(service.refresh('original-refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects concurrent reuse of a rotated token', async () => {
    const { service, stored } = createService();
    await service.refresh('original-refresh-token');
    stored.revokedAt = new Date();
    await expect(service.refresh('original-refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
