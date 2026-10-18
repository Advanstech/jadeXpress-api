import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq, and, sql, desc, or, ilike, gte, lte } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiService } from '../ai/ai.service';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  paymentAuthorizations,
  stores,
  staffProfile,
  ledgerEntries,
  supplierInvoices,
  invoicePayments,
  expenses,
} from '../../database/schema';
import type {
  CreatePaymentAuthorizationDto,
  ApprovePaymentAuthorizationDto,
  RejectPaymentAuthorizationDto,
  DisbursePaymentAuthorizationDto,
} from './dto/payment-authorizations.dto';

const CROSS_BRANCH_ROLES = new Set(['owner', 'root', 'super_admin']);

@Injectable()
export class PaymentAuthorizationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly aiService: AiService,
  ) {}

  private isElevated(user: JwtPayload): boolean {
    return CROSS_BRANCH_ROLES.has((user.role || '').toLowerCase());
  }

  // Non-elevated staff are locked to their own (effective) branch; elevated
  // roles may view a specific branch or all branches when no filter is given.
  private scopedStoreId(requested: string | undefined, user: JwtPayload): string | undefined {
    if (!this.isElevated(user)) return user.storeId;
    return requested && requested !== 'all' ? requested : undefined;
  }

  private assertStoreScope(storeId: string, user: JwtPayload) {
    if (!this.isElevated(user) && storeId !== user.storeId) {
      throw new ForbiddenException('Payment authorization belongs to another branch');
    }
  }

  async list(query: {
    storeId?: string;
    status?: string;
    category?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }, user: JwtPayload) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 50;
    const offset = (page - 1) * limit;

    const whereConditions: any[] = [];

    const scopedStore = this.scopedStoreId(query.storeId, user);
    if (scopedStore) {
      whereConditions.push(eq(paymentAuthorizations.storeId, scopedStore));
    }

    if (query.status && query.status !== 'all') {
      whereConditions.push(eq(paymentAuthorizations.status, query.status));
    }

    if (query.category && query.category !== 'all') {
      whereConditions.push(eq(paymentAuthorizations.category, query.category));
    }

    if (query.search) {
      whereConditions.push(
        or(
          ilike(paymentAuthorizations.authorizationNumber, `%${query.search}%`),
          ilike(paymentAuthorizations.title, `%${query.search}%`),
          ilike(paymentAuthorizations.payeeName, `%${query.search}%`),
          ilike(paymentAuthorizations.transactionReference, `%${query.search}%`),
        ),
      );
    }

    if (query.from) {
      whereConditions.push(gte(paymentAuthorizations.createdAt, new Date(query.from)));
    }

    if (query.to) {
      whereConditions.push(lte(paymentAuthorizations.createdAt, new Date(query.to)));
    }

    const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [data, [{ totalCount }]] = await Promise.all([
      this.db.query.paymentAuthorizations.findMany({
        where,
        with: {
          store: { columns: { id: true, name: true, code: true } },
          requestedBy: {
            columns: { id: true, firstName: true, lastName: true, role: true },
          },
          authorizedBy: {
            columns: { id: true, firstName: true, lastName: true, role: true },
          },
          disbursedBy: {
            columns: { id: true, firstName: true, lastName: true, role: true },
          },
        },
        orderBy: [desc(paymentAuthorizations.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ totalCount: sql<number>`count(*)::int` })
        .from(paymentAuthorizations)
        .where(where),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total: Number(totalCount ?? 0),
        totalPages: Math.ceil(Number(totalCount ?? 0) / limit),
      },
    };
  }

  async getStats(storeId: string | undefined, user: JwtPayload) {
    const conditions: any[] = [];
    const scopedStore = this.scopedStoreId(storeId, user);
    if (scopedStore) {
      conditions.push(eq(paymentAuthorizations.storeId, scopedStore));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [stats] = await this.db
      .select({
        totalCount: sql<number>`count(*)::int`,
        pendingCount: sql<number>`count(case when ${paymentAuthorizations.status} = 'pending' then 1 end)::int`,
        pendingTotalPesewas: sql<number>`coalesce(sum(case when ${paymentAuthorizations.status} = 'pending' then ${paymentAuthorizations.amountPesewas} else 0 end), 0)::bigint`,
        approvedCount: sql<number>`count(case when ${paymentAuthorizations.status} = 'approved' then 1 end)::int`,
        approvedTotalPesewas: sql<number>`coalesce(sum(case when ${paymentAuthorizations.status} = 'approved' then ${paymentAuthorizations.amountPesewas} else 0 end), 0)::bigint`,
        disbursedCount: sql<number>`count(case when ${paymentAuthorizations.status} = 'disbursed' then 1 end)::int`,
        disbursedTotalPesewas: sql<number>`coalesce(sum(case when ${paymentAuthorizations.status} = 'disbursed' then ${paymentAuthorizations.amountPesewas} else 0 end), 0)::bigint`,
        rejectedCount: sql<number>`count(case when ${paymentAuthorizations.status} = 'rejected' then 1 end)::int`,
        aiScannedCount: sql<number>`count(case when ${paymentAuthorizations.receiptOcrExtracted} = true then 1 end)::int`,
      })
      .from(paymentAuthorizations)
      .where(where);

    return {
      totalCount: Number(stats?.totalCount ?? 0),
      pendingCount: Number(stats?.pendingCount ?? 0),
      pendingTotalPesewas: Number(stats?.pendingTotalPesewas ?? 0),
      approvedCount: Number(stats?.approvedCount ?? 0),
      approvedTotalPesewas: Number(stats?.approvedTotalPesewas ?? 0),
      disbursedCount: Number(stats?.disbursedCount ?? 0),
      disbursedTotalPesewas: Number(stats?.disbursedTotalPesewas ?? 0),
      rejectedCount: Number(stats?.rejectedCount ?? 0),
      aiScannedCount: Number(stats?.aiScannedCount ?? 0),
    };
  }

  async getById(id: string, user: JwtPayload) {
    const auth = await this.db.query.paymentAuthorizations.findFirst({
      where: eq(paymentAuthorizations.id, id),
      with: {
        store: true,
        requestedBy: {
          columns: { id: true, firstName: true, lastName: true, role: true, email: true },
        },
        authorizedBy: {
          columns: { id: true, firstName: true, lastName: true, role: true, email: true },
        },
        disbursedBy: {
          columns: { id: true, firstName: true, lastName: true, role: true, email: true },
        },
        ledgerEntry: true,
      },
    });

    if (!auth) throw new NotFoundException('Payment authorization not found');
    this.assertStoreScope(auth.storeId, user);
    return auth;
  }

  async create(dto: CreatePaymentAuthorizationDto, user: JwtPayload) {
    this.assertStoreScope(dto.storeId, user);

    // Generate sequential / unique auth code
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const authNumber = `PA-${dateStr}-${randSuffix}`;

    // Verify store
    const [store] = await this.db.select().from(stores).where(eq(stores.id, dto.storeId)).limit(1);
    if (!store) throw new NotFoundException('Store not found');
    if (store.status !== 'active') {
      throw new BadRequestException('Cannot create a payment authorization for an inactive branch');
    }

    const [auth] = await this.db
      .insert(paymentAuthorizations)
      .values({
        authorizationNumber: authNumber,
        storeId: dto.storeId,
        title: dto.title.trim(),
        category: dto.category,
        referenceType: dto.referenceType || null,
        referenceId: dto.referenceId || null,
        payeeName: dto.payeeName.trim(),
        amountPesewas: dto.amountPesewas,
        currencyCode: dto.currencyCode || 'GHS',
        paymentMethod: dto.paymentMethod,
        momoPhoneNumber: dto.momoPhoneNumber?.trim() || null,
        momoNetwork: dto.momoNetwork?.trim() || null,
        bankName: dto.bankName?.trim() || null,
        bankAccountNumber: dto.bankAccountNumber?.trim() || null,
        status: 'pending',
        requestedById: user.sub,
        notes: dto.notes?.trim() || null,
        receiptUrl: dto.receiptUrl || null,
        receiptOcrExtracted: dto.receiptOcrExtracted ?? false,
        receiptOcrConfidence: dto.receiptOcrConfidence || null,
        receiptOcrData: dto.receiptOcrData || null,
        receiptUploadedAt: dto.receiptUrl ? new Date() : null,
      })
      .returning();

    // Broadcast realtime event
    this.realtimeGateway.broadcastToStore(dto.storeId, 'payment_auth:created', {
      authorizationId: auth.id,
      authorizationNumber: auth.authorizationNumber,
      title: auth.title,
      amountPesewas: auth.amountPesewas,
    });

    return auth;
  }

  async scanReceipt(body: { imageUrl?: string; base64Image?: string }) {
    const img = body.imageUrl || body.base64Image || '';
    if (!img || img.length < 10) {
      throw new BadRequestException('Image data required for receipt scan');
    }

    try {
      const ocrResult = await this.aiService.ocrExtract(img);
      return {
        success: true,
        extractedData: ocrResult?.extractedData ?? null,
        confidence: ocrResult?.confidence ?? 0.9,
        source: ocrResult?.source ?? 'gemini-ocr',
      };
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Receipt scan failed');
    }
  }

  async approve(id: string, user: JwtPayload, dto: ApprovePaymentAuthorizationDto) {
    const [auth] = await this.db
      .select()
      .from(paymentAuthorizations)
      .where(eq(paymentAuthorizations.id, id))
      .limit(1);

    if (!auth) throw new NotFoundException('Payment authorization not found');
    this.assertStoreScope(auth.storeId, user);
    if (auth.status !== 'pending') {
      throw new ConflictException(`Cannot approve authorization with status: ${auth.status}`);
    }

    // Optional PIN verification if provided
    if (dto.managerPin) {
      const [staff] = await this.db
        .select()
        .from(staffProfile)
        .where(eq(staffProfile.id, user.sub))
        .limit(1);

      if (staff?.pinHash) {
        const valid = await bcrypt.compare(dto.managerPin, staff.pinHash);
        if (!valid) throw new UnauthorizedException('Invalid manager authorization PIN');
      }
    }

    const [updated] = await this.db
      .update(paymentAuthorizations)
      .set({
        status: 'approved',
        authorizedById: user.sub,
        authorizedAt: new Date(),
        notes: dto.notes
          ? sql`CONCAT(${paymentAuthorizations.notes}, '\nApproval Note: ', ${dto.notes})`
          : paymentAuthorizations.notes,
        updatedAt: new Date(),
      })
      .where(eq(paymentAuthorizations.id, id))
      .returning();

    this.realtimeGateway.broadcastToStore(auth.storeId, 'payment_auth:approved', {
      authorizationId: auth.id,
      authorizationNumber: auth.authorizationNumber,
    });

    return updated;
  }

  async reject(id: string, user: JwtPayload, dto: RejectPaymentAuthorizationDto) {
    const [auth] = await this.db
      .select()
      .from(paymentAuthorizations)
      .where(eq(paymentAuthorizations.id, id))
      .limit(1);

    if (!auth) throw new NotFoundException('Payment authorization not found');
    this.assertStoreScope(auth.storeId, user);
    if (auth.status !== 'pending' && auth.status !== 'approved') {
      throw new ConflictException(`Cannot reject authorization with status: ${auth.status}`);
    }

    const [updated] = await this.db
      .update(paymentAuthorizations)
      .set({
        status: 'rejected',
        authorizedById: user.sub,
        authorizedAt: new Date(),
        rejectionReason: dto.reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(paymentAuthorizations.id, id))
      .returning();

    this.realtimeGateway.broadcastToStore(auth.storeId, 'payment_auth:rejected', {
      authorizationId: auth.id,
      authorizationNumber: auth.authorizationNumber,
    });

    return updated;
  }

  async disburse(id: string, user: JwtPayload, dto: DisbursePaymentAuthorizationDto) {
    return this.db.transaction(async (tx) => {
      const [auth] = await tx
        .select()
        .from(paymentAuthorizations)
        .where(eq(paymentAuthorizations.id, id))
        .limit(1);

      if (!auth) throw new NotFoundException('Payment authorization not found');
      this.assertStoreScope(auth.storeId, user);
      if (auth.status !== 'approved') {
        throw new ConflictException('Only approved payment authorizations can be disbursed');
      }

      // 1. Create Double-Entry in General Ledger
      const [ledgerEntry] = await tx
        .insert(ledgerEntries)
        .values({
          storeId: auth.storeId,
          entryType: 'debit',
          category: auth.category === 'supplier_invoice' ? 'cost_of_goods' : 'expense',
          amountPesewas: auth.amountPesewas,
          description: `Disbursement: ${auth.title} - Payee: ${auth.payeeName} (${dto.transactionReference})`,
          referenceType: 'payment_authorization',
          referenceId: auth.id,
          performedById: user.sub,
          entryDate: new Date(),
        })
        .returning();

      // 2. If linked to a supplier invoice, update paid amounts and record payment
      if (auth.referenceType === 'supplier_invoice' && auth.referenceId) {
        const [invoice] = await tx
          .select()
          .from(supplierInvoices)
          .where(eq(supplierInvoices.id, auth.referenceId))
          .limit(1);

        if (invoice) {
          const newPaid = invoice.paidAmountPesewas + auth.amountPesewas;
          const newBalance = Math.max(0, invoice.totalAmountPesewas - newPaid);

          await tx
            .update(supplierInvoices)
            .set({
              paidAmountPesewas: newPaid,
              balancePesewas: newBalance,
              updatedAt: new Date(),
            })
            .where(eq(supplierInvoices.id, invoice.id));

          await tx.insert(invoicePayments).values({
            invoiceId: invoice.id,
            paidById: user.sub,
            amountPesewas: auth.amountPesewas,
            method: auth.paymentMethod,
            reference: dto.transactionReference,
            notes: `Disbursed via Authorization ${auth.authorizationNumber}`,
          });
        }
      }

      // 3. If linked to an expense, mark as approved
      if (auth.referenceType === 'expense' && auth.referenceId) {
        await tx
          .update(expenses)
          .set({
            approvedById: user.sub,
            referenceNumber: dto.transactionReference,
            updatedAt: new Date(),
          })
          .where(eq(expenses.id, auth.referenceId));
      }

      // 4. Mark Authorization as Disbursed
      const [disbursed] = await tx
        .update(paymentAuthorizations)
        .set({
          status: 'disbursed',
          disbursedAt: new Date(),
          disbursedById: user.sub,
          transactionReference: dto.transactionReference.trim(),
          ledgerEntryId: ledgerEntry.id,
          notes: dto.notes
            ? sql`CONCAT(${paymentAuthorizations.notes}, '\nDisbursement Note: ', ${dto.notes})`
            : paymentAuthorizations.notes,
          updatedAt: new Date(),
        })
        .where(eq(paymentAuthorizations.id, id))
        .returning();

      this.realtimeGateway.broadcastToStore(auth.storeId, 'payment_auth:disbursed', {
        authorizationId: auth.id,
        authorizationNumber: auth.authorizationNumber,
        ledgerEntryId: ledgerEntry.id,
      });

      return disbursed;
    });
  }
}
