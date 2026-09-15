import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { organisation } from '../../database/schema';
import type { UpdateOrganisationDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getOrganisation() {
    const [org] = await this.db.select().from(organisation).limit(1);
    return { org: org ?? null };
  }

  async updateOrganisation(dto: UpdateOrganisationDto) {
    const [org] = await this.db.select().from(organisation).limit(1);
    if (!org) throw new NotFoundException('Organisation not configured');

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.tradingName !== undefined) patch.tradingName = dto.tradingName;
    if (dto.currencyCode !== undefined) patch.currencyCode = dto.currencyCode;
    if (dto.vatRatePct !== undefined) patch.vatRateBps = Math.round(dto.vatRatePct * 100);
    if (dto.nhilRatePct !== undefined) patch.nhilRateBps = Math.round(dto.nhilRatePct * 100);
    if (dto.getfundRatePct !== undefined) patch.getfundRateBps = Math.round(dto.getfundRatePct * 100);

    const nextSettings = { ...(org.settings ?? {}) } as Record<string, unknown>;
    if (dto.currencySymbol !== undefined) nextSettings.currencySymbol = dto.currencySymbol;
    if (dto.maxDiscountPct !== undefined) nextSettings.maxDiscountPct = dto.maxDiscountPct;
    if (dto.minStockThreshold !== undefined) nextSettings.minStockThreshold = dto.minStockThreshold;
    if (dto.defaultFloatPesewas !== undefined) nextSettings.defaultFloatPesewas = dto.defaultFloatPesewas;
    if (Object.keys(nextSettings).length > 0) patch.settings = nextSettings;

    const [updated] = await this.db
      .update(organisation)
      .set(patch)
      .returning();

    return { org: updated };
  }
}
