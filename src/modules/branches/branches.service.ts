import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, sql, desc, or, ilike } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  stores,
  organisation,
  stockItems,
  products,
  staffProfile,
  stockTransfers,
  sales,
} from '../../database/schema';
import type { CreateBranchDto, UpdateBranchDto } from './dto/branches.dto';

@Injectable()
export class BranchesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listBranches(query?: { status?: string; search?: string }) {
    let whereConditions: any[] = [];

    if (query?.status && query.status !== 'all') {
      whereConditions.push(eq(stores.status, query.status as any));
    }

    if (query?.search) {
      whereConditions.push(
        or(
          ilike(stores.name, `%${query.search}%`),
          ilike(stores.code, `%${query.search}%`),
          ilike(stores.city, `%${query.search}%`),
        ),
      );
    }

    const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    const branchList = await this.db.select().from(stores).where(where).orderBy(stores.createdAt);

    // Enrich each branch with live aggregated metrics
    const enrichedBranches = await Promise.all(
      branchList.map(async (branch) => {
        // 1. Stock item count & units & stock value
        const [stockStats] = await this.db
          .select({
            totalProducts: sql<number>`count(distinct ${stockItems.productId})::int`,
            totalStockUnits: sql<number>`coalesce(sum(${stockItems.quantityOnHand}), 0)::int`,
            totalStockValuePesewas: sql<number>`coalesce(sum(${stockItems.quantityOnHand} * ${products.costPricePesewas}), 0)::bigint`,
          })
          .from(stockItems)
          .innerJoin(products, eq(stockItems.productId, products.id))
          .where(eq(stockItems.storeId, branch.id));

        // 2. Active staff count
        const [staffStats] = await this.db
          .select({
            staffCount: sql<number>`count(*)::int`,
          })
          .from(staffProfile)
          .where(and(eq(staffProfile.storeId, branch.id), eq(staffProfile.isActive, true)));

        // 3. Active inbound transfers
        const [inbound] = await this.db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(stockTransfers)
          .where(
            and(
              eq(stockTransfers.toStoreId, branch.id),
              sql`${stockTransfers.status} IN ('pending_approval', 'in_transit')`,
            ),
          );

        // 4. Active outbound transfers
        const [outbound] = await this.db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(stockTransfers)
          .where(
            and(
              eq(stockTransfers.fromStoreId, branch.id),
              sql`${stockTransfers.status} IN ('pending_approval', 'in_transit')`,
            ),
          );

        // 5. Today's sales
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [todaySales] = await this.db
          .select({
            salesCount: sql<number>`count(*)::int`,
            revenuePesewas: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)::bigint`,
          })
          .from(sales)
          .where(
            and(
              eq(sales.storeId, branch.id),
              eq(sales.status, 'completed'),
              sql`${sales.createdAt} >= ${todayStart.toISOString()}`,
            ),
          );

        return {
          ...branch,
          totalProducts: Number(stockStats?.totalProducts ?? 0),
          totalStockUnits: Number(stockStats?.totalStockUnits ?? 0),
          totalStockValuePesewas: Number(stockStats?.totalStockValuePesewas ?? 0),
          staffCount: Number(staffStats?.staffCount ?? 0),
          activeInboundTransfers: Number(inbound?.count ?? 0),
          activeOutboundTransfers: Number(outbound?.count ?? 0),
          todaySalesCount: Number(todaySales?.salesCount ?? 0),
          todaySalesRevenuePesewas: Number(todaySales?.revenuePesewas ?? 0),
        };
      }),
    );

    return enrichedBranches;
  }

  async getBranchById(id: string) {
    const [branch] = await this.db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!branch) throw new NotFoundException('Branch not found');

    // Aggregate stats
    const [stockStats] = await this.db
      .select({
        totalProducts: sql<number>`count(distinct ${stockItems.productId})::int`,
        totalStockUnits: sql<number>`coalesce(sum(${stockItems.quantityOnHand}), 0)::int`,
        totalStockValuePesewas: sql<number>`coalesce(sum(${stockItems.quantityOnHand} * ${products.costPricePesewas}), 0)::bigint`,
        lowStockItems: sql<number>`count(case when ${stockItems.quantityOnHand} <= ${products.reorderPoint} then 1 end)::int`,
        outOfStockItems: sql<number>`count(case when ${stockItems.quantityOnHand} = 0 then 1 end)::int`,
      })
      .from(stockItems)
      .innerJoin(products, eq(stockItems.productId, products.id))
      .where(eq(stockItems.storeId, branch.id));

    const staffMembers = await this.db
      .select({
        id: staffProfile.id,
        firstName: staffProfile.firstName,
        lastName: staffProfile.lastName,
        role: staffProfile.role,
        email: staffProfile.email,
        phone: staffProfile.phone,
        isActive: staffProfile.isActive,
      })
      .from(staffProfile)
      .where(eq(staffProfile.storeId, branch.id));

    return {
      ...branch,
      totalProducts: Number(stockStats?.totalProducts ?? 0),
      totalStockUnits: Number(stockStats?.totalStockUnits ?? 0),
      totalStockValuePesewas: Number(stockStats?.totalStockValuePesewas ?? 0),
      lowStockItems: Number(stockStats?.lowStockItems ?? 0),
      outOfStockItems: Number(stockStats?.outOfStockItems ?? 0),
      staffMembers,
    };
  }

  async createBranch(dto: CreateBranchDto) {
    const upperCode = dto.code.trim().toUpperCase();

    // Check code uniqueness
    const [existing] = await this.db.select().from(stores).where(eq(stores.code, upperCode)).limit(1);
    if (existing) {
      throw new ConflictException(`Branch code '${upperCode}' is already taken.`);
    }

    // Get default organisation
    const [org] = await this.db.select().from(organisation).limit(1);
    if (!org) {
      throw new NotFoundException('Default organisation not configured');
    }

    const [newBranch] = await this.db
      .insert(stores)
      .values({
        organisationId: org.id,
        code: upperCode,
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        city: dto.city?.trim() || 'Accra',
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        status: dto.status || 'active',
        rxEnabled: dto.rxEnabled ?? false,
        terminalConfig: dto.terminalConfig ?? {},
      })
      .returning();

    return newBranch;
  }

  async updateBranch(id: string, dto: UpdateBranchDto) {
    const [existing] = await this.db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Branch not found');

    const patch: any = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.code !== undefined) {
      const upper = dto.code.trim().toUpperCase();
      if (upper !== existing.code) {
        const [codeConflict] = await this.db.select().from(stores).where(eq(stores.code, upper)).limit(1);
        if (codeConflict) throw new ConflictException(`Branch code '${upper}' is already in use`);
        patch.code = upper;
      }
    }
    if (dto.address !== undefined) patch.address = dto.address?.trim() || null;
    if (dto.city !== undefined) patch.city = dto.city?.trim() || 'Accra';
    if (dto.phone !== undefined) patch.phone = dto.phone?.trim() || null;
    if (dto.email !== undefined) patch.email = dto.email?.trim() || null;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.rxEnabled !== undefined) patch.rxEnabled = dto.rxEnabled;
    if (dto.terminalConfig !== undefined) patch.terminalConfig = dto.terminalConfig;

    const [updated] = await this.db
      .update(stores)
      .set(patch)
      .where(eq(stores.id, id))
      .returning();

    return updated;
  }

  async getBranchInventory(id: string, search?: string, limit = 50) {
    let whereConditions: any[] = [eq(stockItems.storeId, id)];

    if (search) {
      whereConditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`),
          ilike(products.barcode, `%${search}%`),
        ),
      );
    }

    const items = await this.db
      .select({
        id: stockItems.id,
        productId: products.id,
        productName: products.name,
        sku: products.sku,
        barcode: products.barcode,
        costPricePesewas: products.costPricePesewas,
        sellingPricePesewas: products.sellingPricePesewas,
        quantityOnHand: stockItems.quantityOnHand,
        reorderPoint: products.reorderPoint,
        imageUrl: products.imageUrl,
        lastMovementAt: stockItems.lastMovementAt,
      })
      .from(stockItems)
      .innerJoin(products, eq(stockItems.productId, products.id))
      .where(and(...whereConditions))
      .orderBy(desc(stockItems.quantityOnHand))
      .limit(limit);

    return items;
  }
}
