/**
 * Stock Intelligence Service
 * All AI methods are MOCKED_PENDING_MODEL_INTEGRATION.
 * Each method is labelled with a comment indicating what the real model should replace.
 * Mocked data is realistic and matches the actual response contract.
 */
import { Injectable, Inject } from '@nestjs/common';
import { eq, and, lte, desc, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  demandForecasts,
  stockItems,
  stockBatches,
  products,
  coPurchasePatterns,
  aiInsights,
} from '../../database/schema';

@Injectable()
export class StockIntelligenceService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: call time-series forecasting model with SKU sales history.
   */
  async getDemandForecast(productId: string, storeId: string, horizonDays = 30) {
    const [existing] = await this.db
      .select()
      .from(demandForecasts)
      .where(and(eq(demandForecasts.productId, productId), eq(demandForecasts.storeId, storeId)))
      .orderBy(desc(demandForecasts.createdAt))
      .limit(1);

    if (existing && !existing.isMocked) return existing;

    // Generate mock forecast
    const today = new Date().toISOString().split('T')[0];
    const [product] = await this.db.select().from(products).where(eq(products.id, productId)).limit(1);
    const [stockItem] = await this.db
      .select()
      .from(stockItems)
      .where(and(eq(stockItems.productId, productId), eq(stockItems.storeId, storeId)))
      .limit(1);

    const currentStock = stockItem?.quantityOnHand ?? 0;
    const predicted = Math.floor(Math.random() * 20) + 10;
    const daysLeft = currentStock > 0 ? Math.ceil((currentStock / predicted) * horizonDays) : 0;

    const [forecast] = await this.db
      .insert(demandForecasts)
      .values({
        productId,
        storeId,
        forecastDate: today,
        horizonDays,
        predictedUnits: predicted,
        confidenceLow: Math.floor(predicted * 0.8),
        confidenceHigh: Math.ceil(predicted * 1.2),
        daysOfStockLeft: daysLeft,
        suggestedReorderQty: Math.max(product?.reorderQty ?? 10, predicted * 2),
        signals: { trend: 'stable', seasonality: 1.0, promoLift: 0.0 },
        reasoning: `Based on recent sales patterns, ${product?.name ?? 'this product'} is expected to sell ~${predicted} units over ${horizonDays} days. Current stock covers approximately ${daysLeft} days.`,
        isMocked: true,
      })
      .onConflictDoNothing()
      .returning();

    return forecast ?? existing;
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: use demand forecasts + live stock levels to rank urgency.
   */
  async getReorderSuggestions(storeId: string) {
    const items = await this.db
      .select({ stockItem: stockItems, product: products })
      .from(stockItems)
      .innerJoin(products, eq(products.id, stockItems.productId))
      .where(eq(stockItems.storeId, storeId));

    return items
      .filter(({ stockItem, product }) => stockItem.quantityOnHand <= product.reorderPoint)
      .map(({ stockItem, product }) => {
        const daysLeft = Math.floor(Math.random() * 10) + 1; // MOCKED
        const urgency =
          stockItem.quantityOnHand === 0 ? 'critical'
          : daysLeft <= 3 ? 'critical'
          : daysLeft <= 7 ? 'warning'
          : 'info';

        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: stockItem.quantityOnHand,
          reorderPoint: product.reorderPoint,
          suggestedQty: product.reorderQty,
          daysOfStockLeft: daysLeft,
          urgency,
          reasoning: `Stock at ${stockItem.quantityOnHand} units is at or below reorder point of ${product.reorderPoint}. Estimated ${daysLeft} days of stock remaining.`,
          isMocked: true,
        };
      })
      .sort((a, b) => a.daysOfStockLeft - b.daysOfStockLeft);
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: combine batch expiry dates with demand forecast to rank true risk.
   */
  async getExpiryRiskReport(storeId: string) {
    const now = new Date();
    const in90Days = new Date(now);
    in90Days.setDate(now.getDate() + 90);

    const batches = await this.db
      .select({ batch: stockBatches, product: products })
      .from(stockBatches)
      .innerJoin(products, eq(products.id, stockBatches.productId))
      .where(
        and(
          eq(stockBatches.storeId, storeId),
          eq(stockBatches.isActive, true),
          lte(stockBatches.expiryDate, in90Days.toISOString().split('T')[0]),
        ),
      )
      .orderBy(stockBatches.expiryDate);

    return batches.map(({ batch, product }) => {
      const expiryDate = new Date(batch.expiryDate!);
      const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const severity = daysToExpiry <= 30 ? 'critical' : 'warning';

      return {
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        daysToExpiry,
        quantityAtRisk: batch.quantityRemaining,
        severity,
        suggestedActions: daysToExpiry <= 30
          ? ['apply_discount_20pct', 'bundle_deal', 'return_to_supplier']
          : ['apply_discount_10pct', 'feature_in_promotions'],
      };
    });
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: query co-purchase model trained on historical sales baskets.
   */
  async getUpsellSuggestions(productIds: string[], storeId: string) {
    const patterns = await this.db
      .select({ pattern: coPurchasePatterns, product: products })
      .from(coPurchasePatterns)
      .innerJoin(products, eq(products.id, coPurchasePatterns.productBId))
      .where(
        and(
          eq(coPurchasePatterns.storeId, storeId),
          inArray(coPurchasePatterns.productAId, productIds),
        ),
      )
      .orderBy(desc(coPurchasePatterns.confidenceScore))
      .limit(15);

    if (patterns.length > 0) return { suggestions: patterns, isMocked: false };

    // Fallback mock — return 3 random products from store
    const mockProducts = await this.db
      .select()
      .from(products)
      .limit(3);

    return {
      suggestions: mockProducts.map((p) => ({
        product: p,
        confidenceScore: Math.floor(Math.random() * 30) + 50,
        reason: 'Frequently bought together (mocked)',
      })),
      isMocked: true,
      note: 'MOCKED_PENDING_MODEL_INTEGRATION — train co-purchase model on sales basket data',
    };
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: batch job reads sales history and upserts real forecasts.
   */
  async triggerForecastRefresh(storeId: string) {
    const items = await this.db
      .select({ productId: stockItems.productId })
      .from(stockItems)
      .where(eq(stockItems.storeId, storeId));

    let refreshed = 0;
    for (const { productId } of items) {
      await this.getDemandForecast(productId, storeId);
      refreshed++;
    }

    return {
      refreshed,
      storeId,
      isMocked: true,
      note: 'MOCKED_PENDING_MODEL_INTEGRATION — replace with scheduled ML batch job',
    };
  }
}
