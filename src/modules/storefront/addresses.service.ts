import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { customerAddresses } from '../../database/schema';
import type { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(customerId: string) {
    return this.db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, customerId))
      .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));
  }

  async create(customerId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.db
        .update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.customerId, customerId));
    }
    const [address] = await this.db
      .insert(customerAddresses)
      .values({ ...dto, customerId })
      .returning();
    return address;
  }

  async update(customerId: string, id: string, dto: UpdateAddressDto) {
    if (dto.isDefault) {
      await this.db
        .update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.customerId, customerId));
    }
    const [address] = await this.db
      .update(customerAddresses)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)))
      .returning();
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async remove(customerId: string, id: string) {
    const [deleted] = await this.db
      .delete(customerAddresses)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)))
      .returning();
    if (!deleted) throw new NotFoundException('Address not found');
    return { success: true };
  }
}
